import { describe, it, expect } from 'vitest'
import { createInitialState } from '../setup'
import { reducer } from '../reducer'
import type { GameAction } from '../actions'
import type { GameState } from '../types'

function play(state: GameState, ...actions: GameAction[]): GameState {
  let s = state
  for (const a of actions) {
    const next = reducer(s, a)
    expect(next, `action ${JSON.stringify(a)} a été rejetée`).not.toBe(s)
    s = next
  }
  return s
}

describe('mise en place', () => {
  it('démarre en phase placing avec 3 joueurs', () => {
    const s = createInitialState(['A', 'B', 'C'])
    expect(s.phase).toBe('placing')
    expect(s.players).toHaveLength(3)
    expect(s.players[0].roses).toBe(3)
    expect(s.players[0].hasSkull).toBe(true)
  })
})

describe('phase placing', () => {
  it('passe en playing quand tous ont posé un disque', () => {
    let s = createInitialState(['A', 'B', 'C'])
    s = play(s,
      { type: 'PLACE_DISK', color: 'rose' },
      { type: 'PLACE_DISK', color: 'rose' },
    )
    expect(s.phase).toBe('placing')
    s = play(s, { type: 'PLACE_DISK', color: 'rose' })
    expect(s.phase).toBe('playing')
    expect(s.currentPlayerIndex).toBe(0)
  })

  it('refuse de poser deux fois durant placing', () => {
    let s = createInitialState(['A', 'B', 'C'])
    s = play(s, { type: 'PLACE_DISK', color: 'rose' })
    // p0 a déjà posé, c'est au tour de p1 ; p0 ne peut pas rejouer
    expect(reducer(s, { type: 'START_BID', amount: 1 })).toBe(s)
  })
})

function reachPlaying(names: string[], colors: ('rose' | 'skull')[]): GameState {
  let s = createInitialState(names)
  for (const c of colors) s = reducer(s, { type: 'PLACE_DISK', color: c })
  expect(s.phase).toBe('playing')
  return s
}

describe('enchères et tentative réussie', () => {
  it('un défi suivi de passes mène à une réussite sur ses propres fleurs', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['rose', 'rose', 'rose'])
    s = play(s,
      { type: 'START_BID', amount: 1 },
      { type: 'PASS' },
      { type: 'PASS' },
    )
    expect(s.players[0].points).toBe(1)
    expect(s.phase).toBe('placing')
    expect(s.round).toBe(2)
    expect(s.startPlayerIndex).toBe(0)
  })

  it('le Challenger doit retourner les piles adverses si son défi dépasse sa pile', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['rose', 'rose', 'rose'])
    s = play(s, { type: 'START_BID', amount: 2 }, { type: 'PASS' }, { type: 'PASS' })
    expect(s.phase).toBe('revealing')
    expect(s.rosesFlipped).toBe(1)
    s = play(s, { type: 'FLIP', targetId: 'p1' })
    expect(s.players[0].points).toBe(1)
  })
})

describe('tentative échouée', () => {
  it('retourner son propre crâne déclenche une défausse choisie', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['skull', 'rose', 'rose'])
    s = play(s, { type: 'START_BID', amount: 1 }, { type: 'PASS' }, { type: 'PASS' })
    expect(s.phase).toBe('discarding')
    expect(s.pendingLoss).not.toBeNull()
    expect(s.pendingLoss!.byRandom).toBe(false)
    s = play(s, { type: 'DISCARD', color: 'rose' })
    expect(s.players[0].roses).toBe(2)
    expect(s.phase).toBe('placing')
  })

  it('retourner le crâne adverse déclenche une défausse au hasard', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['rose', 'skull', 'rose'])
    s = play(s, { type: 'START_BID', amount: 2 }, { type: 'PASS' }, { type: 'PASS' })
    // p0 retourne sa fleur, puis le crâne de p1
    s = play(s, { type: 'FLIP', targetId: 'p1' })
    expect(s.phase).toBe('discarding')
    expect(s.pendingLoss!.byRandom).toBe(true)
    expect(s.pendingLoss!.skullOwnerId).toBe('p1')
  })
})

describe('élimination et victoire', () => {
  it('un joueur perdant son dernier disque est éliminé', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['skull', 'rose', 'rose'])
    s.players[0].roses = 0 // p0 n'a plus que son crâne
    s = play(s, { type: 'START_BID', amount: 1 }, { type: 'PASS' }, { type: 'PASS' })
    expect(s.phase).toBe('discarding')
    s = play(s, { type: 'DISCARD', color: 'skull' })
    expect(s.players[0].eliminated).toBe(true)
  })

  it('victoire au 2e défi réussi', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['rose', 'rose', 'rose'])
    s.players[0].points = 1
    s = play(s, { type: 'START_BID', amount: 1 }, { type: 'PASS' }, { type: 'PASS' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('p0')
  })

  it('victoire quand il ne reste qu un joueur', () => {
    let s = reachPlaying(['A', 'B'], ['skull', 'rose'])
    s.players[0].roses = 0
    s = play(s, { type: 'START_BID', amount: 1 }, { type: 'PASS' })
    s = play(s, { type: 'DISCARD', color: 'skull' })
    expect(s.phase).toBe('gameover')
    expect(s.winner).toBe('p1')
  })
})

describe('garde-fous', () => {
  it('refuse un défi de zéro', () => {
    const s = reachPlaying(['A', 'B', 'C'], ['rose', 'rose', 'rose'])
    expect(reducer(s, { type: 'START_BID', amount: 0 })).toBe(s)
  })

  it('refuse un défi supérieur au total de disques', () => {
    const s = reachPlaying(['A', 'B', 'C'], ['rose', 'rose', 'rose'])
    expect(reducer(s, { type: 'START_BID', amount: 4 })).toBe(s)
  })

  it('refuse une surenchère non supérieure', () => {
    let s = reachPlaying(['A', 'B', 'C'], ['rose', 'rose', 'rose'])
    s = reducer(s, { type: 'START_BID', amount: 2 })
    expect(reducer(s, { type: 'BID', amount: 2 })).toBe(s)
  })
})
