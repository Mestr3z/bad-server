import { Joi, celebrate, Segments } from 'celebrate'
import { Types } from 'mongoose'
import type { RequestHandler } from 'express'

export const phoneRegExp = /^\+?\d[\d\s()-]{3,20}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

const objId = (value: string, helpers: any) => {
    if (Types.ObjectId.isValid(value)) return value
    return helpers.message({ custom: 'Невалидный id' })
}

const SAFE_SEARCH_RX = /^[\p{L}\p{N}\s.,+\-()]*$/u

export const validateOrdersQuery: RequestHandler = (req, _res, next) => {
    const q = (req.query as any) || {}

    const rawLimit = Number(q.limit)
    const limit =
        Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 10
    q.limit = Math.min(Math.max(limit, 1), 10)

    const rawPage = Number(q.page)
    q.page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1

    const ALLOWED_SORT_FIELDS = new Set([
        'createdAt',
        'totalAmount',
        'orderNumber',
        'status',
    ])
    q.sortField = ALLOWED_SORT_FIELDS.has(String(q.sortField))
        ? String(q.sortField)
        : 'createdAt'

    q.sortOrder =
        String(q.sortOrder) === 'asc' || String(q.sortOrder) === 'desc'
            ? String(q.sortOrder)
            : 'desc'

    if (typeof q.status === 'string') {
        const s = q.status.trim()
        if (!s || s.length > 32) delete q.status
        else q.status = s
    } else {
        delete q.status
    }

    const numOrDrop = (v: any) =>
        Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null

    const from = numOrDrop(q.totalAmountFrom)
    const to = numOrDrop(q.totalAmountTo)
    if (from === null) delete q.totalAmountFrom
    else q.totalAmountFrom = from
    if (to === null) delete q.totalAmountTo
    else q.totalAmountTo = to

    const dateOrDrop = (v: any) => {
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d.toISOString()
    }
    const dFrom = dateOrDrop(q.orderDateFrom)
    const dTo = dateOrDrop(q.orderDateTo)
    if (dFrom === null) delete q.orderDateFrom
    else q.orderDateFrom = dFrom
    if (dTo === null) delete q.orderDateTo
    else q.orderDateTo = dTo

    if (typeof q.search === 'string') {
        const s = q.search.trim()
        if (!s || s.length > 64 || !SAFE_SEARCH_RX.test(s)) delete q.search
        else q.search = s
    } else {
        delete q.search
    }

    req.query = q
    next()
}

export const validateUsersQuery = celebrate({
    [Segments.QUERY]: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number()
            .integer()
            .min(1)
            .default(10)
            .custom((v) => (v > 10 ? 10 : v)),
        search: Joi.string().trim().max(64).pattern(SAFE_SEARCH_RX),
    }).unknown(false),
})

export const validateOrderBody = celebrate({
    [Segments.BODY]: Joi.object({
        items: Joi.array()
            .items(Joi.string().custom(objId))
            .min(1)
            .required()
            .messages({
                'array.min': 'Не указаны товары',
                'any.required': 'Не указаны товары',
            }),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'any.only':
                    'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
                'any.required': 'Не указан способ оплаты',
            }),
        email: Joi.string().email().required().max(254).messages({
            'string.email': 'Поле "email" должно быть валидным email-адресом',
            'any.required': 'Не указан email',
        }),
        phone: Joi.string().pattern(phoneRegExp).required().messages({
            'string.pattern.base':
                'Поле "phone" должно быть валидным телефоном.',
            'any.required': 'Не указан телефон',
        }),
        address: Joi.string().required().max(512).messages({
            'any.required': 'Не указан адрес',
        }),
        comment: Joi.string().allow('').max(2000),
    }).required(),
})

export const validateProductBody = celebrate({
    [Segments.BODY]: Joi.object({
        title: Joi.string().trim().min(2).max(30).required().messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
            'any.required': 'Поле "title" должно быть заполнено',
        }),
        image: Joi.object({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }).required(),
        category: Joi.string().trim().required().messages({
            'any.required': 'Поле "category" должно быть заполнено',
        }),
        description: Joi.string().trim().required().max(5000).messages({
            'any.required': 'Поле "description" должно быть заполнено',
        }),
        price: Joi.number().allow(null).min(0),
    }).required(),
})

export const validateProductUpdateBody = celebrate({
    [Segments.BODY]: Joi.object({
        title: Joi.string().trim().min(2).max(30),
        image: Joi.object({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string().trim(),
        description: Joi.string().trim().max(5000),
        price: Joi.number().allow(null).min(0),
    }).min(1),
})

export const validateObjId = celebrate({
    [Segments.PARAMS]: Joi.object({
        productId: Joi.string().required().custom(objId),
    }),
})

export const validateCustomerId = celebrate({
    [Segments.PARAMS]: Joi.object({
        id: Joi.string().required().custom(objId),
    }),
})

export const validateUserBody = celebrate({
    [Segments.BODY]: Joi.object({
        name: Joi.string().min(2).max(30),
        password: Joi.string().min(6).required().messages({
            'any.required': 'Поле "password" должно быть заполнено',
        }),
        email: Joi.string().email().required().max(254).messages({
            'string.email': 'Поле "email" должно быть валидным email-адресом',
            'any.required': 'Поле "email" должно быть заполнено',
        }),
    }).required(),
})

export const validateAuthentication = celebrate({
    [Segments.BODY]: Joi.object({
        email: Joi.string().email().required().max(254).messages({
            'string.email': 'Поле "email" должно быть валидным email-адресом',
            'any.required': 'Поле "email" должно быть заполнено',
        }),
        password: Joi.string().required().messages({
            'any.required': 'Поле "password" должно быть заполнено',
        }),
    }).required(),
})

export const validateSearchParams = celebrate({
    [Segments.QUERY]: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number()
            .integer()
            .min(1)
            .default(10)
            .custom((v) => (v > 10 ? 10 : v)),
        search: Joi.string().trim().max(64).pattern(SAFE_SEARCH_RX),
        category: Joi.string().trim().max(64),
        priceFrom: Joi.number().min(0),
        priceTo: Joi.number().min(0),
        sortField: Joi.string()
            .valid('createdAt', 'price', 'title')
            .default('createdAt'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    }).unknown(false),
})
