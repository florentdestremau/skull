import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'

const STORAGE_DIR = process.env.STORAGE_DIR ?? '/storage'

try {
  mkdirSync(STORAGE_DIR, { recursive: true })
} catch {
  /* le dossier existe déjà */
}

export const db = new Database(`${STORAGE_DIR}/skull.db`)
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

export function saveRoom(id: string, json: string) {
  db.prepare(
    'INSERT INTO rooms(id, json, updated_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at',
  ).run(id, json, Date.now())
}

export function loadRoom(id: string): string | null {
  const row = db.prepare('SELECT json FROM rooms WHERE id = ?').get(id) as
    | { json: string }
    | undefined
  return row?.json ?? null
}

export function loadAllRooms(): Array<{ id: string; json: string }> {
  return db
    .prepare('SELECT id, json FROM rooms ORDER BY updated_at DESC LIMIT 500')
    .all() as Array<{ id: string; json: string }>
}
