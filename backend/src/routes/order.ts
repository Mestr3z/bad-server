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
    (h: (req: ReqWithUser, ...args: any[]) => any): RequestHandler =>
    (req, res, next) =>
        h(req as ReqWithUser, res, next)

const adminOnly: RequestHandler = (req, res, next) => {
    const user = (req as unknown as ReqWithUser).user
    if (!user?.roles?.includes(Role.Admin)) {
        return res.status(403).json({ message: 'Forbidden' })
    }
    next()
}

const normalizeLimit: RequestHandler = (req, _res, next) => {
    const raw = Number((req.query as any).limit)
    const val = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10
    ;(req.query as any).limit = String(Math.min(Math.max(val, 1), 10))
    next()
}

router.get('/', auth, adminOnly, normalizeLimit, validateOrdersQuery, getOrders)

router.get('/me', auth, withUser(getOrdersCurrentUser))
router.get('/me/:orderNumber', auth, withUser(getOrderCurrentUserByNumber))

router.get('/:orderNumber', auth, adminOnly, getOrderByNumber)

router.post('/', validateOrderBody, withUser(createOrder))

router.patch('/:orderNumber', auth, adminOnly, updateOrder)

router.delete('/:id', auth, adminOnly, deleteOrder)

export default router
