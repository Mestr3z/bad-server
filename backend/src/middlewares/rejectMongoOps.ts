import type { RequestHandler } from 'express'
import BadRequestError from '../errors/bad-request-error'

function hasMongoOps(obj: unknown): boolean {
    if (obj == null) return false

    if (typeof obj === 'string') {
        return /^\s*\$/.test(obj)
    }

    if (Array.isArray(obj)) {
        return obj.some(hasMongoOps)
    }

    if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (k.startsWith('$')) return true
            if (k.includes('$')) return true
            if (hasMongoOps(v)) return true
        }
    }

    return false
}

export const rejectMongoOpsInQuery: RequestHandler = (req, _res, next) => {
    if (hasMongoOps(req.query) || hasMongoOps(req.params)) {
        return next(new BadRequestError('Невалидный запрос'))
    }
    next()
}
