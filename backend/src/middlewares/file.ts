import multer from 'multer'

const ALLOWED_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/avif',
    'application/octet-stream',
])

const storage = multer.memoryStorage()

const file = multer({
    storage,
    fileFilter: (_req, f, cb) =>
        cb(null, ALLOWED_MIME.has((f.mimetype || '').toLowerCase())),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

export default file
