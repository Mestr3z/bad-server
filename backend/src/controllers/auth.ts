import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import User from '../models/user'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import UnauthorizedError from '../errors/unauthorized-error'
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config'

const isProd = process.env.NODE_ENV === 'production'

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
    res.cookie('refreshToken', refreshToken, cookieOpts)
}

export async function register(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { email, password, name } = req.body
        if (!email || !password)
            return next(new BadRequestError('Email и пароль обязательны'))

        const existing = await User.findOne({ email }).select('+password')
        if (existing) {
            let ok = await bcrypt.compare(password, existing.password)
            if (!ok) {
                const md5 = crypto
                    .createHash('md5')
                    .update(password)
                    .digest('hex')
                ok = md5 === existing.password
                if (ok) {
                    existing.password = await bcrypt.hash(password, 12)
                    await existing.save()
                }
            }
            if (!ok)
                return next(
                    new UnauthorizedError('Неправильные почта или пароль')
                )
            const access = existing.generateAccessToken()
            const refresh = await existing.generateRefreshToken()
            setTokens(res, access, refresh)
            return res.status(200).json({ accessToken: access })
        }

        const user = new User({ email, password, name })
        await user.save()
        const access = user.generateAccessToken()
        const refresh = await user.generateRefreshToken()
        setTokens(res, access, refresh)
        return res.status(200).json({ accessToken: access })
    } catch (e) {
        return next(e)
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = req.body
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
        const rt = req.cookies?.refreshToken
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
        const rt = req.cookies?.refreshToken
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
        res.clearCookie('refreshToken', { path: '/' })
        return res.json({ ok: true })
    } catch (e) {
        return next(e)
    }
}

export async function getCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        const user = await User.findById(req.user._id).orFail(
            () => new UnauthorizedError('Необходима авторизация')
        )
        return res.json(user)
    } catch (e) {
        return next(e)
    }
}

export async function updateCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user?._id)
            return next(new UnauthorizedError('Необходима авторизация'))
        const { name, phone } = req.body
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { name, phone } },
            { new: true }
        )
        return res.json(user)
    } catch (e) {
        return next(e)
    }
}

export async function getCurrentUserRoles(
    req: Request,
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
