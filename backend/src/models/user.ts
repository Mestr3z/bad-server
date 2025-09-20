import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import mongoose, { Document, HydratedDocument, Model, Types } from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcrypt'
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config'
import UnauthorizedError from '../errors/unauthorized-error'

export enum Role {
    Customer = 'customer',
    Admin = 'admin',
}

export interface IUser extends Document {
    name: string
    email: string
    password: string
    tokens: { token: string }[]
    roles: Role[]
    phone: string
    totalAmount: number
    orderCount: number
    orders: Types.ObjectId[]
    lastOrderDate: Date | null
    lastOrder: Types.ObjectId | null
}

interface IUserMethods {
    generateAccessToken(): string
    generateRefreshToken(): Promise<string>
    toJSON(): string
    calculateOrderStats(): Promise<void>
}

interface IUserModel extends Model<IUser, {}, IUserMethods> {
    findUserByCredentials: (
        email: string,
        password: string
    ) => Promise<HydratedDocument<IUser, IUserMethods>>
}

const userSchema = new mongoose.Schema<IUser, IUserModel, IUserMethods>(
    {
        name: {
            type: String,
            default: 'Евлампий',
            minlength: [2, 'Минимальная длина поля "name" - 2'],
            maxlength: [30, 'Максимальная длина поля "name" - 30'],
        },
        email: {
            type: String,
            required: [true, 'Поле "email" должно быть заполнено'],
            unique: true,
            validate: {
                validator: (v: string) => validator.isEmail(v),
                message: 'Поле "email" должно быть валидным email-адресом',
            },
        },
        password: {
            type: String,
            required: [true, 'Поле "password" должно быть заполнено'],
            minlength: [6, 'Минимальная длина поля "password" - 6'],
            select: false,
        },
        // ВАЖНО: инициализируем массив токенов по умолчанию
        tokens: {
            type: [{ token: { type: String, required: true } }],
            default: [],
        },
        roles: {
            type: [String],
            enum: Object.values(Role),
            default: [Role.Customer],
        },
        phone: { type: String },
        lastOrderDate: { type: Date, default: null },
        lastOrder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'order',
            default: null,
        },
        totalAmount: { type: Number, default: 0 },
        orderCount: { type: Number, default: 0 },
        orders: [{ type: Types.ObjectId, ref: 'order' }],
    },
    {
        versionKey: false,
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (_doc, ret) => {
                delete ret.tokens
                delete ret.password
                delete ret._id
                delete ret.roles
                return ret
            },
        },
    }
)

userSchema.pre('save', async function hashingPassword(next) {
    try {
        if (this.isModified('password')) {
            this.password = await bcrypt.hash(this.password, 12)
        }
        next()
    } catch (error) {
        next(error as Error)
    }
})

userSchema.methods.generateAccessToken = function generateAccessToken() {
    const user = this
    return jwt.sign(
        { _id: user._id.toString(), email: user.email },
        ACCESS_TOKEN.secret,
        { expiresIn: ACCESS_TOKEN.expiry, subject: user.id.toString() }
    )
}

userSchema.methods.generateRefreshToken =
    async function generateRefreshToken() {
        const user = this
        const refreshToken = jwt.sign(
            { _id: user._id.toString() },
            REFRESH_TOKEN.secret,
            { expiresIn: REFRESH_TOKEN.expiry, subject: user.id.toString() }
        )

        const rTknHash = crypto
            .createHmac('sha256', REFRESH_TOKEN.secret)
            .update(refreshToken)
            .digest('hex')

        if (!Array.isArray(user.tokens)) {
            user.tokens = []
        }

        user.tokens.push({ token: rTknHash })
        await user.save()
        return refreshToken
    }

userSchema.statics.findUserByCredentials = async function findByCredentials(
    email: string,
    password: string
) {
    const user = await this.findOne({ email })
        .select('+password')
        .orFail(() => new UnauthorizedError('Неправильные почта или пароль'))

    const okBcrypt = await bcrypt.compare(password, user.password)
    if (okBcrypt) return user

    const md5 = crypto.createHash('md5').update(password).digest('hex')
    if (md5 !== user.password) {
        throw new UnauthorizedError('Неправильные почта или пароль')
    }

    user.password = await bcrypt.hash(password, 12)
    await user.save()
    return user
}

userSchema.methods.calculateOrderStats = async function calculateOrderStats() {
    const user = this
    const orderStats = await mongoose.model('order').aggregate([
        { $match: { customer: user._id } },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: '$totalAmount' },
                lastOrderDate: { $max: '$createdAt' },
                orderCount: { $sum: 1 },
                lastOrder: { $last: '$_id' },
            },
        },
    ])

    if (orderStats.length > 0) {
        const stats = orderStats[0]
        user.totalAmount = stats.totalAmount
        user.orderCount = stats.orderCount
        user.lastOrderDate = stats.lastOrderDate
        user.lastOrder = stats.lastOrder
    } else {
        user.totalAmount = 0
        user.orderCount = 0
        user.lastOrderDate = null
        user.lastOrder = null
    }

    await user.save()
}

const UserModel = mongoose.model<IUser, IUserModel>('user', userSchema)
export default UserModel
