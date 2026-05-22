import { useState } from 'react'
import type { GameAction } from '../game/actions'
import type { DiskColor, GameState, Player } from '../game/types'
import { POINTS_TO_WIN } from '../game/types'
import {
  diskCount,
  handHasSkull,
  handRoses,
  totalDisksOnTable,
} from '../game/rules'
import { actingPlayerId } from '../game/auto'

const PHASE_LABEL: Record<GameState['phase'], string> = {
  placing: 'Pose des disques de départ',
  playing: 'Ajout de disque ou défi',
  bidding: 'Enchères',
  revealing: 'Tentative en cours',
  discarding: 'Défausse',
  gameover: 'Partie terminée',
}

interface Props {
  state: GameState
  viewerId: string | null
  onAction: (a: GameAction) => void
  error?: string | null
  isLocal?: boolean
}

export default function GameBoard({ state, viewerId, onAction, error, isLocal }: Props) {
  const acting = actingPlayerId(state)
  const actor = state.players.find(p => p.id === acting) ?? null
  const canAct = state.phase !== 'gameover' && (isLocal === true || viewerId === acting)
  const challenger =
    state.highestBidderIndex != null ? state.players[state.highestBidderIndex] : null

  return (
    <div>
      <div className="row spread">
        <span className="meta">Manche {state.round}</span>
        <strong>{PHASE_LABEL[state.phase]}</strong>
        <span className="meta">{totalDisksOnTable(state)} disques en jeu</span>
      </div>

      <div className="players">
        {state.players.map(p => (
          <Mat
            key={p.id}
            player={p}
            state={state}
            viewerId={viewerId}
            isCurrent={p.id === acting}
            isActing={p.id === acting}
            canFlip={canAct && state.phase === 'revealing'}
            challengerId={challenger?.id ?? null}
            onFlip={() => onAction({ type: 'FLIP', targetId: p.id })}
          />
        ))}
      </div>

      {error && <div className="err">{error}</div>}

      {state.phase === 'gameover' ? (
        <Gameover state={state} />
      ) : (
        <ActionPanel
          state={state}
          actor={actor}
          canAct={canAct}
          challenger={challenger}
          onAction={onAction}
        />
      )}

      <div className="log">
        {state.log.map((line, i) => (
          <div key={state.log.length - i}>{line}</div>
        ))}
      </div>
    </div>
  )
}

function Mat({
  player, state, viewerId, isCurrent, isActing, canFlip, challengerId, onFlip,
}: {
  player: Player
  state: GameState
  viewerId: string | null
  isCurrent: boolean
  isActing: boolean
  canFlip: boolean
  challengerId: string | null
  onFlip: () => void
}) {
  const flipped = state.flipped[player.id] ?? 0
  const topUnflipped = player.stack.length - 1 - flipped
  // une seule pile (la plus haute non retournée) est cliquable, et jamais la sienne
  const flippable =
    canFlip && player.id !== challengerId && flipped < player.stack.length

  const className = [
    'mat',
    isActing ? 'acting' : isCurrent ? 'current' : '',
    player.eliminated ? 'eliminated' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <div className="mat-head">
        <span className="dot" style={{ background: player.color }} />
        <span className="mat-name">{player.name}</span>
      </div>
      <div className="points">
        {'★'.repeat(player.points)}{'☆'.repeat(POINTS_TO_WIN - player.points)} défis
      </div>
      <div className="disks">
        {player.stack.length === 0 && <span className="meta">pile vide</span>}
        {player.stack.map((color, i) => {
          const isFlipped = i > player.stack.length - 1 - flipped
          const ownVisible = player.id === viewerId
          const reveal = isFlipped || ownVisible
          const isFlippableDisk = flippable && i === topUnflipped
          return (
            <Disk
              key={i}
              color={reveal ? color : null}
              flippable={isFlippableDisk}
              onClick={isFlippableDisk ? onFlip : undefined}
            />
          )
        })}
      </div>
      <div className="meta">
        {player.eliminated
          ? 'Éliminé'
          : player.id === viewerId
            ? `Tes disques : ${player.hasSkull ? '1 crâne' : '0 crâne'}, ${player.roses} fleur(s)`
            : `${diskCount(player)} disque(s)`}
      </div>
    </div>
  )
}

function Disk({
  color, flippable, small, onClick,
}: {
  color: DiskColor | null
  flippable?: boolean
  small?: boolean
  onClick?: () => void
}) {
  const cls = [
    'disk',
    color === 'rose' ? 'rose' : color === 'skull' ? 'skull' : 'back',
    flippable ? 'flippable' : '',
    small ? 'small' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} onClick={onClick}>
      {color === 'skull' ? '💀' : color === 'rose' ? '🌸' : ''}
    </div>
  )
}

function ActionPanel({
  state, actor, canAct, challenger, onAction,
}: {
  state: GameState
  actor: Player | null
  canAct: boolean
  challenger: Player | null
  onAction: (a: GameAction) => void
}) {
  if (!actor) return null

  if (!canAct) {
    return (
      <div className="action-panel">
        <div className="banner">En attente de <strong>{actor.name}</strong>…</div>
      </div>
    )
  }

  return (
    <div className="action-panel">
      <div className="banner turn">
        À <strong>{actor.name}</strong> de jouer
      </div>
      {state.phase === 'placing' && <PlaceControls actor={actor} onAction={onAction} />}
      {state.phase === 'playing' && <PlayControls state={state} actor={actor} onAction={onAction} />}
      {state.phase === 'bidding' && <BidControls state={state} onAction={onAction} />}
      {state.phase === 'revealing' && (
        <div className="banner">
          {actor.name} doit retourner des fleurs : {state.rosesFlipped}/{state.highestBid}.
          Clique une pile adverse surlignée.
        </div>
      )}
      {state.phase === 'discarding' && (
        <DiscardControls state={state} challenger={challenger} onAction={onAction} />
      )}
    </div>
  )
}

function PlaceControls({ actor, onAction }: { actor: Player; onAction: (a: GameAction) => void }) {
  return (
    <div className="row center">
      <button
        className="primary"
        disabled={handRoses(actor) <= 0}
        onClick={() => onAction({ type: 'PLACE_DISK', color: 'rose' })}
      >🌸 Poser une fleur</button>
      <button
        disabled={!handHasSkull(actor)}
        onClick={() => onAction({ type: 'PLACE_DISK', color: 'skull' })}
      >💀 Poser le crâne</button>
    </div>
  )
}

function PlayControls({
  state, actor, onAction,
}: {
  state: GameState
  actor: Player
  onAction: (a: GameAction) => void
}) {
  const total = totalDisksOnTable(state)
  const [bid, setBid] = useState(1)
  const handEmpty = handRoses(actor) <= 0 && !handHasSkull(actor)

  return (
    <div className="col">
      {!handEmpty && (
        <div className="row center">
          <button
            className="primary"
            disabled={handRoses(actor) <= 0}
            onClick={() => onAction({ type: 'PLACE_DISK', color: 'rose' })}
          >🌸 Ajouter une fleur</button>
          <button
            disabled={!handHasSkull(actor)}
            onClick={() => onAction({ type: 'PLACE_DISK', color: 'skull' })}
          >💀 Ajouter le crâne</button>
        </div>
      )}
      <div className="row center">
        {handEmpty && <span className="meta">Plus de disque en main : tu dois lancer un défi.</span>}
        <input
          type="number" min={1} max={total} value={bid}
          onChange={e => setBid(Math.max(1, Math.min(total, Number(e.target.value) || 1)))}
          style={{ width: 70 }}
        />
        <button
          className="primary"
          disabled={bid < 1 || bid > total}
          onClick={() => onAction({ type: 'START_BID', amount: bid })}
        >Lancer le défi à {bid}</button>
      </div>
    </div>
  )
}

function BidControls({ state, onAction }: { state: GameState; onAction: (a: GameAction) => void }) {
  const total = totalDisksOnTable(state)
  const min = state.highestBid + 1
  const [bid, setBid] = useState(min)
  const value = Math.max(min, Math.min(total, bid))

  return (
    <div className="row center">
      <span className="meta">Défi actuel : {state.highestBid}</span>
      {min <= total && (
        <>
          <input
            type="number" min={min} max={total} value={value}
            onChange={e => setBid(Number(e.target.value) || min)}
            style={{ width: 70 }}
          />
          <button
            className="primary"
            onClick={() => onAction({ type: 'BID', amount: value })}
          >Surenchérir à {value}</button>
        </>
      )}
      <button onClick={() => onAction({ type: 'PASS' })}>Passer</button>
    </div>
  )
}

function DiscardControls({
  state, challenger, onAction,
}: {
  state: GameState
  challenger: Player | null
  onAction: (a: GameAction) => void
}) {
  if (!state.pendingLoss) return null
  if (state.pendingLoss.byRandom) {
    return <div className="banner">Crâne adverse retourné — défausse au hasard…</div>
  }
  const ch = challenger
  if (!ch) return null
  return (
    <div className="col">
      <div className="banner">
        {ch.name} a retourné son propre crâne : choisis le disque à perdre définitivement.
      </div>
      <div className="row center">
        <button
          disabled={ch.roses <= 0}
          onClick={() => onAction({ type: 'DISCARD', color: 'rose' })}
        >🌸 Défausser une fleur</button>
        <button
          disabled={!ch.hasSkull}
          onClick={() => onAction({ type: 'DISCARD', color: 'skull' })}
        >💀 Défausser le crâne</button>
      </div>
    </div>
  )
}

function Gameover({ state }: { state: GameState }) {
  const winner = state.players.find(p => p.id === state.winner)
  return (
    <div className="banner turn">
      <h2>🏆 {winner?.name ?? '—'} remporte la partie !</h2>
    </div>
  )
}
