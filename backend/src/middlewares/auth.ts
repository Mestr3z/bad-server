import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User, { Role } from '../models/user'
import UnauthorizedError from '../errors/unauthorized-error'
import ForbiddenError from '../errors/forbidden-error'
import { ACCESS_TOKEN } from '../config'

declare module 'express-serve-static-core' {
    interface Request {
        user?: { _id: string; email?: string }
    }
}

export async function auth(req: Request, _res: Response, next: NextFunction) {
    const bearer = req.header('authorization')
    const token =
        req.cookies?.accessToken ||
        (bearer?.startsWith('Bearer ') ? bearer.slice(7) : '')
    if (!token) return next(new UnauthorizedError('Необходима авторизация'))
    try {
        const payload = jwt.verify(token, ACCESS_TOKEN.secret) as {
            _id: string
            email?: string
        }
        req.user = { _id: payload._id, email: payload.email }
        return next()
    } catch {
        return next(new UnauthorizedError('Необходима авторизация'))
    }
}

export function roleGuardMiddleware(role: Role) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        const user = await User.findById(req.user._id)
        if (!user || !user.roles.includes(role))
            return next(new ForbiddenError('Доступ запрещён'))
        return next()
    }
}
