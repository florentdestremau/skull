import type { GameState, Player } from './types'

export function totalDisksOnTable(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.stack.length, 0)
}

export function stackRoses(player: Player): number {
  return player.stack.filter(d => d === 'rose').length
}

export function stackHasSkull(player: Player): boolean {
  return player.stack.includes('skull')
}

/** Disques fleur encore disponibles dans la main du joueur. */
export function handRoses(player: Player): number {
  return player.roses - stackRoses(player)
}

/** Le joueur peut-il encore poser son crâne ? */
export function handHasSkull(player: Player): boolean {
  return player.hasSkull && !stackHasSkull(player)
}

export function diskCount(player: Player): number {
  return player.roses + (player.hasSkull ? 1 : 0)
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter(p => !p.eliminated)
}

/** Index du prochain joueur non éliminé après `from`. */
export function nextActiveIndex(state: GameState, from: number): number {
  const n = state.players.length
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n
    if (!state.players[i].eliminated) return i
  }
  return from
}

/** Index du prochain enchérisseur non éliminé et n'ayant pas passé. */
export function nextBidderIndex(state: GameState, from: number): number {
  const n = state.players.length
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n
    const p = state.players[i]
    if (!p.eliminated && !state.passed.includes(p.id)) return i
  }
  return from
}
