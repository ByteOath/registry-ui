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
      role          TEXT    NOT NULL DEFAULT 'viewer' CHECK(role IN ('super_admin','admin','viewer')),
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

  // Migration: add super_admin role for existing DBs
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined
    if (tableInfo?.sql && !tableInfo.sql.includes('super_admin')) {
      // Old schema detected, recreate table with new constraint
      db.exec(`
        CREATE TABLE users_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          username      TEXT    NOT NULL UNIQUE,
          password_hash TEXT    NOT NULL,
          role          TEXT    NOT NULL DEFAULT 'viewer' CHECK(role IN ('super_admin','admin','viewer')),
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO users_new SELECT * FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `)
      // Update seeded admin to super_admin
      const adminUsername = process.env.ADMIN_USERNAME || 'admin'
      db.prepare("UPDATE users SET role = 'super_admin' WHERE username = ?").run(adminUsername)
    }
  } catch {}

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[SECURITY] ADMIN_PASSWORD env var not set — using default "admin". Change immediately.')
  }
  const existing = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(adminUsername) as { id: number; password_hash: string } | undefined
  if (!existing) {
    // First run: seed super_admin
    const hash = bcrypt.hashSync(adminPassword, 10)
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(adminUsername, hash, 'super_admin')
  } else if (process.env.ADMIN_PASSWORD && !bcrypt.compareSync(adminPassword, existing.password_hash)) {
    // ADMIN_PASSWORD explicitly set and differs from stored hash — sync it
    const hash = bcrypt.hashSync(adminPassword, 10)
    db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE username = ?').run(hash, 'super_admin', adminUsername)
    console.log(`[INFO] super_admin password updated from ADMIN_PASSWORD env var.`)
  }

  // Add environment column if missing (migration for existing DBs)
  try { db.exec("ALTER TABLE registries ADD COLUMN environment TEXT NOT NULL DEFAULT 'production'") } catch {}

  _db = db
  return db
}

export default { prepare: (sql: string) => getDb().prepare(sql), exec: (sql: string) => getDb().exec(sql) }
