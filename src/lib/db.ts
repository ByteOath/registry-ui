import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'

let _db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (_db) return _db

  const dbPath = process.env.DB_PATH ||
    (process.env.NODE_ENV === 'production'
      ? '/data/registry-ui.db'
      : path.join(process.cwd(), 'data', 'registry-ui.db'))
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      url         TEXT    NOT NULL,
      username    TEXT    NOT NULL DEFAULT '',
      password    TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10)
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(adminUsername, hash, 'admin')
  }

  // Add environment column if missing (migration for existing DBs)
  try { db.exec("ALTER TABLE registries ADD COLUMN environment TEXT NOT NULL DEFAULT 'production'") } catch {}

  _db = db
  return db
}

export default { prepare: (sql: string) => getDb().prepare(sql), exec: (sql: string) => getDb().exec(sql) }
