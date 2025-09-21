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

const normalizePagination: RequestHandler = (req, _res, next) => {
    const q = req.query as any

    const toInt = (v: unknown, def: number) => {
        const n = Array.isArray(v) ? Number(v[0]) : Number(v)
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : def
    }

    const page = toInt(q.page, 1)
    let limit = toInt(q.limit, 10)
    if (limit > 10) limit = 10
    if (limit < 1) limit = 1

    q.page = String(page)
    q.limit = String(limit)

    next()
}

router.get(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    normalizePagination,
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
