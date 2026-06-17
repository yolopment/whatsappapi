/**
 * Developed by Mohammad Rameez Imdad (Rameez Scripts)
 * WhatsApp: https://wa.me/923224083545 (For Custom Projects)
 * YouTube: https://www.youtube.com/@rameezimdad (Subscribe for more!)
 */

import { randomUUID } from 'node:crypto'
import { BufferJSON } from 'baileys'

export class MessageRepository {
  constructor(db) {
    this.db = db
    this.insert = db.prepare(`
      INSERT INTO messages
        (id, recipient, type, payload_json, status, api_key_id, session_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)
    `)
    this.sent = db.prepare(`
      UPDATE messages SET wa_message_id = ?, message_json = ?, status = 'sent', updated_at = ?
      WHERE id = ?
    `)
    this.failed = db.prepare(`
      UPDATE messages SET status = 'failed', error = ?, updated_at = ? WHERE id = ?
    `)
    this.findMessage = db.prepare('SELECT message_json FROM messages WHERE wa_message_id = ?')
    this.sinceCount = db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE session_id = ? AND created_at >= ? AND status != 'failed'`)
  }

  preview(row) {
    try {
      const p = JSON.parse(row.payload_json)
      const text = p.text || p.caption || p.fileName || p.name || ''
      return String(text).slice(0, 90)
    } catch { return '' }
  }

  list({ status = null, apiKeyId = null, sessionId = null, limit = 50 } = {}) {
    let sql = 'SELECT id, wa_message_id, recipient, type, payload_json, status, error, api_key_id, session_id, created_at, updated_at FROM messages'
    const conds = []
    const args = []
    
    if (apiKeyId) {
      conds.push('api_key_id = ?')
      args.push(apiKeyId)
    }
    if (sessionId) {
      conds.push('session_id = ?')
      args.push(sessionId)
    }
    if (status) {
      conds.push('status = ?')
      args.push(status)
    }
    
    if (conds.length) {
      sql += ' WHERE ' + conds.join(' AND ')
    }
    
    if (status === 'queued') {
      sql += ' ORDER BY created_at ASC'
    } else {
      sql += ' ORDER BY created_at DESC'
    }
    
    sql += ' LIMIT ?'
    args.push(limit)
    
    const rows = this.db.prepare(sql).all(...args)
    return rows.map(row => ({
      id: row.id,
      waMessageId: row.wa_message_id,
      recipient: row.recipient,
      type: row.type,
      preview: this.preview(row),
      status: row.status,
      error: row.error,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  counts(apiKeyId = null, sessionId = null) {
    let sql = 'SELECT status, COUNT(*) AS n FROM messages'
    const conds = []
    const args = []
    
    if (apiKeyId) {
      conds.push('api_key_id = ?')
      args.push(apiKeyId)
    }
    if (sessionId) {
      conds.push('session_id = ?')
      args.push(sessionId)
    }
    
    if (conds.length) {
      sql += ' WHERE ' + conds.join(' AND ')
    }
    sql += ' GROUP BY status'
    
    const rows = this.db.prepare(sql).all(...args)
    return Object.fromEntries(rows.map(row => [row.status, row.n]))
  }

  create({ recipient, type, payload, apiKeyId, sessionId = 'main' }) {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.insert.run(id, recipient, type, JSON.stringify(payload), apiKeyId === 'bootstrap' ? null : apiKeyId, sessionId, now, now)
    return { id, status: 'queued', createdAt: now }
  }

  markSent(id, waMessage) {
    const now = new Date().toISOString()
    this.sent.run(
      waMessage.key.id,
      JSON.stringify(waMessage, BufferJSON.replacer),
      now,
      id
    )
    return { id, waMessageId: waMessage.key.id, status: 'sent', sentAt: now }
  }

  markFailed(id, error) {
    this.failed.run(String(error).slice(0, 1000), new Date().toISOString(), id)
  }

  countSince(sessionId, iso) {
    return this.sinceCount.get(sessionId, iso)?.n || 0
  }

  getContent(waMessageId) {
    const row = this.findMessage.get(waMessageId)
    if (!row?.message_json) return undefined
    return JSON.parse(row.message_json, BufferJSON.reviver)?.message
  }
}
