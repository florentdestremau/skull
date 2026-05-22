import type { GameAction } from './actions'
import type { DiskColor, GameState } from './types'

/**
 * Action résolue automatiquement (sans choix réel d'un joueur).
 * Cas : défausse au hasard quand le Challenger a retourné le crâne d'un adversaire.
 */
export function pendingAutoAction(state: GameState): GameAction | null {
  if (state.phase === 'discarding' && state.pendingLoss?.byRandom) {
    const ch = state.players.find(p => p.id === state.pendingLoss!.challengerId)
    if (!ch) return null
    const pool: DiskColor[] = []
    for (let i = 0; i < ch.roses; i++) pool.push('rose')
    if (ch.hasSkull) pool.push('skull')
    if (pool.length === 0) return null
    const color = pool[Math.floor(Math.random() * pool.length)]
    return { type: 'DISCARD', color }
  }
  return null
}

/** Joueur dont on attend une action (Challenger en phase reveal/discard). */
export function actingPlayerId(state: GameState): string | null {
  if (state.phase === 'gameover') return null
  if (state.phase === 'revealing') {
    return state.highestBidderIndex != null
      ? state.players[state.highestBidderIndex].id
      : null
  }
  if (state.phase === 'discarding') {
    return state.pendingLoss?.challengerId ?? null
  }
  return state.players[state.currentPlayerIndex]?.id ?? null
}
