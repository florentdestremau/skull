import { createInitialState } from '../src/game/setup'
import { reducer } from '../src/game/reducer'
import { pendingAutoAction, actingPlayerId } from '../src/game/auto'
import type { GameAction } from '../src/game/actions'
import type { DiskColor, GameState } from '../src/game/types'
import { saveRoom, loadRoom, loadAllRooms, pruneOldRooms } from './db'

export type Slot = { playerId: string; token: string; name: string; color: string }

export type Room = {
  id: string
  host: string
  slots: Slot[]
  state: GameState | null
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
const MAX_SLOTS = 6
const MIN_SLOTS = 3
const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_NAME_LEN = 20

const rooms = new Map<string, Room>()

function genId(len: number): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += alpha[Math.floor(Math.random() * alpha.length)]
  return s
}

function genToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function persist(room: Room) {
  saveRoom(room.id, JSON.stringify(room))
}

export function loadRoomsFromDisk() {
  for (const { id, json } of loadAllRooms()) {
    try {
      rooms.set(id, JSON.parse(json) as Room)
    } catch {
      /* ignore les lignes corrompues */
    }
  }
}

export function getRoom(id: string): Room | null {
  const inMem = rooms.get(id)
  if (inMem) return inMem
  const raw = loadRoom(id)
  if (!raw) return null
  try {
    const r = JSON.parse(raw) as Room
    rooms.set(id, r)
    return r
  } catch {
    return null
  }
}

export function createRoom(hostName: string): { room: Room; token: string; playerId: string } {
  pruneOldRooms(ROOM_TTL_MS)
  let id = genId(5)
  while (getRoom(id)) id = genId(5)
  const playerId = 'p0'
  const token = genToken()
  const name = hostName.slice(0, MAX_NAME_LEN) || 'Joueur 1'
  const room: Room = {
    id,
    host: playerId,
    slots: [{ playerId, token, name, color: PLAYER_COLORS[0] }],
    state: null,
  }
  rooms.set(id, room)
  persist(room)
  return { room, token, playerId }
}

export function joinRoom(
  id: string,
  name: string,
  existingToken?: string,
): { room: Room; token: string; playerId: string } | { error: string } {
  const room = getRoom(id)
  if (!room) return { error: 'Partie introuvable' }

  if (existingToken) {
    const found = room.slots.find(s => s.token === existingToken)
    if (found) return { room, token: found.token, playerId: found.playerId }
  }

  if (room.state !== null) return { error: 'Partie déjà démarrée' }
  if (room.slots.length >= MAX_SLOTS) return { error: 'Partie complète (6 joueurs)' }

  const playerId = `p${room.slots.length}`
  const token = genToken()
  room.slots.push({
    playerId,
    token,
    name: name.slice(0, MAX_NAME_LEN) || `Joueur ${room.slots.length + 1}`,
    color: PLAYER_COLORS[room.slots.length],
  })
  persist(room)
  return { room, token, playerId }
}

export function renameSlot(id: string, token: string, name: string): Room | { error: string } {
  const room = getRoom(id)
  if (!room) return { error: 'Partie introuvable' }
  const slot = room.slots.find(s => s.token === token)
  if (!slot) return { error: 'Token invalide' }
  if (room.state !== null) return { error: 'Partie déjà démarrée' }
  slot.name = name.slice(0, 20) || slot.name
  persist(room)
  return room
}

export function startRoom(id: string, token: string): Room | { error: string } {
  const room = getRoom(id)
  if (!room) return { error: 'Partie introuvable' }
  const slot = room.slots.find(s => s.token === token)
  if (!slot) return { error: 'Token invalide' }
  if (slot.playerId !== room.host) return { error: "Seul l'hôte peut démarrer" }
  if (room.slots.length < MIN_SLOTS) return { error: 'Il faut au moins 3 joueurs' }
  if (room.state !== null) return { error: 'Déjà démarré' }

  const state = createInitialState(room.slots.map(s => s.name))
  state.players = state.players.map((p, i) => ({
    ...p,
    id: room.slots[i].playerId,
    color: room.slots[i].color,
  }))
  room.state = state
  persist(room)
  return room
}

export function applyAction(
  id: string,
  token: string,
  action: GameAction,
): Room | { error: string } {
  const room = getRoom(id)
  if (!room) return { error: 'Partie introuvable' }
  if (!room.state) return { error: 'Partie pas encore démarrée' }
  const slot = room.slots.find(s => s.token === token)
  if (!slot) return { error: 'Token invalide' }

  if (actingPlayerId(room.state) !== slot.playerId) {
    return { error: "Ce n'est pas votre tour" }
  }

  // empêche un joueur de choisir son disque quand la défausse est au hasard
  if (action.type === 'DISCARD' && room.state.pendingLoss?.byRandom) {
    return { error: 'Défausse au hasard en cours' }
  }

  let next = reducer(room.state, action)
  if (next === room.state) return { error: 'Action invalide' }

  // résout automatiquement les défausses au hasard
  let auto = pendingAutoAction(next)
  let guard = 0
  while (auto && guard++ < 10) {
    next = reducer(next, auto)
    auto = pendingAutoAction(next)
  }

  room.state = next
  persist(room)
  return room
}

export function slotForToken(room: Room, token: string): Slot | undefined {
  return room.slots.find(s => s.token === token)
}

/**
 * Masque l'information secrète avant d'envoyer l'état à un client :
 * - couleurs des disques non retournés des autres joueurs,
 * - composition (fleurs/crâne) des autres joueurs — seul le total est public.
 * Le moteur conserve l'état complet côté serveur ; seule la diffusion est filtrée.
 */
function redactState(state: GameState, viewerId?: string): GameState {
  const s = structuredClone(state)
  for (const p of s.players) {
    if (p.id === viewerId) continue
    const flips = s.flipped[p.id] ?? 0
    const len = p.stack.length
    p.stack = p.stack.map((color, i) => {
      const revealed = i > len - 1 - flips
      return revealed ? color : ('rose' as DiskColor)
    })
    // total de disques préservé, composition masquée
    const total = p.roses + (p.hasSkull ? 1 : 0)
    p.roses = total
    p.hasSkull = false
  }
  return s
}

export function publicRoom(room: Room, viewerId?: string) {
  return {
    id: room.id,
    host: room.host,
    slots: room.slots.map(s => ({ playerId: s.playerId, name: s.name, color: s.color })),
    state: room.state ? redactState(room.state, viewerId) : null,
  }
}
