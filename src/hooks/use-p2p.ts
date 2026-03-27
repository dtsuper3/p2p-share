import { useState, useCallback, useRef, useEffect } from 'react'
import { P2PManager, selfId, type FileMetadata, type TransferProgress } from '../lib/p2p'

export { selfId }

export interface PendingOffer {
  metadata: FileMetadata
  accept: () => void
  reject: () => void
}

export function useP2P() {
  const [isConnected, setIsConnected] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [peers, setPeers] = useState<string[]>([])
  const [transfers, setTransfers] = useState<Map<string, TransferProgress>>(new Map())
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([])
  const [receivedFiles, setReceivedFiles] = useState<{ metadata: FileMetadata; url: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const managerRef = useRef<P2PManager | null>(null)

  const joinRoom = useCallback((code: string) => {
    if (managerRef.current) {
      managerRef.current.leaveRoom()
    }

    const manager = new P2PManager({
      onPeerJoin: (peerId) => {
        setPeers((prev) => [...prev.filter((p) => p !== peerId), peerId])
      },
      onPeerLeave: (peerId) => {
        setPeers((prev) => prev.filter((p) => p !== peerId))
      },
      onFileOffer: (metadata, accept, reject) => {
        setPendingOffers((prev) => [...prev, { metadata, accept, reject }])
      },
      onTransferProgress: (progress) => {
        setTransfers((prev) => {
          const next = new Map(prev)
          next.set(progress.fileId, progress)
          return next
        })
      },
      onFileReceived: (metadata, blob) => {
        const url = URL.createObjectURL(blob)
        setReceivedFiles((prev) => [...prev, { metadata, url }])
      },
      onError: (err) => {
        setError(err)
      },
    })

    manager.joinRoom(code)
    managerRef.current = manager
    setRoomCode(code)
    setIsConnected(true)
    setError(null)
    setPeers([])
    setTransfers(new Map())
    setPendingOffers([])
    setReceivedFiles([])
  }, [])

  const leaveRoom = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.leaveRoom()
      managerRef.current = null
    }
    setIsConnected(false)
    setRoomCode('')
    setPeers([])
    setTransfers(new Map())
    setPendingOffers([])
  }, [])

  const sendFile = useCallback((file: File, peerId?: string) => {
    if (!managerRef.current) {
      setError('Not connected to a room')
      return
    }
    managerRef.current.sendFile(file, peerId)
  }, [])

  const acceptOffer = useCallback((fileId: string) => {
    setPendingOffers((prev) => {
      const offer = prev.find((o) => o.metadata.id === fileId)
      if (offer) offer.accept()
      return prev.filter((o) => o.metadata.id !== fileId)
    })
  }, [])

  const rejectOffer = useCallback((fileId: string) => {
    setPendingOffers((prev) => {
      const offer = prev.find((o) => o.metadata.id === fileId)
      if (offer) offer.reject()
      return prev.filter((o) => o.metadata.id !== fileId)
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.leaveRoom()
      }
    }
  }, [])

  return {
    isConnected,
    roomCode,
    peers,
    transfers,
    pendingOffers,
    receivedFiles,
    error,
    joinRoom,
    leaveRoom,
    sendFile,
    acceptOffer,
    rejectOffer,
  }
}
