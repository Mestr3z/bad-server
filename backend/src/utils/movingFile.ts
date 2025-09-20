import { promises as fs } from 'fs'
import { basename, resolve } from 'path'

async function movingFile(imagePath: string, from: string, to: string) {
    const fileName = basename(imagePath)
    const fromBase = resolve(from)
    const toBase = resolve(to)
    const src = resolve(fromBase, fileName)
    const dst = resolve(toBase, fileName)

    if (!src.startsWith(fromBase) || !dst.startsWith(toBase)) {
        throw new Error('Ошибка при сохранении файла')
    }

    await fs.mkdir(toBase, { recursive: true })

    try {
        await fs.access(src)
    } catch {
        throw new Error('Ошибка при сохранении файла')
    }

    await fs.rename(src, dst)
}

export default movingFile
