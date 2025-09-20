import { existsSync, rename } from 'fs'
import { basename, join, resolve } from 'path'

function movingFile(imagePath: string, from: string, to: string) {
  const fileName = basename(imagePath)
  const fromBase = resolve(from)
  const toBase = resolve(to)
  const src = resolve(fromBase, fileName)
  const dst = resolve(toBase, fileName)
  if (!src.startsWith(fromBase) || !dst.startsWith(toBase)) {
    throw new Error('Ошибка при сохранении файла')
  }
  if (!existsSync(src)) {
    throw new Error('Ошибка при сохранении файла')
  }
  rename(src, dst, (err) => {
    if (err) {
      throw new Error('Ошибка при сохранении файла')
    }
  })
}

export default movingFile
