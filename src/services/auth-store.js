/**
 * Developed by Mohammad Rameez Imdad (Rameez Scripts)
 * WhatsApp: https://wa.me/923224083545 (For Custom Projects)
 * YouTube: https://www.youtube.com/@rameezimdad (Subscribe for more!)
 */

import { BufferJSON, initAuthCreds, proto } from 'baileys'

const CREDS_CATEGORY = 'creds'
const CREDS_ID = 'main'

export class SqliteAuthStore {
  constructor(db) {
    this.db = db
    this.getOne = db.prepare('SELECT value FROM whatsapp_auth WHERE session_id = ? AND category = ? AND id = ?')
    this.upsert = db.prepare(`
      INSERT INTO whatsapp_auth (session_id, category, id, value, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id, category, id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    this.deleteOne = db.prepare('DELETE FROM whatsapp_auth WHERE session_id = ? AND category = ? AND id = ?')
    this.clearAll = db.prepare('DELETE FROM whatsapp_auth WHERE session_id = ?')
    this.writeBatch = db.transaction(entries => {
      const now = new Date().toISOString()
      for (const [sessionId, category, id, value] of entries) {
        if (value === null || typeof value === 'undefined') {
          this.deleteOne.run(sessionId, category, id)
        } else {
          this.upsert.run(sessionId, category, id, JSON.stringify(value, BufferJSON.replacer), now)
        }
      }
    })
  }

  parse(value) {
    return value ? JSON.parse(value, BufferJSON.reviver) : null
  }

  load(sessionId = 'main') {
    const row = this.getOne.get(sessionId, CREDS_CATEGORY, CREDS_ID)
    const creds = this.parse(row?.value) || initAuthCreds()
    const keys = {
      get: async (type, ids) => {
        if (!ids.length) return {}
        const placeholders = ids.map(() => '?').join(',')
        const rows = this.db.prepare(`
          SELECT id, value FROM whatsapp_auth
          WHERE session_id = ? AND category = ? AND id IN (${placeholders})
        `).all(sessionId, type, ...ids)

        return Object.fromEntries(rows.map(row => {
          let value = this.parse(row.value)
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          return [row.id, value]
        }))
      },
      set: async data => {
        const entries = []
        for (const [category, values] of Object.entries(data)) {
          for (const [id, value] of Object.entries(values || {})) {
            entries.push([sessionId, category, id, value])
          }
        }
        this.writeBatch(entries)
      },
      clear: async () => this.clear(sessionId)
    }

    return {
      state: { creds, keys },
      saveCreds: async () => {
        this.writeBatch([[sessionId, CREDS_CATEGORY, CREDS_ID, creds]])
      }
    }
  }

  clear(sessionId = 'main') {
    this.clearAll.run(sessionId)
  }

  listSessions() {
    const rows = this.db.prepare('SELECT DISTINCT session_id FROM whatsapp_auth WHERE category = ? AND id = ?').all(CREDS_CATEGORY, CREDS_ID)
    return rows.map(r => r.session_id)
  }
}
