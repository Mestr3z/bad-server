import type { RequestHandler } from 'express'

export const clampOrdersLimit10: RequestHandler = (req, _res, next) => {
    if (req.method !== 'GET') return next()

    const q = (req.query ?? {}) as Record<string, unknown>

    {
        const raw = Array.isArray(q.page) ? q.page[0] : q.page
        const n =
            typeof raw === 'number'
                ? raw
                : typeof raw === 'string'
                  ? parseInt(raw.trim(), 10)
                  : NaN
        const page = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
        q.page = String(page)
    }

    {
        const raw = Array.isArray(q.limit) ? q.limit[0] : q.limit
        const n =
            typeof raw === 'number'
                ? raw
                : typeof raw === 'string'
                  ? parseInt(raw.trim(), 10)
                  : NaN
        const base = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10
        const clamped = Math.min(Math.max(base, 1), 10)
        q.limit = String(clamped)
    }

    ;(req as any).query = q
    next()
}
