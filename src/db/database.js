/**
 * Developed by Mohammad Rameez Imdad (Rameez Scripts)
 * WhatsApp: https://wa.me/923224083545 (For Custom Projects)
 * YouTube: https://www.youtube.com/@rameezimdad (Subscribe for more!)
 */

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const schema = `
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL UNIQUE,
    key_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'api')),
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    expires_at TEXT,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    wa_message_id TEXT UNIQUE,
    recipient TEXT NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    message_json TEXT,
    status TEXT NOT NULL,
    error TEXT,
    api_key_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    event TEXT NOT NULL,
    request_id TEXT,
    api_key_id TEXT,
    context_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS whatsapp_auth (
    session_id TEXT NOT NULL DEFAULT 'main',
    category TEXT NOT NULL,
    id TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, category, id)
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_prefix_active
    ON api_keys(key_prefix, revoked_at, expires_at);
  CREATE INDEX IF NOT EXISTS idx_messages_wa_id
    ON messages(wa_message_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created
    ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_created
    ON logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_category
    ON logs(category, created_at);
`

const addColumnIfMissing = (db, table, column, definition) => {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column)
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

export const createDatabase = file => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  // Migration for whatsapp_auth if needed (before running schema)
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='whatsapp_auth'").get()
  if (tableExists) {
    const hasSessionId = db.prepare("PRAGMA table_info(whatsapp_auth)").all().some(row => row.name === 'session_id')
    if (!hasSessionId) {
      db.transaction(() => {
        db.exec(`
          ALTER TABLE whatsapp_auth RENAME TO whatsapp_auth_old;
          CREATE TABLE whatsapp_auth (
            session_id TEXT NOT NULL DEFAULT 'main',
            category TEXT NOT NULL,
            id TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (session_id, category, id)
          );
          INSERT INTO whatsapp_auth (session_id, category, id, value, updated_at)
          SELECT 'main', category, id, value, updated_at FROM whatsapp_auth_old;
          DROP TABLE whatsapp_auth_old;
        `)
      })()
    }
  }

  db.exec(schema)
  addColumnIfMissing(db, 'messages', 'message_json', 'TEXT')
  addColumnIfMissing(db, 'messages', 'session_id', "TEXT NOT NULL DEFAULT 'main'")
  return db
}
