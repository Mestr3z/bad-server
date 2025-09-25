import type { RequestHandler } from 'express'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import sharp from 'sharp'

const MIN_SIZE = 2 * 1024
const PUBLIC_DIR = path.resolve(process.cwd(), 'src', 'public')
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images')

const formatToExt = (fmt?: string | null) => {
    switch (fmt) {
        case 'jpeg':
            return 'jpg'
        case 'png':
        case 'webp':
        case 'gif':
        case 'avif':
            return fmt
        default:
            return null
    }
}

const extToMime = (ext: string) =>
    ext === 'jpg' ? 'image/jpeg' : `image/${ext}`

export const uploadHandler: RequestHandler = async (req, res) => {
    try {
        const f = (req as any).file as
            | { buffer: Buffer; size: number; originalname: string }
            | undefined

        if (!f) return res.status(400).json({ error: 'No file' })
        if (f.size <= MIN_SIZE) {
            return res.status(400).json({ error: 'File too small' })
        }

        let meta
        try {
            meta = await sharp(f.buffer).metadata()
        } catch {
            return res.status(400).json({ error: 'Invalid image data' })
        }

        if (!meta.format || !meta.width || !meta.height) {
            return res.status(400).json({ error: 'Image metadata required' })
        }

        const ext = formatToExt(meta.format)
        if (!ext) {
            return res.status(400).json({ error: 'Unsupported image format' })
        }

        const name = crypto.randomBytes(16).toString('hex')
        const relPath = path.posix.join('images', `${name}.${ext}`)
        const absDir = IMAGES_DIR
        const absPath = path.join(absDir, `${name}.${ext}`)

        await fs.mkdir(absDir, { recursive: true })

        const pipeline = sharp(f.buffer)
        switch (ext) {
            case 'jpg':
                await pipeline.jpeg({ quality: 90 }).toFile(absPath)
                break
            case 'png':
                await pipeline.png({ compressionLevel: 9 }).toFile(absPath)
                break
            case 'webp':
                await pipeline.webp({ quality: 90 }).toFile(absPath)
                break
            case 'gif':
                await pipeline.gif().toFile(absPath)
                break
            case 'avif':
                await pipeline.avif({ quality: 50 }).toFile(absPath)
                break
        }

        return res.status(201).json({
            fileName: relPath,
            originalName: f.originalname,
            size: f.size,
            mime: extToMime(ext),
        })
    } catch (e) {
        return res.status(500).json({ error: 'Upload failed' })
    }
}
