import { unlink } from 'fs'
import mongoose, { Document, UpdateQuery } from 'mongoose'
import { join, basename, resolve } from 'path'

export interface IFile {
  fileName: string
  originalName: string
}

export interface IProduct extends Document {
  title: string
  image: IFile
  category: string
  description: string
  price: number
}

const cardsSchema = new mongoose.Schema<IProduct>(
  {
    title: {
      type: String,
      unique: true,
      required: [true, 'Поле "title" должно быть заполнено'],
      minlength: [2, 'Минимальная длина поля "title" - 2'],
      maxlength: [30, 'Максимальная длина поля "title" - 30'],
    },
    image: {
      fileName: { type: String, required: [true, 'Поле "image.fileName" должно быть заполнено'] },
      originalName: String,
    },
    category: { type: String, required: [true, 'Поле "category" должно быть заполнено'] },
    description: { type: String },
    price: { type: Number, default: null },
  },
  { versionKey: false }
)

cardsSchema.index({ title: 'text' })

cardsSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate() as UpdateQuery<IProduct> | null
  if (!update) return
  const updateImage = (update as any).$set?.image
  if (!updateImage) return
  const docToUpdate = await this.model.findOne(this.getQuery())
  if (!docToUpdate?.image?.fileName) return
  const base = resolve(__dirname, '../public')
  const safe = join(base, basename(docToUpdate.image.fileName))
  unlink(safe, () => {})
})

cardsSchema.post('findOneAndDelete', async (doc: IProduct) => {
  const base = resolve(__dirname, '../public')
  const safe = join(base, basename(doc.image.fileName))
  unlink(safe, () => {})
})

export default mongoose.model<IProduct>('product', cardsSchema)
