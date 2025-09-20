import { Joi, celebrate, Segments } from 'celebrate'
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
        total: Joi.number().required().min(0).messages({
            'any.required': 'Не указана сумма заказа',
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
        q: Joi.string().max(64).allow('', null),
        limit: Joi.number().integer().min(1).max(100).default(20),
        offset: Joi.number().integer().min(0).default(0),
    }),
})
