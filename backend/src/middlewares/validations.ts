import { celebrate, Joi, Segments } from 'celebrate'
import { Types } from 'mongoose'

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

export const validateSearchParams = celebrate({
    [Segments.QUERY]: Joi.object({
        q: Joi.string().trim().max(64).pattern(SAFE_SEARCH_RX),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(10).default(10),
        sortField: Joi.string().trim().max(64),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
        category: Joi.string().trim().max(64),
        priceFrom: Joi.number().min(0),
        priceTo: Joi.number().min(0),
    }).unknown(true),
})

export const validateOrdersQuery = celebrate({
    [Segments.QUERY]: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(10).default(10),
        sortField: Joi.string()
            .valid('createdAt', 'totalAmount', 'orderNumber', 'status')
            .default('createdAt'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
        status: Joi.string().trim().max(32),
        totalAmountFrom: Joi.number().min(0),
        totalAmountTo: Joi.number().min(0),
        orderDateFrom: Joi.date().iso(),
        orderDateTo: Joi.date().iso(),
        search: Joi.string().trim().max(64).pattern(SAFE_SEARCH_RX),
    }).unknown(false),
})

export const validateUsersQuery = celebrate({
    [Segments.QUERY]: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(10).default(10),
        search: Joi.string().trim().max(64).pattern(SAFE_SEARCH_RX),
    }).unknown(false),
})

export const validateOrderBody = celebrate({
    [Segments.BODY]: Joi.object({
        items: Joi.array().items(Joi.string().custom(objId)).min(1).required(),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required(),
        email: Joi.string().email().required().max(254),
        phone: Joi.string().pattern(phoneRegExp).required(),
        address: Joi.string().required().max(512),
        comment: Joi.string().allow('').max(2000),
    }).required(),
})

export const validateProductBody = celebrate({
    [Segments.BODY]: Joi.object({
        title: Joi.string().trim().min(2).max(30).required(),
        image: Joi.object({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }).required(),
        category: Joi.string().trim().required(),
        description: Joi.string().trim().required().max(5000),
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

export const validateUserBody = celebrate({
    [Segments.BODY]: Joi.object({
        name: Joi.string().min(2).max(30),
        password: Joi.string().min(6).required(),
        email: Joi.string().email().required().max(254),
    }).required(),
})

export const validateAuthentication = celebrate({
    [Segments.BODY]: Joi.object({
        email: Joi.string().email().required().max(254),
        password: Joi.string().required(),
    }).required(),
})
