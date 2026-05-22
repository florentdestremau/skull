import type { GameAction } from './actions'
import type { DiskColor, GameState } from './types'
import { POINTS_TO_WIN } from './types'
import {
  activePlayers,
  diskCount,
  handHasSkull,
  handRoses,
  nextActiveIndex,
  nextBidderIndex,
  totalDisksOnTable,
} from './rules'

/**
 * Reducer pur du jeu Skull. Retourne le même objet `state` (référence) si
 * l'action est invalide — le caller détecte cela pour signaler une erreur.
 */
export function reducer(state: GameState, action: GameAction): GameState {
  if (state.phase === 'gameover') return state

  switch (action.type) {
    case 'PLACE_DISK':
      return placeDisk(state, action.color)
    case 'START_BID':
      return startBid(state, action.amount)
    case 'BID':
      return raiseBid(state, action.amount)
    case 'PASS':
      return pass(state)
    case 'FLIP':
      return flip(state, action.targetId)
    case 'DISCARD':
      return discard(state, action.color)
    default:
      return state
  }
}

function placeDisk(state: GameState, color: DiskColor): GameState {
  if (state.phase !== 'placing' && state.phase !== 'playing') return state
  const player = state.players[state.currentPlayerIndex]
  if (player.eliminated) return state
  if (color === 'rose' && handRoses(player) <= 0) return state
  if (color === 'skull' && !handHasSkull(player)) return state

  const next = structuredClone(state)
  const cur = next.players[next.currentPlayerIndex]
  cur.stack.push(color)
  next.log = [`${cur.name} pose un disque.`, ...next.log].slice(0, 40)

  if (next.phase === 'placing') {
    const placed = activePlayers(next).filter(p => p.stack.length >= 1).length
    if (placed >= activePlayers(next).length) {
      next.phase = 'playing'
      next.currentPlayerIndex = next.startPlayerIndex
      next.log = ['Tous les disques de départ sont posés.', ...next.log].slice(0, 40)
    } else {
      next.currentPlayerIndex = nextActiveIndex(next, next.currentPlayerIndex)
    }
  } else {
    next.currentPlayerIndex = nextActiveIndex(next, next.currentPlayerIndex)
  }
  return next
}

function startBid(state: GameState, amount: number): GameState {
  if (state.phase !== 'playing') return state
  const total = totalDisksOnTable(state)
  if (!Number.isInteger(amount) || amount < 1 || amount > total) return state

  const next = structuredClone(state)
  const challenger = next.players[next.currentPlayerIndex]
  next.phase = 'bidding'
  next.highestBid = amount
  next.highestBidderIndex = next.currentPlayerIndex
  next.passed = []
  next.log = [`${challenger.name} lance un défi à ${amount}.`, ...next.log].slice(0, 40)

  if (amount >= total) return startReveal(next)

  next.currentPlayerIndex = nextBidderIndex(next, next.currentPlayerIndex)
  if (next.currentPlayerIndex === next.highestBidderIndex) return startReveal(next)
  return next
}

function raiseBid(state: GameState, amount: number): GameState {
  if (state.phase !== 'bidding') return state
  const total = totalDisksOnTable(state)
  if (!Number.isInteger(amount) || amount <= state.highestBid || amount > total) return state

  const next = structuredClone(state)
  const bidder = next.players[next.currentPlayerIndex]
  next.highestBid = amount
  next.highestBidderIndex = next.currentPlayerIndex
  next.log = [`${bidder.name} surenchérit à ${amount}.`, ...next.log].slice(0, 40)

  if (amount >= total) return startReveal(next)

  next.currentPlayerIndex = nextBidderIndex(next, next.currentPlayerIndex)
  if (next.currentPlayerIndex === next.highestBidderIndex) return startReveal(next)
  return next
}

function pass(state: GameState): GameState {
  if (state.phase !== 'bidding') return state
  const player = state.players[state.currentPlayerIndex]
  if (state.currentPlayerIndex === state.highestBidderIndex) return state
  if (state.passed.includes(player.id)) return state

  const next = structuredClone(state)
  next.passed = [...next.passed, player.id]
  next.log = [`${player.name} passe.`, ...next.log].slice(0, 40)

  const remaining = activePlayers(next).filter(p => !next.passed.includes(p.id))
  if (remaining.length <= 1) return startReveal(next)

  next.currentPlayerIndex = nextBidderIndex(next, next.currentPlayerIndex)
  if (next.currentPlayerIndex === next.highestBidderIndex) return startReveal(next)
  return next
}

/** Entre en phase de tentative et retourne d'office toute la pile du Challenger. */
function startReveal(state: GameState): GameState {
  state.phase = 'revealing'
  const idx = state.highestBidderIndex!
  state.currentPlayerIndex = idx
  state.flipped = {}
  for (const p of state.players) state.flipped[p.id] = 0
  state.rosesFlipped = 0
  state.revealLog = []

  const challenger = state.players[idx]
  state.log = [`${challenger.name} doit retourner ${state.highestBid} disque(s).`, ...state.log].slice(0, 40)

  for (let k = challenger.stack.length - 1; k >= 0; k--) {
    const disk = challenger.stack[k]
    state.flipped[challenger.id]++
    state.revealLog.push({ playerId: challenger.id, color: disk })
    if (disk === 'skull') {
      return fail(state, challenger.id)
    }
    state.rosesFlipped++
    state.log = [`${challenger.name} retourne une de ses fleurs.`, ...state.log].slice(0, 40)
    if (state.rosesFlipped >= state.highestBid) return succeed(state)
  }
  return state
}

function flip(state: GameState, targetId: string): GameState {
  if (state.phase !== 'revealing') return state
  if (state.currentPlayerIndex !== state.highestBidderIndex) return state
  const challenger = state.players[state.highestBidderIndex!]
  if (targetId === challenger.id) return state
  const target = state.players.find(p => p.id === targetId)
  if (!target || target.eliminated) return state
  const done = state.flipped[targetId] ?? 0
  if (done >= target.stack.length) return state

  const next = structuredClone(state)
  const tgt = next.players.find(p => p.id === targetId)!
  const diskIndex = tgt.stack.length - 1 - done
  const disk = tgt.stack[diskIndex]
  next.flipped[targetId] = done + 1
  next.revealLog.push({ playerId: targetId, color: disk })

  if (disk === 'skull') {
    next.log = [`${next.players[next.highestBidderIndex!].name} retourne le crâne de ${tgt.name} !`, ...next.log].slice(0, 40)
    return fail(next, targetId)
  }
  next.rosesFlipped++
  next.log = [`Une fleur de ${tgt.name} est retournée.`, ...next.log].slice(0, 40)
  if (next.rosesFlipped >= next.highestBid) return succeed(next)
  return next
}

function succeed(state: GameState): GameState {
  const idx = state.highestBidderIndex!
  const challenger = state.players[idx]
  challenger.points++
  state.log = [`✅ ${challenger.name} réussit son défi (${challenger.points}/${POINTS_TO_WIN}).`, ...state.log].slice(0, 40)

  if (challenger.points >= POINTS_TO_WIN) {
    state.phase = 'gameover'
    state.winner = challenger.id
    state.log = [`🏆 ${challenger.name} remporte la partie !`, ...state.log].slice(0, 40)
    return state
  }
  return startNewRound(state, idx)
}

function fail(state: GameState, skullOwnerId: string): GameState {
  const idx = state.highestBidderIndex!
  const challenger = state.players[idx]
  state.phase = 'discarding'
  state.currentPlayerIndex = idx
  state.pendingLoss = {
    challengerId: challenger.id,
    skullOwnerId,
    byRandom: skullOwnerId !== challenger.id,
  }
  state.log = [`💀 Crâne retourné ! ${challenger.name} échoue et perd un disque.`, ...state.log].slice(0, 40)
  return state
}

function discard(state: GameState, color: DiskColor): GameState {
  if (state.phase !== 'discarding' || !state.pendingLoss) return state
  const challenger = state.players.find(p => p.id === state.pendingLoss!.challengerId)
  if (!challenger) return state
  if (color === 'rose' && challenger.roses <= 0) return state
  if (color === 'skull' && !challenger.hasSkull) return state

  const next = structuredClone(state)
  const loss = next.pendingLoss!
  const ch = next.players.find(p => p.id === loss.challengerId)!
  if (color === 'rose') ch.roses--
  else ch.hasSkull = false

  const challengerIndex = next.players.findIndex(p => p.id === ch.id)
  if (diskCount(ch) <= 0) {
    ch.eliminated = true
    ch.stack = []
    next.log = [`${ch.name} perd son dernier disque et est éliminé.`, ...next.log].slice(0, 40)
  } else {
    next.log = [`${ch.name} défausse un disque.`, ...next.log].slice(0, 40)
  }

  const actives = activePlayers(next)
  if (actives.length === 1) {
    next.phase = 'gameover'
    next.winner = actives[0].id
    next.pendingLoss = null
    next.log = [`🏆 ${actives[0].name} remporte la partie !`, ...next.log].slice(0, 40)
    return next
  }

  let startIdx = challengerIndex
  if (ch.eliminated) {
    const skullOwnerIdx = next.players.findIndex(p => p.id === loss.skullOwnerId)
    startIdx =
      loss.skullOwnerId !== ch.id && skullOwnerIdx >= 0 && !next.players[skullOwnerIdx].eliminated
        ? skullOwnerIdx
        : nextActiveIndex(next, challengerIndex)
  }
  return startNewRound(next, startIdx)
}

function startNewRound(state: GameState, startIdx: number): GameState {
  state.round++
  for (const p of state.players) p.stack = []
  state.flipped = {}
  state.rosesFlipped = 0
  state.revealLog = []
  state.passed = []
  state.highestBid = 0
  state.highestBidderIndex = null
  state.pendingLoss = null
  let idx = startIdx
  if (state.players[idx].eliminated) idx = nextActiveIndex(state, idx)
  state.startPlayerIndex = idx
  state.currentPlayerIndex = idx
  state.phase = 'placing'
  state.log = [`— Manche ${state.round} — ${state.players[idx].name} ouvre.`, ...state.log].slice(0, 40)
  return state
}
