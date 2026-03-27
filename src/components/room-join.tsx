import { useState } from 'react'

interface RoomJoinProps {
  onJoin: (roomCode: string) => void
  isConnected: boolean
  roomCode: string
  onLeave: () => void
  peerCount: number
}

function generateRoomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function RoomJoin({ onJoin, isConnected, roomCode, onLeave, peerCount }: RoomJoinProps) {
  const [inputCode, setInputCode] = useState('')

  const handleCreateRoom = () => {
    const code = generateRoomCode()
    setInputCode(code)
    onJoin(code)
  }

  const handleJoinRoom = () => {
    if (inputCode.trim()) {
      onJoin(inputCode.trim().toLowerCase())
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
  }

  if (isConnected) {
    return (
      <div className="room-connected">
        <div className="room-info">
          <div className="room-status">
            <span className="status-dot connected" />
            <span>Connected to room</span>
          </div>
          <div className="room-code-display" onClick={handleCopyCode} title="Click to copy">
            <span className="room-code-label">Room Code:</span>
            <span className="room-code-value">{roomCode}</span>
            <span className="copy-icon">&#128203;</span>
          </div>
          <div className="peer-count">
            {peerCount} peer{peerCount !== 1 ? 's' : ''} connected
          </div>
        </div>
        <button className="btn btn-danger" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    )
  }

  return (
    <div className="room-join">
      <h2>Join or Create a Room</h2>
      <p className="room-description">
        Create a new room and share the code, or enter a room code to join an existing room.
        No server required — files transfer directly between browsers.
      </p>
      <div className="room-actions">
        <div className="join-form">
          <input
            type="text"
            placeholder="Enter room code..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            maxLength={20}
          />
          <button className="btn btn-primary" onClick={handleJoinRoom} disabled={!inputCode.trim()}>
            Join Room
          </button>
        </div>
        <div className="divider">
          <span>or</span>
        </div>
        <button className="btn btn-secondary" onClick={handleCreateRoom}>
          Create New Room
        </button>
      </div>
    </div>
  )
}
