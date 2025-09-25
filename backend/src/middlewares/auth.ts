import type { Request, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import UnauthorizedError from '../errors/unauthorized-error'
import ForbiddenError from '../errors/forbidden-error'
import User, { type Role } from '../models/user'
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config'

export type ReqWithUser = Request & { user?: { _id: string; roles: Role[] } }

const ACCESS_SECRET = ACCESS_TOKEN.secret || 'dev-access-secret'

function pickAccessToken(req: Request): string {
    const header = req.headers.authorization || ''
    const [scheme, bearer] = header.split(' ')
    if (scheme?.toLowerCase() === 'bearer' && bearer) return bearer

    const cookieToken = (req as any).cookies?.accessToken
    if (typeof cookieToken === 'string' && cookieToken) return cookieToken

    return ''
}

export const auth: RequestHandler = async (req, _res, next) => {
    try {
        const access = pickAccessToken(req)
        if (access) {
            const payload = jwt.verify(access, ACCESS_SECRET) as {
                id?: string
                _id?: string
                sub?: string
                roles?: Role[]
            }
            const userId = String(
                payload.id ?? payload._id ?? payload.sub ?? ''
            )
            if (!userId)
                return next(new UnauthorizedError('Необходима авторизация'))

            let roles = Array.isArray(payload.roles) ? payload.roles : undefined
            if (!roles) {
                const u = await User.findById(userId).select('roles').lean()
                roles = (u?.roles as Role[]) ?? []
            }

            ;(req as ReqWithUser).user = { _id: userId, roles }
            return next()
        }

        const rt = (req as any).cookies?.[REFRESH_TOKEN.cookie.name]
        if (typeof rt === 'string' && rt) {
            const p = jwt.verify(rt, REFRESH_TOKEN.secret) as {
                _id?: string
                sub?: string
            }
            const userId = String(p._id ?? p.sub ?? '')
            if (userId) {
                const u = await User.findById(userId).select('roles').lean()
                const roles = (u?.roles as Role[]) ?? []
                ;(req as ReqWithUser).user = { _id: userId, roles }
                return next()
            }
        }

        return next(new UnauthorizedError('Необходима авторизация'))
    } catch {
        return next(new UnauthorizedError('Необходима авторизация'))
    }
}

export const roleGuardMiddleware =
    (...allowed: Role[]): RequestHandler =>
    (req, _res, next) => {
        const user = (req as ReqWithUser).user
        if (!user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        if (!allowed.some((r) => user.roles?.includes(r))) {
            return next(new ForbiddenError('Доступ запрещён'))
        }
        next()
    }
