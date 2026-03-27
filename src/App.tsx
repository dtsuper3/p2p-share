import { useP2P } from './hooks/use-p2p'
import { RoomJoin } from './components/room-join'
import { FileDrop } from './components/file-drop'
import { PeerList } from './components/peer-list'
import { TransferList } from './components/transfer-list'
import './App.css'

function App() {
  const {
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
  } = useP2P()

  const handleFilesSelected = (files: File[]) => {
    for (const file of files) {
      sendFile(file)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>P2P Share</h1>
        <p className="tagline">Serverless peer-to-peer file sharing in the browser</p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
          </div>
        )}

        <RoomJoin
          onJoin={joinRoom}
          isConnected={isConnected}
          roomCode={roomCode}
          onLeave={leaveRoom}
          peerCount={peers.length}
        />

        {isConnected && (
          <div className="connected-content">
            <div className="main-area">
              <FileDrop
                onFilesSelected={handleFilesSelected}
                disabled={!isConnected || peers.length === 0}
              />
              <TransferList
                transfers={transfers}
                pendingOffers={pendingOffers}
                receivedFiles={receivedFiles}
                onAccept={acceptOffer}
                onReject={rejectOffer}
              />
            </div>
            <aside className="sidebar">
              <PeerList peers={peers} />
            </aside>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Files are transferred directly between browsers using WebRTC.
          No data passes through any server.
        </p>
      </footer>
    </div>
  )
}

export default App
