import { useState } from 'react'
import type { PublicRoom } from '../net/types'
import { renameSlotApi, startRoomApi } from '../net/api'

export default function Lobby({
  room, myPlayerId, token, onExit,
}: {
  room: PublicRoom
  myPlayerId: string
  token: string
  onExit: () => void
}) {
  const me = room.slots.find(s => s.playerId === myPlayerId)
  const isHost = room.host === myPlayerId
  const [name, setName] = useState(me?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const shareUrl = `${location.origin}/?room=${room.id}`

  async function rename() {
    try { await renameSlotApi(room.id, token, name) } catch { /* ignore */ }
  }

  async function start() {
    setBusy(true); setErr(null)
    try {
      await startRoomApi(room.id, token)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col">
      <div className="row spread">
        <h2>💀 Salon Skull</h2>
        <button onClick={onExit}>Quitter</button>
      </div>
      <div className="card col">
        <div className="row spread">
          <span>Code de la partie</span>
          <span className="code">{room.id}</span>
        </div>
        <div className="row">
          <span className="meta">Lien d'invitation :</span>
          <a href={shareUrl}>{shareUrl}</a>
        </div>
        <hr style={{ borderColor: 'var(--line)', width: '100%' }} />
        <h3>Joueurs ({room.slots.length}/6)</h3>
        {room.slots.map(s => (
          <div className="row" key={s.playerId}>
            <span className="dot" style={{ background: s.color }} />
            <strong>{s.name}</strong>
            {s.playerId === room.host && <span className="meta">hôte</span>}
            {s.playerId === myPlayerId && <span className="meta">(toi)</span>}
          </div>
        ))}
        {me && (
          <div className="row">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={20} />
            <button onClick={rename}>Renommer</button>
          </div>
        )}
        {err && <div className="err">{err}</div>}
        {isHost ? (
          <button
            className="primary"
            disabled={busy || room.slots.length < 3}
            onClick={start}
          >
            {room.slots.length < 3 ? 'Il faut au moins 3 joueurs' : 'Démarrer la partie'}
          </button>
        ) : (
          <div className="banner">En attente du lancement par l'hôte…</div>
        )}
      </div>
    </div>
  )
}
