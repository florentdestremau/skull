import { useEffect } from 'react'
import type { Credentials } from '../net/api'
import { useRoom } from '../net/useRoom'
import { pendingAutoAction } from '../game/auto'
import Lobby from './Lobby'
import GameBoard from './GameBoard'

export default function MultiGame({
  creds, onExit,
}: {
  creds: Credentials
  onExit: () => void
}) {
  const { room, myPlayerId, connected, lastError, sendAction } = useRoom(
    creds.roomId,
    creds.token,
  )

  // sécurité : si le serveur n'a pas résolu une défausse au hasard, on l'aide.
  useEffect(() => {
    if (!room?.state || myPlayerId == null) return
    const auto = pendingAutoAction(room.state)
    if (auto && room.state.pendingLoss?.challengerId === myPlayerId) {
      const t = setTimeout(() => sendAction(auto), 1100)
      return () => clearTimeout(t)
    }
  }, [room, myPlayerId, sendAction])

  if (!room) {
    return (
      <div className="card">
        <div className="banner">{connected ? 'Chargement…' : 'Connexion au serveur…'}</div>
        {lastError && <div className="err">{lastError}</div>}
        <button onClick={onExit}>Retour</button>
      </div>
    )
  }

  if (!room.state || !myPlayerId) {
    return (
      <Lobby
        room={room}
        myPlayerId={myPlayerId ?? creds.playerId}
        token={creds.token}
        onExit={onExit}
      />
    )
  }

  return (
    <div className="col">
      <div className="row spread">
        <h2>💀 Skull — partie {room.id}</h2>
        <span className="meta">{connected ? '🟢 connecté' : '🔴 reconnexion…'}</span>
        <button onClick={onExit}>Quitter</button>
      </div>
      <div className="card">
        <GameBoard
          state={room.state}
          viewerId={myPlayerId}
          onAction={sendAction}
          error={lastError}
        />
      </div>
    </div>
  )
}
