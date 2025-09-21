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
    const raw = Number((req.query as any).limit)
    const val = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10
    ;(req.query as any).limit = Math.min(Math.max(val, 1), 10) // число
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
