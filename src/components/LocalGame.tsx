import { useEffect, useState } from 'react'
import { createInitialState } from '../game/setup'
import { reducer } from '../game/reducer'
import { pendingAutoAction, actingPlayerId } from '../game/auto'
import type { GameAction } from '../game/actions'
import GameBoard from './GameBoard'

export default function LocalGame({ names, onExit }: { names: string[]; onExit: () => void }) {
  const [state, setState] = useState(() => createInitialState(names))
  const [error, setError] = useState<string | null>(null)

  function dispatch(a: GameAction) {
    setState(prev => {
      const next = reducer(prev, a)
      if (next === prev) {
        setError('Action invalide')
        return prev
      }
      setError(null)
      return next
    })
  }

  useEffect(() => {
    const auto = pendingAutoAction(state)
    if (!auto) return
    const t = setTimeout(() => dispatch(auto), 1100)
    return () => clearTimeout(t)
  }, [state])

  return (
    <div className="col">
      <div className="row spread">
        <h2>💀 Skull — local</h2>
        <button onClick={onExit}>Quitter</button>
      </div>
      <div className="card">
        <GameBoard
          state={state}
          viewerId={actingPlayerId(state)}
          onAction={dispatch}
          error={error}
          isLocal
        />
      </div>
      {state.phase === 'gameover' && (
        <button className="primary" onClick={onExit}>Nouvelle partie</button>
      )}
    </div>
  )
}
