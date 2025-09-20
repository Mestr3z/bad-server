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

const app = express()

const origins = (CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
app.use(
    cors({
        origin: (origin, cb) =>
            !origin || origins.length === 0 || origins.includes(origin)
                ? cb(null, true)
                : cb(new Error('CORS')),
        credentials: true,
    })
)
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(hpp())
app.use(compression())
app.use(rateLimit({ windowMs: 60_000, max: 300 }))
app.use(slowDown({ windowMs: 60_000, delayAfter: 150, delayMs: 250 }))
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

app.use((req, res, next) => {
    const skip =
        req.method === 'GET' ||
        req.method === 'HEAD' ||
        req.method === 'OPTIONS' ||
        req.path === '/csrf-token' ||
        req.path.startsWith('/auth')
    return skip ? next() : csrfProtection(req, res, next)
})

app.use(routes)

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
