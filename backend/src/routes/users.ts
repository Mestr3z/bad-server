import { Router } from 'express'
import { auth, roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'
import { validateUsersQuery } from '../middlewares/validations'
import { getUsers } from '../controllers/users'

const router = Router()

router.get(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    validateUsersQuery,
    getUsers
)

export default router
