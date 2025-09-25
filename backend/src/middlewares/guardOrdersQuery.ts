import type { RequestHandler } from 'express'
import BadRequestError from '../errors/bad-request-error'

const SORT_WHITELIST = new Set([
    'createdAt',
    'totalAmount',
    'orderNumber',
    'status',
])

export const guardOrdersQuery: RequestHandler = (req, _res, next) => {
    if (req.method !== 'GET') return next()

    const src = req.query ?? {}

    const rejectObjects = (v: unknown) => v !== null && typeof v === 'object'

    if (rejectObjects((src as any).page))
        return next(new BadRequestError('Невалидный запрос'))
    const pageNum = Number.parseInt(String((src as any).page ?? '1'), 10)
    const page =
        Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1

    if (rejectObjects((src as any).limit))
        return next(new BadRequestError('Невалидный запрос'))
    const limNum = Number.parseInt(String((src as any).limit ?? '10'), 10)
    const limitBase = Number.isFinite(limNum) ? Math.floor(limNum) : 10
    const limit = Math.min(Math.max(limitBase, 1), 10)

    if (rejectObjects((src as any).sortField))
        return next(new BadRequestError('Невалидный запрос'))
    const rawSortField = String((src as any).sortField ?? 'createdAt')
    const sortField = SORT_WHITELIST.has(rawSortField)
        ? rawSortField
        : 'createdAt'

    if (rejectObjects((src as any).sortOrder))
        return next(new BadRequestError('Невалидный запрос'))
    const sortOrder =
        String((src as any).sortOrder ?? 'desc').toLowerCase() === 'asc'
            ? 'asc'
            : 'desc'

    const out: Record<string, string> = {
        page: String(page),
        limit: String(limit),
        sortField,
        sortOrder,
    }

    const OTHERS = [
        'status',
        'totalAmountFrom',
        'totalAmountTo',
        'orderDateFrom',
        'orderDateTo',
        'search',
    ] as const
    for (const key of OTHERS) {
        const v = (src as any)[key]
        if (v === undefined) continue
        if (rejectObjects(v))
            return next(new BadRequestError('Невалидный запрос'))
        out[key] = String(v)
    }
    ;(req as any).query = out
    next()
}
