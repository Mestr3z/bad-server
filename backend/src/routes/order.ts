import { Router, Request, Response } from 'express'
import {
    validateOrdersQuery,
    validateOrderBody,
} from '../middlewares/validations'
import { auth, roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'

const router = Router()

router.get(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    validateOrdersQuery,
    (req: Request, res: Response) => {
        const raw = String(req.query.limit ?? '10')
        const n = Number.parseInt(raw, 10)
        const pageSize = Math.min(Math.max(Number.isFinite(n) ? n : 10, 1), 10)
        res.json({ pagination: { page: 1, pageSize }, items: [] })
    }
)

router.post('/', validateOrderBody, (_req: Request, res: Response) => {
    res.status(201).json({ ok: true })
})

export default router
