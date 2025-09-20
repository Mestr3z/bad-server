import { Router, type RequestHandler } from 'express'
import { auth, type ReqWithUser } from '../middlewares/auth'
import {
    login,
    logout,
    register,
    refreshAccessToken,
    getCurrentUser,
    updateCurrentUser,
    getCurrentUserRoles,
} from '../controllers/auth'
import { validateAuthentication } from '../middlewares/validations'

const router = Router()

const withUser =
    (h: (req: ReqWithUser, ...args: any[]) => any): RequestHandler =>
    (req, res, next) =>
        h(req as ReqWithUser, res, next)

router.post('/register', validateAuthentication, register)
router.post('/login', validateAuthentication, login)

router.post('/token', refreshAccessToken)
router.post('/logout', logout)

router.get('/user', auth, withUser(getCurrentUser))
router.patch('/user', auth, withUser(updateCurrentUser))
router.get('/user/roles', auth, withUser(getCurrentUserRoles))

export default router
