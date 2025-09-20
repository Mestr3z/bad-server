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
  const o = req.headers.origin
  if (o && allowSet.has(o)) {
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', o)
    }
    res.setHeader('Vary', 'Origin')
  }
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
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
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

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok' })
})

const csrfProtection = csrf({
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
})
app.get('/csrf-token', csrfProtection, (req, res) =>
  res.json({ csrfToken: req.csrfToken() })
)
app.use((req, res, next) => {
  const isSafe =
    req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
  const isAuthOrUpload =
    /^\/(api\/)?(auth|upload)\b/.test(req.path) || req.path === '/csrf-token'
  return isSafe || isAuthOrUpload ? next() : csrfProtection(req, res, next)
})

app.use(routes)
app.use('/api', routes)

app.use(errors())
app.use(errorHandler)

mongoose.set('strictQuery', true)

const port = Number(PORT) || 3000
const server = app.listen(port, () => {
  console.log(`listening on http://0.0.0.0:${port}`)
})

async function connectMongoWithRetry(retry = 0) {
  const MAX_RETRY = 20
  try {
    await mongoose.connect(DB_ADDRESS, {
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 3000,
    } as any)
    console.log('MongoDB connected')
  } catch (err) {
    console.error(`Mongo connect failed (#${retry}):`, (err as Error)?.message)
    if (retry < MAX_RETRY) {
      setTimeout(() => connectMongoWithRetry(retry + 1), 2000)
    } else {
      console.error('Mongo not available, continue without DB')
    }
  }
}
connectMongoWithRetry()

function shutdown() {
  console.log('shutting down...')
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0))
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export default app
