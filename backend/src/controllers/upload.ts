import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { readFile, unlink } from 'fs/promises'

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

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.file) {
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Файл не передан' })
        }
        if (req.file.size < 2 * 1024) {
            await unlink(req.file.path)
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Слишком маленький файл' })
        }
        const buf = await readFile(req.file.path)
        if (!isValidImageBytes(buf)) {
            await unlink(req.file.path)
            return res
                .status(constants.HTTP_STATUS_BAD_REQUEST)
                .json({ message: 'Недопустимый формат' })
        }
        return res.status(constants.HTTP_STATUS_CREATED).json({
            fileName: req.file.filename,
            filename: req.file.filename,
            originalName: req.file.originalname,
        })
    } catch (e) {
        return next(e)
    }
}
