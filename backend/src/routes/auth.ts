import { Router, type RequestHandler } from 'express'
import { celebrate, Joi, Segments } from 'celebrate'
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

const withUser =
    (h: (req: ReqWithUser, ...args: any[]) => any): RequestHandler =>
    (req, res, next) =>
        h(req as ReqWithUser, res, next)

const router = Router()

const validateRegister: RequestHandler = celebrate({
    [Segments.BODY]: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(128).required(),
        name: Joi.string().trim().min(1).max(100).optional(),
    }).unknown(false),
})

const validateLogin: RequestHandler = celebrate({
    [Segments.BODY]: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(128).required(),
    }).unknown(false),
})

router.post('/register', validateRegister, register)
router.post('/login', validateLogin, login)
router.post('/token', refreshAccessToken)
router.post('/logout', logout)

router.get('/user', auth, withUser(getCurrentUser))
router.patch('/user', auth, withUser(updateCurrentUser))
router.get('/user/roles', auth, withUser(getCurrentUserRoles))

export default router
