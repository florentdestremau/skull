export type DiskColor = 'rose' | 'skull'

export type PlayerId = string

export type Phase =
  | 'placing' // chaque joueur pose son disque de départ
  | 'playing' // poser un disque ou lancer une enchère
  | 'bidding' // surenchérir ou passer
  | 'revealing' // le plus offrant retourne les disques
  | 'discarding' // un disque doit être défaussé suite à un crâne
  | 'gameover'

export interface Player {
  id: PlayerId
  name: string
  color: string
  roses: number // disques fleur possédés (départ: 3)
  hasSkull: boolean // possède encore son disque crâne (départ: true)
  stack: DiskColor[] // disques posés cette manche, index 0 = bas de pile
  points: number // enchères réussies
  eliminated: boolean
}

export interface PendingLoss {
  challengerId: PlayerId
  skullOwnerId: PlayerId // propriétaire du crâne retourné
  byRandom: boolean // true = crâne d'un adversaire (défausse au hasard)
}

export interface GameState {
  players: Player[]
  phase: Phase
  round: number
  startPlayerIndex: number
  currentPlayerIndex: number
  // enchères
  highestBid: number
  highestBidderIndex: number | null
  passed: PlayerId[]
  // résolution
  flipped: Record<PlayerId, number> // disques retournés depuis le haut de chaque pile
  rosesFlipped: number
  revealLog: { playerId: PlayerId; color: DiskColor }[]
  pendingLoss: PendingLoss | null
  // fin
  winner: PlayerId | null
  log: string[]
}

export const POINTS_TO_WIN = 2
export const ROSES_PER_PLAYER = 3
