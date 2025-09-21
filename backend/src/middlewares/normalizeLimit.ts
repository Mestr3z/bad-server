import type { RequestHandler } from 'express'

export const clampOrdersLimit10: RequestHandler = (req, _res, next) => {
    if (req.method !== 'GET') return next()

    const rawLimit = Array.isArray(req.query.limit)
        ? req.query.limit[0]
        : req.query.limit
    let limit = Number(rawLimit)
    if (!Number.isFinite(limit) || limit <= 0) limit = 10
    if (limit > 10) limit = 10
    req.query.limit = String(limit)

    const rawPage = Array.isArray(req.query.page)
        ? req.query.page[0]
        : req.query.page
    let page = Number(rawPage)
    if (!Number.isFinite(page) || page < 1) page = 1
    req.query.page = String(page)

    next()
}
