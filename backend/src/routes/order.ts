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

const normalizeQuery: RequestHandler = (req, _res, next) => {
    const src = req.query ?? {}

    const q: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) {
        q[k] = Array.isArray(v) ? v[0] : v
    }

    const raw = q.limit
    let n: number
    if (typeof raw === 'number') n = raw
    else if (typeof raw === 'string') n = parseInt(raw.trim(), 10)
    else n = NaN

    if (!Number.isFinite(n) || n <= 0) n = 10
    n = Math.min(Math.max(Math.floor(n), 1), 10)

    q.limit = String(n)
    ;(req.query as any) = q
    next()
}

router.get('*', normalizeQuery)

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
