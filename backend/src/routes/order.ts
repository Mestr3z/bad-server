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
import { clampOrdersLimit10 } from '../middlewares/normalizeLimit'

const router = Router()

const withUser =
    (h: (req: ReqWithUser, ...a: any[]) => any): RequestHandler =>
    (req, res, next) =>
        h(req as ReqWithUser, res, next)

router.get(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    clampOrdersLimit10,
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
