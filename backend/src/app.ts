import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import helmet from 'helmet'
import hpp from 'hpp'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import mongoSanitize from 'express-mongo-sanitize'
import compression from 'compression'
import csrf from 'csurf'
import { DB_ADDRESS, CORS_ORIGINS, PORT } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'
import authRouter from './routes/auth'

const app = express()

const DEFAULT_ORIGIN = 'http://localhost:5173'
const originList = (CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
if (!originList.includes(DEFAULT_ORIGIN)) originList.push(DEFAULT_ORIGIN)
const allowSet = new Set(originList)

const corsOrigin = (
    origin: string | undefined,
    cb: (err: any, ok?: boolean) => void
) => {
    if (!origin) return cb(null, true)
    if (allowSet.has(origin)) return cb(null, true)
    return cb(new Error('CORS'))
}

app.use(
    cors({
        origin: corsOrigin,
        credentials: true,
    })
)

app.use((req, res, next) => {
    const o = req.headers.origin as string | undefined
    if (o && allowSet.has(o)) {
        res.setHeader('Access-Control-Allow-Origin', o)
        res.setHeader('Vary', 'Origin')
    }
    next()
})

app.options('*', cors({ origin: corsOrigin, credentials: true }))

app.disable('x-powered-by')
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false,
    })
)
app.use(hpp())
app.use(compression())

app.use(
    rateLimit({
        windowMs: 60_000,
        max: 50,
        standardHeaders: 'draft-6',
        legacyHeaders: false,
        message: { message: 'Too many requests' },
    })
)
app.use(slowDown({ windowMs: 60_000, delayAfter: 120, delayMs: 250 }))
app.use(mongoSanitize())

app.use(cookieParser())
app.use(urlencoded({ extended: false }))
app.use(json({ limit: '1mb' }))

app.use(serveStatic(path.join(__dirname, 'public')))

const csrfProtection = csrf({
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
})

app.get('/csrf-token', csrfProtection, (req, res) =>
    res.json({ csrfToken: req.csrfToken() })
)
app.get('/api/csrf-token', csrfProtection, (req, res) =>
    res.json({ csrfToken: req.csrfToken() })
)

app.use((req, res, next) => {
    const isSafe =
        req.method === 'GET' ||
        req.method === 'HEAD' ||
        req.method === 'OPTIONS'
    const isWhitelisted =
        /^\/(api\/)?(auth|upload|order)\b/.test(req.path) ||
        req.path === '/csrf-token' ||
        req.path === '/api/csrf-token'
    return isSafe || isWhitelisted ? next() : csrfProtection(req, res, next)
})

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/auth', authRouter)
app.use('/api/auth', authRouter)

app.use('/api', routes)

app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT || 3000, () => {})
    } catch (error) {
        console.error(error)
    }
}
bootstrap()

export default app
