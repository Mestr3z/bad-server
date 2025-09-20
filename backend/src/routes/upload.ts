import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { UPLOAD_PATH } from '../config'

const router = Router()

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
        const ext = path.extname(file.originalname || '').toLowerCase()
        const safeExt = [
            '.png',
            '.jpg',
            '.jpeg',
            '.webp',
            '.gif',
            '.avif',
        ].includes(ext)
            ? ext
            : ''
        cb(null, crypto.randomUUID().replace(/-/g, '') + safeExt)
    },
})

const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file' })
    if (req.file.size < 2 * 1024) {
        try {
            fs.unlinkSync(req.file.path)
        } catch {}
        return res.status(400).json({ message: 'File too small' })
    }
    const fileName = path.posix.join(UPLOAD_PATH, req.file.filename)
    return res.status(201).json({ fileName })
})

export default router
