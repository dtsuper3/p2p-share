import type { TransferProgress } from '../lib/p2p'
import type { PendingOffer } from '../hooks/use-p2p'

interface TransferListProps {
  transfers: Map<string, TransferProgress>
  pendingOffers: PendingOffer[]
  receivedFiles: { metadata: { id: string; name: string; size: number }; url: string }[]
  onAccept: (fileId: string) => void
  onReject: (fileId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function TransferList({ transfers, pendingOffers, receivedFiles, onAccept, onReject }: TransferListProps) {
  const transferArray = Array.from(transfers.values())

  if (pendingOffers.length === 0 && transferArray.length === 0 && receivedFiles.length === 0) {
    return null
  }

  return (
    <div className="transfer-list">
      <h3>Transfers</h3>

      {/* Pending offers */}
      {pendingOffers.map((offer) => (
        <div key={offer.metadata.id} className="transfer-item offer">
          <div className="transfer-info">
            <span className="transfer-name">{offer.metadata.name}</span>
            <span className="transfer-size">{formatBytes(offer.metadata.size)}</span>
          </div>
          <div className="transfer-label">Incoming file from peer</div>
          <div className="offer-actions">
            <button className="btn btn-sm btn-primary" onClick={() => onAccept(offer.metadata.id)}>
              Accept
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => onReject(offer.metadata.id)}>
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* Active transfers */}
      {transferArray.map((transfer) => (
        <div key={transfer.fileId} className={`transfer-item ${transfer.status}`}>
          <div className="transfer-info">
            <span className="transfer-name">{transfer.fileName}</span>
            <span className="transfer-direction">
              {transfer.direction === 'upload' ? '↑ Sending' : '↓ Receiving'}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${transfer.progress}%` }}
            />
          </div>
          <div className="transfer-stats">
            <span>{transfer.progress}%</span>
            {transfer.status === 'transferring' && (
              <span>{formatSpeed(transfer.speed)}</span>
            )}
            {transfer.status === 'completed' && (
              <span className="completed-label">Completed</span>
            )}
            {transfer.status === 'error' && (
              <span className="error-label">Failed</span>
            )}
          </div>
        </div>
      ))}

      {/* Received files (downloadable) */}
      {receivedFiles.map((file) => (
        <div key={file.metadata.id} className="transfer-item received">
          <div className="transfer-info">
            <span className="transfer-name">{file.metadata.name}</span>
            <span className="transfer-size">{formatBytes(file.metadata.size)}</span>
          </div>
          <a
            href={file.url}
            download={file.metadata.name}
            className="btn btn-sm btn-primary"
          >
            Download
          </a>
        </div>
      ))}
    </div>
  )
}
