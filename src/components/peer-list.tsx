interface PeerListProps {
  peers: string[]
}

export function PeerList({ peers }: PeerListProps) {
  if (peers.length === 0) {
    return (
      <div className="peer-list empty">
        <p>Waiting for peers to join...</p>
        <p className="hint">Share the room code with others to connect</p>
      </div>
    )
  }

  return (
    <div className="peer-list">
      <h3>Connected Peers</h3>
      <ul>
        {peers.map((peerId) => (
          <li key={peerId} className="peer-item">
            <span className="status-dot connected" />
            <span className="peer-id">{peerId.slice(0, 8)}...</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
