import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const statusCode = (err as any)?.statusCode || 500
    const message =
        statusCode === 500 ? 'На сервере произошла ошибка' : err.message

    try {
        console.error(err)
    } catch {}
    if (res.headersSent) {
        return
    }

    res.status(statusCode).json({ message })
}

export default errorHandler
