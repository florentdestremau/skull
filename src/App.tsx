import { useState } from 'react'
import LocalGame from './components/LocalGame'
import MultiGame from './components/MultiGame'
import { createRoomApi, joinRoomApi, saveCreds, loadCreds } from './net/api'
import type { Credentials } from './net/api'

type Screen =
  | { kind: 'home' }
  | { kind: 'local'; names: string[] }
  | { kind: 'multi'; creds: Credentials }

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const params = new URLSearchParams(location.search)
    const room = params.get('room')
    if (room) {
      const creds = loadCreds(room)
      if (creds) return { kind: 'multi', creds }
    }
    return { kind: 'home' }
  })

  if (screen.kind === 'local') {
    return (
      <LocalGame names={screen.names} onExit={() => setScreen({ kind: 'home' })} />
    )
  }
  if (screen.kind === 'multi') {
    return (
      <MultiGame
        creds={screen.creds}
        onExit={() => {
          history.replaceState(null, '', location.pathname)
          setScreen({ kind: 'home' })
        }}
      />
    )
  }
  return <Home onLocal={names => setScreen({ kind: 'local', names })}
               onMulti={creds => {
                 saveCreds(creds)
                 history.replaceState(null, '', `/?room=${creds.roomId}`)
                 setScreen({ kind: 'multi', creds })
               }} />
}

function Home({
  onLocal, onMulti,
}: {
  onLocal: (names: string[]) => void
  onMulti: (creds: Credentials) => void
}) {
  const [count, setCount] = useState(3)
  const [names, setNames] = useState<string[]>(['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4', 'Joueur 5', 'Joueur 6'])
  const [mpName, setMpName] = useState('')
  const [joinCode, setJoinCode] = useState(
    new URLSearchParams(location.search).get('room') ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function setName(i: number, v: string) {
    setNames(prev => prev.map((n, idx) => (idx === i ? v : n)))
  }

  async function create() {
    setBusy(true); setErr(null)
    try {
      onMulti(await createRoomApi(mpName))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true); setErr(null)
    try {
      onMulti(await joinRoomApi(joinCode.trim().toUpperCase(), mpName))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col">
      <h1 className="title">💀 SKULL</h1>
      <p className="subtitle">Jeu de bluff et d'enchères — 3 à 6 joueurs</p>

      <div className="card col">
        <h2>Partie locale</h2>
        <p className="meta">Tour par tour sur cet appareil.</p>
        <div className="row">
          <label>Joueurs :</label>
          {[3, 4, 5, 6].map(n => (
            <button
              key={n}
              className={count === n ? 'primary' : ''}
              onClick={() => setCount(n)}
            >{n}</button>
          ))}
        </div>
        {names.slice(0, count).map((n, i) => (
          <input
            key={i}
            value={n}
            maxLength={20}
            placeholder={`Joueur ${i + 1}`}
            onChange={e => setName(i, e.target.value)}
          />
        ))}
        <button
          className="primary"
          onClick={() => onLocal(names.slice(0, count))}
        >Démarrer en local</button>
      </div>

      <div className="card col">
        <h2>Partie multijoueur</h2>
        <p className="meta">Crée une partie ou rejoins avec un code.</p>
        <input
          value={mpName}
          maxLength={20}
          placeholder="Ton pseudo"
          onChange={e => setMpName(e.target.value)}
        />
        <div className="row">
          <button className="primary" disabled={busy} onClick={create}>
            Créer une partie
          </button>
        </div>
        <div className="row">
          <input
            value={joinCode}
            placeholder="CODE"
            style={{ textTransform: 'uppercase', width: 120 }}
            onChange={e => setJoinCode(e.target.value)}
          />
          <button disabled={busy || !joinCode.trim()} onClick={join}>
            Rejoindre
          </button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  )
}
