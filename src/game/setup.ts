import type { GameState, Player } from './types'
import { ROSES_PER_PLAYER } from './types'

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']

export function createInitialState(names: string[]): GameState {
  const players: Player[] = names.map((name, i) => ({
    id: `p${i}`,
    name: name || `Joueur ${i + 1}`,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    roses: ROSES_PER_PLAYER,
    hasSkull: true,
    stack: [],
    points: 0,
    eliminated: false,
  }))

  return {
    players,
    phase: 'placing',
    round: 1,
    startPlayerIndex: 0,
    currentPlayerIndex: 0,
    highestBid: 0,
    highestBidderIndex: null,
    passed: [],
    flipped: {},
    rosesFlipped: 0,
    revealLog: [],
    pendingLoss: null,
    winner: null,
    log: ['Manche 1 — chaque joueur pose un disque face cachée.'],
  }
}
