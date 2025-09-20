import { Request, Response, NextFunction } from 'express'
import { unlink } from 'fs'
import { join, resolve } from 'path'
import BadRequestError from '../errors/bad-request-error'
import movingFile from '../utils/movingFile'

const ALLOWED = new Set([
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/webp',
])

export async function uploadFile(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const file = req.file as Express.Multer.File | undefined
        if (!file) return next(new BadRequestError('Файл не передан'))
        const { fileTypeFromFile } = await import('file-type')
        const fullPath = join(file.destination, file.filename)
        const ft = await fileTypeFromFile(fullPath).catch(() => null)
        if (!ft || !ALLOWED.has(ft.mime)) {
            unlink(fullPath, () => {})
            return next(new BadRequestError('Недопустимый тип файла'))
        }
        const pubBase = resolve(__dirname, '../public')
        const tempBase = resolve(file.destination)
        movingFile(file.filename, tempBase, pubBase)
        return res
            .status(201)
            .json({ fileName: file.filename, originalName: file.originalname })
    } catch (e) {
        return next(e)
    }
}
