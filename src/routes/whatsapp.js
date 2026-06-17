/**
 * Developed by Mohammad Rameez Imdad (Rameez Scripts)
 * WhatsApp: https://wa.me/923224083545 (For Custom Projects)
 * YouTube: https://www.youtube.com/@rameezimdad (Subscribe for more!)
 */

import { Router } from 'express'
import QRCode from 'qrcode'
import { requireAdmin } from '../middleware/auth.js'
import { AppError, asyncHandler } from '../utils/errors.js'
import { ok } from '../utils/response.js'

export const createWhatsAppRouter = service => {
  const router = Router()

  router.get('/sessions', asyncHandler(async (req, res) => {
    ok(res, service.listSessions())
  }))

  router.post('/sessions', requireAdmin, asyncHandler(async (req, res) => {
    const { sessionId } = req.body
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length < 2) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Session ID must be at least 2 characters')
    }
    ok(res, await service.createSession(sessionId.trim()), 201)
  }))

  router.delete('/sessions/:sessionId', requireAdmin, asyncHandler(async (req, res) => {
    const { sessionId } = req.params
    await service.deleteSession(sessionId)
    ok(res, { success: true })
  }))

  router.get('/qr', asyncHandler(async (req, res) => {
    const sessionId = req.query.sessionId || 'main'
    const session = service.getSession(sessionId)
    if (session.getStatus().connected) throw new AppError(409, 'ALREADY_CONNECTED', 'WhatsApp is already connected')
    const qr = await session.waitForQr()
    if (!qr) throw new AppError(503, 'QR_NOT_READY', 'QR code is not ready; retry shortly')

    if (req.query.format === 'png') {
      const png = await QRCode.toBuffer(qr.qr, { width: 420, margin: 2, errorCorrectionLevel: 'M' })
      res.set({ 'content-type': 'image/png', 'cache-control': 'no-store', pragma: 'no-cache' })
      return res.send(png)
    }

    const dataUrl = await QRCode.toDataURL(qr.qr, { width: 420, margin: 2, errorCorrectionLevel: 'M' })
    res.set({ 'cache-control': 'no-store', pragma: 'no-cache' })
    ok(res, { dataUrl, expiresAt: qr.expiresAt })
  }))

  router.get('/status', (req, res) => {
    const sessionId = req.query.sessionId || 'main'
    ok(res, service.getStatus(sessionId))
  })

  router.post('/logout', requireAdmin, asyncHandler(async (req, res) => {
    const sessionId = req.query.sessionId || 'main'
    ok(res, await service.logout(sessionId))
  }))

  return router
}
