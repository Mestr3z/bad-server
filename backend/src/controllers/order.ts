import { NextFunction, Request, Response } from 'express'
import { Error as MongooseError } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { StatusType } from '../models/order'
import Product, { IProduct } from '../models/product'
import escapeRegExp from '../utils/escapeRegExp'
import type { ReqWithUser } from '../middlewares/auth'

const SORT_WHITELIST = new Set([
    'createdAt',
    'totalAmount',
    'orderNumber',
    'status',
])

const parsePositiveInt = (v: unknown, fallback: number) => {
    const n = Number.parseInt(String(v ?? ''), 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}
const clamp = (n: number, min: number, max: number) =>
    Math.min(Math.max(n, min), max)

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if ('search' in req.query && typeof req.query.search !== 'string') {
            return next(new BadRequestError('Некорректный параметр поиска'))
        }

        const page = clamp(
            parsePositiveInt(req.query.page, 1),
            1,
            Number.MAX_SAFE_INTEGER
        )
        const limit = clamp(parsePositiveInt(req.query.limit, 10), 1, 10)
        const skip = (page - 1) * limit

        const sortFieldRaw = String(req.query.sortField ?? 'createdAt')
        const sortField = SORT_WHITELIST.has(sortFieldRaw)
            ? sortFieldRaw
            : 'createdAt'
        const sortOrder =
            String(req.query.sortOrder ?? 'desc').toLowerCase() === 'asc'
                ? 1
                : -1

        const status = req.query.status ? String(req.query.status) : ''
        const totalFrom =
            req.query.totalAmountFrom !== undefined
                ? Number(req.query.totalAmountFrom)
                : undefined
        const totalTo =
            req.query.totalAmountTo !== undefined
                ? Number(req.query.totalAmountTo)
                : undefined
        const dateFrom = req.query.orderDateFrom
            ? new Date(String(req.query.orderDateFrom))
            : undefined
        const dateTo = req.query.orderDateTo
            ? new Date(String(req.query.orderDateTo))
            : undefined
        const search =
            typeof req.query.search === 'string' ? req.query.search : ''

        const match: Record<string, any> = {}
        if (status && Object.values(StatusType).includes(status as StatusType))
            match.status = status
        if (typeof totalFrom === 'number' && !Number.isNaN(totalFrom)) {
            match.totalAmount = {
                ...(match.totalAmount || {}),
                $gte: totalFrom,
            }
        }
        if (typeof totalTo === 'number' && !Number.isNaN(totalTo)) {
            match.totalAmount = { ...(match.totalAmount || {}), $lte: totalTo }
        }
        if (dateFrom instanceof Date && !Number.isNaN(dateFrom.getTime())) {
            match.createdAt = { ...(match.createdAt || {}), $gte: dateFrom }
        }
        if (dateTo instanceof Date && !Number.isNaN(dateTo.getTime())) {
            match.createdAt = { ...(match.createdAt || {}), $lte: dateTo }
        }

        const basePipeline: any[] = [{ $match: match }]

        const searchNum = Number(search)
        const byNumber = !Number.isNaN(searchNum)
        if (search && byNumber) {
            basePipeline.push({ $match: { orderNumber: searchNum } })
        } else if (search) {
            const rx = new RegExp(escapeRegExp(search), 'i')
            basePipeline.push(
                {
                    $lookup: {
                        from: 'products',
                        localField: 'products',
                        foreignField: '_id',
                        as: 'products',
                    },
                },
                { $match: { 'products.title': { $regex: rx } } }
            )
        }

        const dataPipeline = [
            ...basePipeline,
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true,
                },
            },
            { $sort: { [sortField]: sortOrder, _id: 1 } },
            { $skip: skip },
            { $limit: limit },
        ]

        const countPipeline = [
            ...basePipeline,
            { $project: { _id: 1 } },
            { $group: { _id: '$_id' } },
            { $count: 'total' },
        ]

        const [ordersRaw, counted] = await Promise.all([
            Order.aggregate(dataPipeline),
            Order.aggregate(countPipeline),
        ])

        const totalOrders = counted[0]?.total || 0
        const totalPages = totalOrders > 0 ? Math.ceil(totalOrders / limit) : 0

        return res.status(200).json({
            orders: ordersRaw,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: page,
                pageSize: limit,
            },
        })
    } catch (error) {
        return next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: ReqWithUser,
    res: Response,
    next: NextFunction
) => {
    try {
        if ('search' in req.query && typeof req.query.search !== 'string') {
            return next(new BadRequestError('Некорректный параметр поиска'))
        }
        const userId = req.user?._id
        const page = clamp(
            parsePositiveInt(req.query.page, 1),
            1,
            Number.MAX_SAFE_INTEGER
        )
        const limit = clamp(parsePositiveInt(req.query.limit, 5), 1, 10)
        const skip = (page - 1) * limit

        const search =
            typeof req.query.search === 'string' ? req.query.search : ''
        const match: Record<string, any> = { customer: userId }
        const basePipeline: any[] = [{ $match: match }]

        const searchNum = Number(search)
        const byNumber = !Number.isNaN(searchNum)
        if (search && byNumber) {
            basePipeline.push({ $match: { orderNumber: searchNum } })
        } else if (search) {
            const rx = new RegExp(escapeRegExp(search), 'i')
            basePipeline.push(
                {
                    $lookup: {
                        from: 'products',
                        localField: 'products',
                        foreignField: '_id',
                        as: 'products',
                    },
                },
                { $match: { 'products.title': { $regex: rx } } }
            )
        }

        const dataPipeline = [
            ...basePipeline,
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            {
                $unwind: {
                    path: '$customer',
                    preserveNullAndEmptyArrays: true,
                },
            },
            { $sort: { createdAt: -1, _id: 1 } },
            { $skip: skip },
            { $limit: limit },
        ]

        const countPipeline = [
            ...basePipeline,
            { $project: { _id: 1 } },
            { $group: { _id: '$_id' } },
            { $count: 'total' },
        ]

        const [orders, counted] = await Promise.all([
            Order.aggregate(dataPipeline),
            Order.aggregate(countPipeline),
        ])
        const totalOrders = counted[0]?.total || 0
        const totalPages = totalOrders > 0 ? Math.ceil(totalOrders / limit) : 0

        return res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: page,
                pageSize: limit, 
            },
        })
    } catch (error) {
        return next(error)
    }
}

export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: ReqWithUser,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
            customer: req.user?._id,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const createOrder = async (
    req: ReqWithUser,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?._id
        const { address, payment, phone, email, items, comment } = req.body as {
            address: string
            payment: string
            phone: string
            email: string
            items: string[]
            comment?: string
        }

        const ids = Array.isArray(items) ? items.map(String) : []
        if (ids.length === 0)
            return next(new BadRequestError('Не указаны товары'))

        const freq = new Map<string, number>()
        for (const id of ids) freq.set(id, (freq.get(id) || 0) + 1)

        const products = await Product.find<IProduct>({
            _id: { $in: Array.from(freq.keys()) },
            price: { $ne: null },
        })
        if (products.length === 0)
            return next(new BadRequestError('Товары не найдены'))

        let totalAmount = 0
        for (const p of products) {
            const count = freq.get(String(p._id)) || 0
            totalAmount += (p.price || 0) * count
        }

        const newOrder = new Order({
            totalAmount,
            products: ids,
            payment,
            phone,
            email,
            comment: comment || '',
            customer: userId,
            deliveryAddress: address,
        })

        const saved = await newOrder.save()
        const populated = await saved.populate(['customer', 'products'])
        return res.status(200).json(populated)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body as { status: StatusType }
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
