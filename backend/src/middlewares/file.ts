import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { UPLOAD_PATH } from '../config'

const dest = path.join(process.cwd(), 'src', 'public', UPLOAD_PATH)
fs.mkdirSync(dest, { recursive: true })

const ALLOWED_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/avif',
])

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
        const ext = (path.extname(file.originalname || '') || '').toLowerCase()
        const safe = [
            '.png',
            '.jpg',
            '.jpeg',
            '.webp',
            '.gif',
            '.avif',
        ].includes(ext)
            ? ext
            : ''
        cb(null, crypto.randomUUID().replace(/-/g, '') + safe)
    },
})

const file = multer({
    storage,
    fileFilter: (_req, f, cb) => cb(null, ALLOWED_MIME.has(f.mimetype)),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

export default file
