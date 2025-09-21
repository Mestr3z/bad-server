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
    const q = req.query as Record<string, any>

    const pickFirst = (v: unknown) =>
        Array.isArray(v) ? (v.length ? v[0] : undefined) : v

    {
        const raw = pickFirst(q.limit)
        let num = Number(raw)
        if (!Number.isFinite(num) || num <= 0) num = 10
        num = Math.trunc(num)
        if (num < 1) num = 1
        if (num > 10) num = 10
        q.limit = num
    }

    {
        const raw = pickFirst(q.page)
        let num = Number(raw)
        if (!Number.isFinite(num) || num < 1) num = 1
        num = Math.trunc(num)
        q.page = num
    }

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
