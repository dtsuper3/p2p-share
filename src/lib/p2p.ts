import { joinRoom, selfId, type Room, type ActionSender, type ActionReceiver, type DataPayload } from 'trystero'

const APP_ID = 'p2p-share-app-2026'
const CHUNK_SIZE = 64 * 1024 // 64KB chunks

export interface FileMetadata {
  id: string
  name: string
  size: number
  type: string
  senderId: string
}

export interface TransferProgress {
  fileId: string
  fileName: string
  progress: number // 0-100
  speed: number // bytes/sec
  direction: 'upload' | 'download'
  status: 'pending' | 'transferring' | 'completed' | 'error'
}

interface ChunkPayload {
  fileId: string
  chunk: number[]
  index: number
  total: number
}

interface FileIdPayload {
  fileId: string
}

export interface P2PCallbacks {
  onPeerJoin: (peerId: string) => void
  onPeerLeave: (peerId: string) => void
  onFileOffer: (metadata: FileMetadata, accept: () => void, reject: () => void) => void
  onTransferProgress: (progress: TransferProgress) => void
  onFileReceived: (metadata: FileMetadata, blob: Blob) => void
  onError: (error: string) => void
}

export { selfId }

export class P2PManager {
  private room: Room | null = null
  private callbacks: P2PCallbacks

  private sendMeta: ActionSender | null = null
  private sendChunk: ActionSender | null = null
  private sendAccept: ActionSender | null = null
  private sendReject: ActionSender | null = null
  private sendComplete: ActionSender | null = null

  private pendingFiles: Map<string, { file: File; peerId: string }> = new Map()
  private receivingFiles: Map<string, {
    metadata: FileMetadata
    chunks: ArrayBuffer[]
    received: number
    startTime: number
  }> = new Map()

  constructor(callbacks: P2PCallbacks) {
    this.callbacks = callbacks
  }

  joinRoom(roomCode: string): void {
    try {
      this.room = joinRoom({ appId: APP_ID }, roomCode)

      this.room.onPeerJoin((peerId: string) => {
        this.callbacks.onPeerJoin(peerId)
      })

      this.room.onPeerLeave((peerId: string) => {
        this.callbacks.onPeerLeave(peerId)
      })

      // Set up actions — makeAction returns [sender, receiver, onProgress]
      const [sendMeta, getMeta] = this.room.makeAction<DataPayload>('file-meta')
      const [sendChunk, getChunk] = this.room.makeAction<DataPayload>('file-chunk')
      const [sendAccept, getAccept] = this.room.makeAction<DataPayload>('file-accept')
      const [sendReject, getReject] = this.room.makeAction<DataPayload>('file-reject')
      const [sendComplete, getComplete] = this.room.makeAction<DataPayload>('file-complete')

      this.sendMeta = sendMeta
      this.sendChunk = sendChunk
      this.sendAccept = sendAccept
      this.sendReject = sendReject
      this.sendComplete = sendComplete

      this.setupListeners(getMeta, getChunk, getAccept, getReject, getComplete)
    } catch (err) {
      this.callbacks.onError(`Failed to join room: ${err}`)
    }
  }

  private setupListeners(
    getMeta: ActionReceiver,
    getChunk: ActionReceiver,
    getAccept: ActionReceiver,
    getReject: ActionReceiver,
    getComplete: ActionReceiver,
  ): void {
    // Listen for file offers
    getMeta((data, peerId) => {
      const metadata = data as unknown as FileMetadata
      metadata.senderId = peerId

      this.callbacks.onFileOffer(
        metadata,
        () => {
          // Accept: set up receiving buffer
          this.receivingFiles.set(metadata.id, {
            metadata,
            chunks: [],
            received: 0,
            startTime: Date.now(),
          })
          this.sendAccept!({ fileId: metadata.id } as unknown as DataPayload, peerId)

          this.callbacks.onTransferProgress({
            fileId: metadata.id,
            fileName: metadata.name,
            progress: 0,
            speed: 0,
            direction: 'download',
            status: 'pending',
          })
        },
        () => {
          this.sendReject!({ fileId: metadata.id } as unknown as DataPayload, peerId)
        },
      )
    })

    // Listen for accept responses
    getAccept((data, peerId) => {
      const { fileId } = data as unknown as FileIdPayload
      const pending = this.pendingFiles.get(fileId)
      if (pending) {
        this.startSending(fileId, pending.file, peerId)
      }
    })

    // Listen for reject responses
    getReject((data) => {
      const { fileId } = data as unknown as FileIdPayload
      this.pendingFiles.delete(fileId)
      this.callbacks.onTransferProgress({
        fileId,
        fileName: '',
        progress: 0,
        speed: 0,
        direction: 'upload',
        status: 'error',
      })
    })

    // Listen for file chunks
    getChunk((data) => {
      const { fileId, chunk, index, total } = data as unknown as ChunkPayload

      const receiving = this.receivingFiles.get(fileId)
      if (!receiving) return

      receiving.chunks[index] = new Uint8Array(chunk).buffer
      receiving.received++

      const progress = Math.round((receiving.received / total) * 100)
      const elapsed = (Date.now() - receiving.startTime) / 1000
      const bytesReceived = receiving.received * CHUNK_SIZE
      const speed = elapsed > 0 ? bytesReceived / elapsed : 0

      this.callbacks.onTransferProgress({
        fileId,
        fileName: receiving.metadata.name,
        progress,
        speed,
        direction: 'download',
        status: 'transferring',
      })

      // Check if all chunks received
      if (receiving.received === total) {
        const blob = new Blob(receiving.chunks, { type: receiving.metadata.type })
        this.callbacks.onTransferProgress({
          fileId,
          fileName: receiving.metadata.name,
          progress: 100,
          speed: 0,
          direction: 'download',
          status: 'completed',
        })
        this.callbacks.onFileReceived(receiving.metadata, blob)
        this.sendComplete!({ fileId } as unknown as DataPayload, receiving.metadata.senderId)
        this.receivingFiles.delete(fileId)
      }
    })

    // Listen for completion acknowledgment
    getComplete((data) => {
      const { fileId } = data as unknown as FileIdPayload
      this.pendingFiles.delete(fileId)
    })
  }

  async sendFile(file: File, peerId?: string): Promise<void> {
    if (!this.sendMeta) {
      this.callbacks.onError('Not connected to a room')
      return
    }

    const fileId = crypto.randomUUID()
    const metadata: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      senderId: selfId,
    }

    this.pendingFiles.set(fileId, { file, peerId: peerId || '' })

    this.callbacks.onTransferProgress({
      fileId,
      fileName: file.name,
      progress: 0,
      speed: 0,
      direction: 'upload',
      status: 'pending',
    })

    // Send metadata (offer) to specific peer or all peers
    await this.sendMeta(metadata as unknown as DataPayload, peerId ?? null)
  }

  private async startSending(fileId: string, file: File, peerId: string): Promise<void> {
    if (!this.sendChunk) return

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const startTime = Date.now()

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const slice = file.slice(start, end)
      const buffer = await slice.arrayBuffer()
      const chunk = Array.from(new Uint8Array(buffer))

      await this.sendChunk(
        { fileId, chunk, index: i, total: totalChunks } as unknown as DataPayload,
        peerId,
      )

      const progress = Math.round(((i + 1) / totalChunks) * 100)
      const elapsed = (Date.now() - startTime) / 1000
      const bytesSent = (i + 1) * CHUNK_SIZE
      const speed = elapsed > 0 ? bytesSent / elapsed : 0

      this.callbacks.onTransferProgress({
        fileId,
        fileName: file.name,
        progress,
        speed,
        direction: 'upload',
        status: progress === 100 ? 'completed' : 'transferring',
      })

      // Small delay to prevent overwhelming the data channel
      if (i % 10 === 0) {
        await new Promise((r) => setTimeout(r, 5))
      }
    }
  }

  async leaveRoom(): Promise<void> {
    if (this.room) {
      await this.room.leave()
      this.room = null
    }
    this.pendingFiles.clear()
    this.receivingFiles.clear()
    this.sendMeta = null
    this.sendChunk = null
    this.sendAccept = null
    this.sendReject = null
    this.sendComplete = null
  }
}
