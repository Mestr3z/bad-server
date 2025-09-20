import { Router } from 'express'
import {
    validateOrdersQuery,
    validateOrderBody,
} from '../middlewares/validations'
import { auth, roleGuardMiddleware } from '../middlewares/auth'
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

router.get(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    validateOrdersQuery,
    getOrders
)

router.get('/me', auth, getOrdersCurrentUser)
router.get('/me/:orderNumber', auth, getOrderCurrentUserByNumber)

router.get(
    '/:orderNumber',
    auth,
    roleGuardMiddleware(Role.Admin),
    getOrderByNumber
)

router.post('/', validateOrderBody, createOrder)

router.patch(
    '/:orderNumber',
    auth,
    roleGuardMiddleware(Role.Admin),
    updateOrder
)
router.delete('/:id', auth, roleGuardMiddleware(Role.Admin), deleteOrder)

export default router
