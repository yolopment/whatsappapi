/**
 * Developed by Mohammad Rameez Imdad (Rameez Scripts)
 * WhatsApp: https://wa.me/923224083545 (For Custom Projects)
 * YouTube: https://www.youtube.com/@rameezimdad (Subscribe for more!)
 */

import { AppError } from '../utils/errors.js'

const extractKey = req => {
  const header = req.get('x-api-key')
  if (header) return header.trim()
  const authorization = req.get('authorization') || ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

export const apiKeyAuth = service => (req, res, next) => {
  try {
    req.apiKey = service.authenticate(extractKey(req))
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAdmin = (req, res, next) => {
  if (req.apiKey?.role !== 'admin') {
    return next(new AppError(403, 'ADMIN_REQUIRED', 'An admin API key is required'))
  }
  next()
}

export const enforceSessionRestriction = (req, res, next) => {
  if (req.apiKey && req.apiKey.role !== 'admin' && req.apiKey.restrictedSessionId) {
    const sessionSpecificPaths = [
      '/send-message',
      '/send-image',
      '/send-document',
      '/send-audio',
      '/send-location',
      '/messages',
      '/qr',
      '/status',
      '/logout'
    ]
    const path = req.path
    const isSessionSpecific = sessionSpecificPaths.some(p => path === p || path.startsWith(p + '/'))

    if (isSessionSpecific) {
      const sessionId = req.body?.sessionId || req.query?.sessionId || req.params?.sessionId || 'main'
      if (sessionId !== req.apiKey.restrictedSessionId) {
        return next(new AppError(403, 'SESSION_RESTRICTED', `This API key is restricted to session '${req.apiKey.restrictedSessionId}'`))
      }
    }
  }
  next()
}
