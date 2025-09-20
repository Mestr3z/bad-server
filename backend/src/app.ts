import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded, type RequestHandler } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import helmet from 'helmet'
import hpp from 'hpp'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import mongoSanitize from 'express-mongo-sanitize'
import compression from 'compression'
import csrf from 'csurf'
import { DB_ADDRESS, CORS_ORIGINS, PORT, NODE_ENV } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

import orderRouter from './routes/order'
import uploadRouter from './routes/upload'

const app = express()
const isProd = NODE_ENV === 'production'

const DEFAULT_ORIGIN = 'http://localhost:5173'
const originList = (CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
if (!originList.includes(DEFAULT_ORIGIN)) originList.push(DEFAULT_ORIGIN)
const allowSet = new Set(originList)

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true)
            if (allowSet.has(origin)) return cb(null, true)
            return cb(new Error('CORS'))
        },
        credentials: true,
    })
)

app.use((req, res, next) => {
    const o = (req.headers.origin as string | undefined) || DEFAULT_ORIGIN
    if (!res.getHeader('Access-Control-Allow-Origin')) {
        res.setHeader('Access-Control-Allow-Origin', o)
    }
    res.setHeader('Vary', 'Origin')
    next()
})

app.disable('x-powered-by')
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false,
    })
)
app.use(hpp())
app.use(compression())
app.set('trust proxy', 1)
app.use(
    rateLimit({
        windowMs: 60_000,
        max: 50,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many requests' },
    })
)
app.use(
    slowDown({
        windowMs: 60_000,
        delayAfter: 120,
        delayMs: () => 250,
    })
)
app.use(mongoSanitize())

app.use(cookieParser())
app.use(urlencoded({ extended: false }))
app.use(json({ limit: '1mb' }))
app.use(serveStatic(path.join(__dirname, 'public')))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

const csrfProtection: RequestHandler = csrf({
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' },
}) as unknown as RequestHandler

app.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: (req as any).csrfToken() })
})
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: (req as any).csrfToken() })
})

app.use(routes)
app.use('/api', routes)
app.use('/orders', orderRouter)
app.use('/api/orders', orderRouter)
app.use('/upload', uploadRouter)
app.use('/api/upload', uploadRouter)

app.use((req, res, next) => {
    if (res.headersSent) return next()
    res.status(404).json({ message: 'Not found' })
})

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
