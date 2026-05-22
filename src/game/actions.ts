import type { DiskColor, PlayerId } from './types'

export type GameAction =
  | { type: 'PLACE_DISK'; color: DiskColor }
  | { type: 'START_BID'; amount: number }
  | { type: 'BID'; amount: number }
  | { type: 'PASS' }
  | { type: 'FLIP'; targetId: PlayerId }
  | { type: 'DISCARD'; color: DiskColor }
  | { type: 'NEXT_ROUND' }
