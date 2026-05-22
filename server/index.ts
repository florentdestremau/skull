import { file } from 'bun'
import { join } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import {
  createRoom,
  joinRoom,
  startRoom,
  renameSlot,
  applyAction,
  getRoom,
  publicRoom,
  slotForToken,
  loadRoomsFromDisk,
} from './rooms'
import type { GameAction } from '../src/game/actions'

loadRoomsFromDisk()

const PORT = Number(process.env.PORT ?? 80)
const DIST_DIR = process.env.DIST_DIR ?? join(import.meta.dir, '..', 'dist')

type WsData = { roomId: string; token: string; playerId: string }
const rooms = new Map<string, Set<import('bun').ServerWebSocket<WsData>>>()

function broadcast(roomId: string) {
  const room = getRoom(roomId)
  if (!room) return
  const sockets = rooms.get(roomId)
  if (!sockets) return
  for (const ws of sockets) {
    // état filtré par destinataire : chacun ne reçoit que ses propres secrets
    const pub = publicRoom(room, ws.data.playerId)
    ws.send(JSON.stringify({ type: 'ROOM', room: pub, myPlayerId: ws.data.playerId }))
  }
}

function cors(res: Response): Response {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}

async function parseJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveStatic(pathname: string): Response {
  const safe = pathname.replace(/\.\./g, '').replace(/^\/+/, '')
  for (const p of [safe, 'index.html']) {
    const fp = join(DIST_DIR, p)
    if (existsSync(fp) && statSync(fp).isFile()) {
      const ext = fp.slice(fp.lastIndexOf('.'))
      return new Response(file(fp), {
        headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' },
      })
    }
  }
  return new Response('Not found', { status: 404 })
}

const server = Bun.serve<WsData, undefined>({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }))
    if (url.pathname === '/up') return new Response('OK', { status: 200 })

    if (url.pathname.startsWith('/ws/')) {
      const roomId = url.pathname.slice('/ws/'.length)
      const token = url.searchParams.get('token') ?? ''
      const room = getRoom(roomId)
      if (!room) return new Response('Partie introuvable', { status: 404 })
      const slot = slotForToken(room, token)
      if (!slot) return new Response('Token invalide', { status: 401 })
      const ok = srv.upgrade(req, { data: { roomId, token, playerId: slot.playerId } })
      return ok ? (undefined as unknown as Response) : new Response('Upgrade failed', { status: 500 })
    }

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const body = (await parseJson<{ name?: string }>(req)) ?? {}
      const { room, token, playerId } = createRoom(body.name ?? '')
      return cors(Response.json({ roomId: room.id, token, playerId }))
    }

    const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/)
    if (joinMatch && req.method === 'POST') {
      const body = (await parseJson<{ name?: string; token?: string }>(req)) ?? {}
      const res = joinRoom(joinMatch[1], body.name ?? '', body.token)
      if ('error' in res) return cors(Response.json({ error: res.error }, { status: 400 }))
      broadcast(joinMatch[1])
      return cors(Response.json({ roomId: res.room.id, token: res.token, playerId: res.playerId }))
    }

    const renameMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/rename$/)
    if (renameMatch && req.method === 'POST') {
      const body = await parseJson<{ token: string; name: string }>(req)
      if (!body) return cors(Response.json({ error: 'bad body' }, { status: 400 }))
      const res = renameSlot(renameMatch[1], body.token, body.name)
      if ('error' in res) return cors(Response.json({ error: res.error }, { status: 400 }))
      broadcast(renameMatch[1])
      return cors(Response.json({ ok: true }))
    }

    const startMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/start$/)
    if (startMatch && req.method === 'POST') {
      const body = await parseJson<{ token: string }>(req)
      if (!body) return cors(Response.json({ error: 'bad body' }, { status: 400 }))
      const res = startRoom(startMatch[1], body.token)
      if ('error' in res) return cors(Response.json({ error: res.error }, { status: 400 }))
      broadcast(startMatch[1])
      return cors(Response.json({ ok: true }))
    }

    const getMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)$/)
    if (getMatch && req.method === 'GET') {
      const room = getRoom(getMatch[1])
      if (!room) return cors(Response.json({ error: 'Partie introuvable' }, { status: 404 }))
      return cors(Response.json({ room: publicRoom(room) }))
    }

    if (req.method === 'GET') return serveStatic(url.pathname)
    return new Response('Not found', { status: 404 })
  },
  websocket: {
    open(ws) {
      const { roomId } = ws.data
      let set = rooms.get(roomId)
      if (!set) {
        set = new Set()
        rooms.set(roomId, set)
      }
      set.add(ws)
      const room = getRoom(roomId)
      if (room) {
        ws.send(
          JSON.stringify({
            type: 'ROOM',
            room: publicRoom(room, ws.data.playerId),
            myPlayerId: ws.data.playerId,
          }),
        )
      }
    },
    close(ws) {
      const set = rooms.get(ws.data.roomId)
      set?.delete(ws)
      if (set && set.size === 0) rooms.delete(ws.data.roomId)
    },
    message(ws, raw) {
      try {
        const msg = JSON.parse(String(raw)) as { type: string; action?: GameAction }
        if (msg.type === 'ACTION' && msg.action) {
          const res = applyAction(ws.data.roomId, ws.data.token, msg.action)
          if ('error' in res) {
            ws.send(JSON.stringify({ type: 'ERROR', message: res.error }))
            return
          }
          broadcast(ws.data.roomId)
        }
      } catch {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'message invalide' }))
      }
    },
  },
})

console.log(`Skull server listening on :${server.port}`)
