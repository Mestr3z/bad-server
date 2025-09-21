import { Router, type RequestHandler } from 'express'
import { validateOrderBody } from '../middlewares/validations'
import {
    auth,
    roleGuardMiddleware,
    type ReqWithUser,
} from '../middlewares/auth'
import { Role } from '../models/user'
import {
    getOrders,
    getOrdersCurrentUser,
    getOrderByNumber,
    getOrderCurrentUserByNumber,
    createOrder,
    updateOrder,
    deleteOrder,
} from '../controllers/order'

const router = Router()

const withUser =
    (h: (req: ReqWithUser, ...a: any[]) => any): RequestHandler =>
    (req, res, next) =>
        h(req as ReqWithUser, res, next)

const first = <T = unknown>(v: unknown): T | undefined =>
    (Array.isArray(v) ? (v[0] as T) : (v as T)) as T | undefined

const toInt = (v: unknown): number => {
    const s = first<string | number>(v)
    const str =
        typeof s === 'number'
            ? String(s)
            : typeof s === 'string'
              ? s.trim()
              : String(s ?? '')
    const n = Number.parseInt(str, 10)
    return Number.isFinite(n) ? n : NaN
}

const clamp = (n: number, min: number, max: number) =>
    Math.min(Math.max(n, min), max)

const SORT_WHITELIST = new Set([
    'createdAt',
    'totalAmount',
    'orderNumber',
    'status',
])

const normalizeQuery: RequestHandler = (req, _res, next) => {
    const src = (req.query ?? {}) as Record<string, unknown>
    const q: Record<string, unknown> = {}

    for (const [k, v] of Object.entries(src)) {
        q[k] = Array.isArray(v) ? v[0] : v
    }

    {
        const n = toInt(q.page)
        const page = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
        q.page = String(page)
    }

    {
        const n = toInt(q.limit)
        const base = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10
        const clamped = clamp(base, 1, 10)
        q.limit = String(clamped)
    }

    {
        const raw = String(first<string>(q.sortField) ?? 'createdAt')
        q.sortField = SORT_WHITELIST.has(raw) ? raw : 'createdAt'
    }

    {
        const raw = String(first<string>(q.sortOrder) ?? 'desc').toLowerCase()
        q.sortOrder = raw === 'asc' ? 'asc' : 'desc'
    }

    if (q.status !== undefined && q.status !== null) {
        q.status = String(first<string>(q.status) ?? '').trim()
    }

    for (const k of ['totalAmountFrom', 'totalAmountTo'] as const) {
        const n = Number(first<string | number>(q[k]))
        if (Number.isFinite(n)) q[k] = String(n)
        else delete q[k]
    }

    for (const k of ['orderDateFrom', 'orderDateTo'] as const) {
        const v = first<string>(q[k])
        if (v) {
            const d = new Date(v)
            if (!Number.isNaN(d.getTime())) q[k] = d.toISOString()
            else delete q[k]
        } else {
            delete q[k]
        }
    }

    if (q.search !== undefined && q.search !== null) {
        q.search = String(first<string>(q.search) ?? '')
    }

    ;(req as any).query = q
    next()
}

router.use(normalizeQuery)

router.get('/', auth, roleGuardMiddleware(Role.Admin), getOrders)

router.get('/me', auth, withUser(getOrdersCurrentUser))
router.get('/me/:orderNumber', auth, withUser(getOrderCurrentUserByNumber))

router.get(
    '/:orderNumber',
    auth,
    roleGuardMiddleware(Role.Admin),
    getOrderByNumber
)

router.post('/', validateOrderBody, withUser(createOrder))

router.patch(
    '/:orderNumber',
    auth,
    roleGuardMiddleware(Role.Admin),
    updateOrder
)

router.delete('/:id', auth, roleGuardMiddleware(Role.Admin), deleteOrder)

export default router
