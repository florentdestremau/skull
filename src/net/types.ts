import type { GameState } from '../game/types'

export type PublicSlot = { playerId: string; name: string; color: string }

export type PublicRoom = {
  id: string
  host: string
  slots: PublicSlot[]
  state: GameState | null
}

export type ServerMessage =
  | { type: 'ROOM'; room: PublicRoom; myPlayerId: string }
  | { type: 'ERROR'; message: string }
