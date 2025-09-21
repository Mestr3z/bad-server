import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import User, { Role } from '../models/user'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import UnauthorizedError from '../errors/unauthorized-error'
import { ACCESS_TOKEN, REFRESH_TOKEN, NODE_ENV } from '../config'
import type { ReqWithUser } from '../middlewares/auth'

const isProd = NODE_ENV === 'production'

const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
}

function hashRT(token: string) {
    return crypto
        .createHmac('sha256', REFRESH_TOKEN.secret)
        .update(token)
        .digest('hex')
}

function setTokens(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('accessToken', accessToken, cookieOpts)
    res.cookie(REFRESH_TOKEN.cookie.name, refreshToken, {
        ...cookieOpts,
        maxAge: REFRESH_TOKEN.cookie.options.maxAge,
    })
}

export async function register(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { email, password, name } = req.body as {
            email?: string
            password?: string
            name?: string
        }
        if (!email || !password)
            return next(new BadRequestError('Email и пароль обязательны'))

        const existing = await User.findOne({ email }).select('+password')
        if (existing)
            return next(
                new ConflictError('Пользователь с таким email уже существует')
            )

        const roles = email === 'admin@mail.ru' ? [Role.Admin] : undefined

        const user = new User({
            email,
            password,
            name,
            ...(roles ? { roles } : {}),
        })
        await user.save()

        const access = user.generateAccessToken()
        const refresh = await user.generateRefreshToken()
        setTokens(res, access, refresh)
        return res.status(201).json({ accessToken: access })
    } catch (e) {
        return next(e)
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = req.body as {
            email: string
            password: string
        }
        const user = await User.findUserByCredentials(email, password)
        const access = user.generateAccessToken()
        const refresh = await user.generateRefreshToken()
        setTokens(res, access, refresh)
        return res.json({ accessToken: access })
    } catch (e) {
        return next(e)
    }
}

export async function refreshAccessToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const rt = req.cookies?.[REFRESH_TOKEN.cookie.name]
        if (!rt) return next(new UnauthorizedError('Требуется авторизация'))

        const payload = jwt.verify(rt, REFRESH_TOKEN.secret) as { _id: string }
        const user = await User.findById(payload._id).orFail(
            () => new UnauthorizedError('Требуется авторизация')
        )

        const ok = user.tokens.some((t) => t.token === hashRT(rt))
        if (!ok) return next(new UnauthorizedError('Требуется авторизация'))

        user.tokens = []
        await user.save()

        const newRefresh = await user.generateRefreshToken()
        const newAccess = user.generateAccessToken()
        setTokens(res, newAccess, newRefresh)
        return res.json({ accessToken: newAccess })
    } catch {
        return next(new UnauthorizedError('Требуется авторизация'))
    }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const rt = req.cookies?.[REFRESH_TOKEN.cookie.name]
        if (rt) {
            try {
                const payload = jwt.verify(rt, REFRESH_TOKEN.secret) as {
                    _id: string
                }
                const user = await User.findById(payload._id)
                if (user) {
                    const hashed = hashRT(rt)
                    user.tokens = user.tokens.filter((t) => t.token !== hashed)
                    await user.save()
                }
            } catch {}
        }
        res.clearCookie('accessToken', { path: '/' })
        res.clearCookie(REFRESH_TOKEN.cookie.name, { path: '/' })
        return res.json({ ok: true })
    } catch (e) {
        return next(e)
    }
}

export async function getCurrentUser(
    req: ReqWithUser,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        const user = await User.findById(req.user._id)
            .select('-password -tokens -roles')
            .orFail(() => new UnauthorizedError('Необходима авторизация'))
        return res.json(user)
    } catch (e) {
        return next(e)
    }
}

export async function updateCurrentUser(
    req: ReqWithUser,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        const { name, phone } = req.body as { name?: string; phone?: string }

        const $set: any = {}
        if (typeof name === 'string') $set.name = name
        if (typeof phone === 'string') $set.phone = phone

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set },
            { new: true, runValidators: true }
        )
            .select('-password -tokens -roles')
            .orFail(() => new UnauthorizedError('Необходима авторизация'))
        return res.json(user)
    } catch (e) {
        return next(e)
    }
}

export async function getCurrentUserRoles(
    req: ReqWithUser,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        const user = await User.findById(req.user._id)
            .select('roles')
            .orFail(() => new UnauthorizedError('Необходима авторизация'))
        return res.json(user.roles || [])
    } catch (e) {
        return next(e)
    }
}
