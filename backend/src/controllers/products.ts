import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { join } from 'path'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'
import escapeRegExp from '../utils/escapeRegExp'
import { UPLOAD_PATH, UPLOAD_PATH_TEMP } from '../config'

const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q : ''
        const limit = Math.min(
            Math.max(parseInt(String(req.query.limit ?? '20'), 10), 1),
            100
        )
        const offsetByParam = Math.max(
            parseInt(String(req.query.offset ?? '0'), 10),
            0
        )
        const page = Math.max(parseInt(String(req.query.page ?? '0'), 10), 0)
        const offset = page > 0 ? (page - 1) * limit : offsetByParam
        const filter: any = {}
        if (q) filter.title = { $regex: escapeRegExp(q), $options: 'i' }
        const [items, total] = await Promise.all([
            Product.find(filter).skip(offset).limit(limit).lean(),
            Product.countDocuments(filter),
        ])
        return res.send({ items, total })
    } catch (err) {
        return next(err)
    }
}

const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { description, category, price, title, image } = req.body
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${UPLOAD_PATH}`)
            )
        }
        const product = await Product.create({
            description,
            image: image || undefined,
            category,
            price: price ?? null,
            title,
        })
        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const { description, category, price, title, image } = req.body
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${UPLOAD_PATH}`)
            )
        }
        const $set: any = {}
        if (description !== undefined) $set.description = description
        if (category !== undefined) $set.category = category
        if (title !== undefined) $set.title = title
        if (price !== undefined) $set.price = price ?? null
        if (image !== undefined) $set.image = image
        const product = await Product.findByIdAndUpdate(
            productId,
            { $set },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
