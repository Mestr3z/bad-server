import 'dotenv/config'
import { CookieOptions } from 'express'
import ms from 'ms'

export const { PORT = '3000', NODE_ENV = 'development' } = process.env

export const DB_ADDRESS =
    process.env.DB_ADDRESS ||
    'mongodb://127.0.0.1:27017/weblarek?authSource=admin'

export const CORS_ORIGINS =
    process.env.CORS_ORIGINS || process.env.ORIGIN_ALLOW || ''

export const UPLOAD_PATH = process.env.UPLOAD_PATH || 'images'
export const UPLOAD_PATH_TEMP = process.env.UPLOAD_PATH_TEMP || 'temp'

export const ACCESS_TOKEN = {
    secret:
        process.env.ACCESS_TOKEN_SECRET ||
        process.env.AUTH_ACCESS_TOKEN_SECRET ||
        'secret-dev',
    expiry:
        process.env.ACCESS_TOKEN_EXPIRY ||
        process.env.AUTH_ACCESS_TOKEN_EXPIRY ||
        '15m',
}
const isHttpsRuntime = NODE_ENV === 'production' && process.env.CI !== 'true'

const refreshCookie: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsRuntime,
    maxAge: ms(
        process.env.REFRESH_TOKEN_EXPIRY ||
            process.env.AUTH_REFRESH_TOKEN_EXPIRY ||
            '30d'
    ),
    path: '/',
}

export const REFRESH_TOKEN = {
    secret:
        process.env.REFRESH_TOKEN_SECRET ||
        process.env.AUTH_REFRESH_TOKEN_SECRET ||
        'secret-dev',
    expiry:
        process.env.REFRESH_TOKEN_EXPIRY ||
        process.env.AUTH_REFRESH_TOKEN_EXPIRY ||
        '30d',
    cookie: { name: 'refreshToken', options: refreshCookie },
}
