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

function isValidImageBytes(buf: Buffer): boolean {
    if (buf.length < 12) return false

    if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
    )
        return true

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true

    if (
        buf[0] === 0x47 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x38 &&
        (buf[4] === 0x37 || buf[4] === 0x39) &&
        buf[5] === 0x61
    )
        return true

    if (
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
    )
        return true

    if (
        buf[4] === 0x66 &&
        buf[5] === 0x74 &&
        buf[6] === 0x79 &&
        buf[7] === 0x70
    )
        return true

    return false
}

const A = (s: string) => Buffer.from(s, 'ascii')

function hasForbiddenMetadata(buf: Buffer): boolean {
    const quick = [
        A('tEXt'),
        A('zTXt'),
        A('iTXt'),
        A('eXIf'),
        A('tIME'),
        A('Exif\0\0'),
        A('ICC_PROFILE'),
        A('XMP '), 
        A('http://ns.adobe.com/xap/1.0/'), 
    ]
    for (const n of quick) if (buf.indexOf(n) !== -1) return true

    try {
        const PNG_SIG = A('\x89PNG\r\n\x1a\n')
        if (buf.length >= 8 && buf.slice(0, 8).equals(PNG_SIG)) {
            let off = 8
            while (off + 8 <= buf.length) {
                const len = buf.readUInt32BE(off)
                off += 4
                const type = buf.slice(off, off + 4).toString('ascii')
                off += 4
                if (len < 0 || off + len + 4 > buf.length) break
                if (
                    type === 'tEXt' ||
                    type === 'zTXt' ||
                    type === 'iTXt' ||
                    type === 'eXIf' ||
                    type === 'tIME'
                )
                    return true
                off += len + 4 
                if (type === 'IEND') break
            }
        }

        if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) {
            let off = 2
            while (off + 4 <= buf.length) {
                if (buf[off] !== 0xff) break
                const marker = buf[off + 1]
                off += 2
                if (marker === 0xd9 || marker === 0xda) break 
                if (off + 2 > buf.length) break
                const segLen = buf.readUInt16BE(off)
                off += 2
                if (segLen < 2 || off + segLen - 2 > buf.length) break
                const seg = buf.slice(off, off + segLen - 2)
                off += segLen - 2

                if (marker === 0xe1) {
                    if (seg.slice(0, 6).toString() === 'Exif\0\0') return true
                    if (
                        seg.slice(0, 29).toString() ===
                        'http://ns.adobe.com/xap/1.0/'
                    )
                        return true
                }
                if (
                    marker === 0xe2 &&
                    seg.slice(0, 11).toString() === 'ICC_PROFILE'
                )
                    return true
                if (marker === 0xed) return true
            }
        }

        if (
            buf.length >= 12 &&
            buf.slice(0, 4).toString('ascii') === 'RIFF' &&
            buf.slice(8, 12).toString('ascii') === 'WEBP'
        ) {
            let off = 12
            while (off + 8 <= buf.length) {
                const chunkType = buf.slice(off, off + 4).toString('ascii')
                const chunkLen = buf.readUInt32LE(off + 4)
                off += 8
                if (off + chunkLen > buf.length) break
                if (chunkType === 'EXIF' || chunkType === 'XMP ') return true
                off += chunkLen + (chunkLen % 2) 
            }
        }
    } catch {
    }
    return false
}

function inferExt(original: string, mimetype?: string): string {
    const fromMime =
        mimetype === 'image/png'
            ? '.png'
            : mimetype === 'image/jpeg'
              ? '.jpg'
              : mimetype === 'image/gif'
                ? '.gif'
                : mimetype === 'image/webp'
                  ? '.webp'
                  : mimetype === 'image/avif'
                    ? '.avif'
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

        const buf: Buffer = file.buffer?.length
            ? file.buffer
            : await readFile(file.path)

        if (!isValidImageBytes(buf)) {
            if (file.path) await unlink(file.path).catch(() => {})
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Недопустимый формат' })
        }
        if (hasForbiddenMetadata(buf)) {
            if (file.path) await unlink(file.path).catch(() => {})
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Недопустимые метаданные изображения' })
        }

        await mkdir(UPLOAD_DIR, { recursive: true })

        const safeBase = crypto.randomUUID().replace(/-/g, '')
        const ext = inferExt(file.originalname, file.mimetype)
        const finalName = `${safeBase}${ext}`
        const targetPath = path.join(UPLOAD_DIR, finalName)

        await writeFile(targetPath, buf)
        if (file.path) await unlink(file.path).catch(() => {})

        return res.status(constants.HTTP_STATUS_CREATED).json({
            fileName: `${UPLOAD_SUBDIR}/${finalName}`,
            originalName: file.originalname,
            size: file.size,
            mime: file.mimetype,
        })
    } catch (e) {
        return next(e)
    }
}
