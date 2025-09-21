import { Router, type RequestHandler } from 'express'
import {
    validateOrdersQuery,
    validateOrderBody,
} from '../middlewares/validations'
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

const normalizeLimit: RequestHandler = (req, _res, next) => {
    type QueryShape = Record<string, unknown> & { limit?: unknown }

    const q: QueryShape = (req.query ?? {}) as QueryShape

    const rawVal: unknown = Array.isArray(q.limit) ? q.limit[0] : q.limit

    let parsed: number
    if (typeof rawVal === 'number') parsed = rawVal
    else if (typeof rawVal === 'string') parsed = Number(rawVal)
    else parsed = Number(rawVal as any)

    const base: number =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10
    const clamped: number = Math.min(Math.max(base, 1), 10)

    ;(req as any).query = { ...q, limit: clamped }

    next()
}

router.get(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    normalizeLimit,
    validateOrdersQuery,
    getOrders
)

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
