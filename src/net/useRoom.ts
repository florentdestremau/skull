import { useEffect, useRef, useState } from 'react'
import type { GameAction } from '../game/actions'
import type { PublicRoom, ServerMessage } from './types'

export interface UseRoomResult {
  room: PublicRoom | null
  myPlayerId: string | null
  connected: boolean
  lastError: string | null
  sendAction: (a: GameAction) => void
}

export function useRoom(roomId: string | null, token: string | null): UseRoomResult {
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(0)

  useEffect(() => {
    if (!roomId || !token) return
    let cancelled = false
    let timer: number | undefined

    function connect() {
      if (cancelled) return
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(
        `${proto}//${location.host}/ws/${roomId}?token=${encodeURIComponent(token!)}`,
      )
      wsRef.current = ws
      ws.onopen = () => {
        retryRef.current = 0
        setConnected(true)
      }
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerMessage
          if (msg.type === 'ROOM') {
            setRoom(msg.room)
            setMyPlayerId(msg.myPlayerId)
          } else if (msg.type === 'ERROR') {
            setLastError(msg.message)
          }
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (cancelled) return
        retryRef.current = Math.min(retryRef.current + 1, 6)
        timer = window.setTimeout(connect, 500 * 2 ** retryRef.current)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [roomId, token])

  function sendAction(action: GameAction) {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLastError('Non connecté')
      return
    }
    setLastError(null)
    ws.send(JSON.stringify({ type: 'ACTION', action }))
  }

  return { room, myPlayerId, connected, lastError, sendAction }
}
