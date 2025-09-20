import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { join, resolve, extname } from 'path'
import crypto from 'crypto'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const ALLOWED = new Map<string, string>([
    ['image/png', '.png'],
    ['image/jpg', '.jpg'],
    ['image/jpeg', '.jpg'],
    ['image/gif', '.gif'],
    ['image/webp', '.webp'],
])

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        const base = resolve(__dirname, '../public')
        const sub = process.env.UPLOAD_PATH_TEMP
            ? process.env.UPLOAD_PATH_TEMP
            : ''
        const dest = resolve(base, sub)
        if (!dest.startsWith(base))
            return cb(new Error('Invalid upload path'), '')
        cb(null, dest)
    },
    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const ext =
            ALLOWED.get(file.mimetype) ||
            extname(file.originalname).toLowerCase()
        const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
        cb(null, name)
    },
})

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (!ALLOWED.has(file.mimetype)) return cb(null, false)
    cb(null, true)
}

export default multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
})
