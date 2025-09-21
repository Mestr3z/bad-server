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

const normalizeLimitForList: RequestHandler = (req, _res, next) => {
  const q = (req.query ?? {}) as Record<string, unknown>

  {
    const raw = q.page
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
        ? parseInt(raw.trim(), 10)
        : NaN
    const page = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
    q.page = String(page)
  }

  {
    const raw = q.limit
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
        ? parseInt(raw.trim(), 10)
        : NaN
    const base = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10
    const clamped = Math.min(Math.max(base, 1), 10)
    q.limit = String(clamped)
  }

  ;(req as any).query = q
  next()
}

router.get('/', auth, roleGuardMiddleware(Role.Admin), normalizeLimitForList, getOrders)

router.get('/me', auth, withUser(getOrdersCurrentUser))
router.get('/me/:orderNumber', auth, withUser(getOrderCurrentUserByNumber))

router.get('/:orderNumber', auth, roleGuardMiddleware(Role.Admin), getOrderByNumber)

router.post('/', validateOrderBody, withUser(createOrder))

router.patch('/:orderNumber', auth, roleGuardMiddleware(Role.Admin), updateOrder)

router.delete('/:id', auth, roleGuardMiddleware(Role.Admin), deleteOrder)

export default router
