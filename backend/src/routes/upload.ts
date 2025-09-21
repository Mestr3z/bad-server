import { Router } from 'express'
import file from '../middlewares/file'
import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'

const router = Router()

router.post('/', file.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File not provided' })
        }

        const { buffer, mimetype, originalname } = req.file

        const extByMime = (() => {
            switch ((mimetype || '').toLowerCase()) {
                case 'image/png':
                    return '.png'
                case 'image/jpeg':
                case 'image/jpg':
                    return '.jpg'
                case 'image/gif':
                    return '.gif'
                case 'image/webp':
                    return '.webp'
                case 'image/avif':
                    return '.avif'
                default:
                    return ''
            }
        })()

        let ext = extByMime || path.extname(originalname || '').toLowerCase()
        if (!ext || !/^\.[a-z0-9]+$/.test(ext)) ext = '.bin'

        const fileNameOnly = crypto.randomBytes(16).toString('hex') + ext

        const imagesDir = path.join(process.cwd(), 'src', 'public', 'images')
        await fs.mkdir(imagesDir, { recursive: true })
        await fs.writeFile(path.join(imagesDir, fileNameOnly), buffer)

        const relPath = path.posix.join('images', fileNameOnly)

        return res.status(201).json({
            fileName: relPath,
            originalName: originalname,
            size: buffer.length,
            mime: mimetype,
        })
    } catch (err) {
        next(err)
    }
})

export default router
