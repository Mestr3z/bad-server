import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { readFile, unlink, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const MIN_SIZE = 2 * 1024 
const MAX_SIZE = 10 * 1024 * 1024 
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const UPLOAD_SUBDIR = process.env.UPLOAD_PATH || 'images'
const UPLOAD_DIR = path.join(PUBLIC_DIR, UPLOAD_SUBDIR)

const isValidImageBytes = (buf: Buffer) => {
    if (buf.length < 8) return false
    if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
    )
        return true
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
    if (
        buf[0] === 0x47 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x38
    )
        return true
    const s = buf.slice(0, 5).toString().toLowerCase()
    if (s.startsWith('<?xml') || s.startsWith('<svg')) return true
    return false
}

const inferExt = (original: string, mimetype?: string) => {
    const fromMime =
        mimetype === 'image/png'
            ? '.png'
            : mimetype === 'image/jpeg'
              ? '.jpg'
              : mimetype === 'image/gif'
                ? '.gif'
                : mimetype === 'image/svg+xml'
                  ? '.svg'
                  : ''
    if (fromMime) return fromMime
    const ext = path.extname(original || '')
    return ext && ext.length <= 10 ? ext : ''
}

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const file = (req as any).file as Express.Multer.File | undefined
        if (!file) {
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Файл не передан' })
        }

        if (file.size < MIN_SIZE) {
            if (file.path) await unlink(file.path).catch(() => {})
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Слишком маленький файл' })
        }
        if (file.size > MAX_SIZE) {
            if (file.path) await unlink(file.path).catch(() => {})
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Слишком большой файл' })
        }

        const buf: Buffer =
            file.buffer && file.buffer.length
                ? file.buffer
                : await readFile(file.path)

        if (!isValidImageBytes(buf)) {
            if (file.path) await unlink(file.path).catch(() => {})
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Недопустимый формат' })
        }

        await mkdir(UPLOAD_DIR, { recursive: true })

        const safeBase = crypto.randomUUID().replace(/-/g, '')
        const ext = inferExt(file.originalname, file.mimetype)
        const finalName = `${safeBase}${ext}`
        const targetPath = path.join(UPLOAD_DIR, finalName)

        await writeFile(targetPath, buf)
        if (file.path) await unlink(file.path).catch(() => {})

        return res.status(constants.HTTP_STATUS_CREATED).json({
            fileName: `/${UPLOAD_SUBDIR}/${finalName}`,
            originalName: file.originalname,
            size: file.size,
            mime: file.mimetype,
        })
    } catch (e) {
        return next(e)
    }
}
