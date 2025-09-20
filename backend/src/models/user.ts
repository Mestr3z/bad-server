import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { HydratedDocument, Model, Types } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config';
import UnauthorizedError from '../errors/unauthorized-error';

export enum Role {
  Customer = 'customer',
  Admin = 'admin',
}

export interface IUser {
  name: string;
  email: string;
  password: string;
  tokens: { token: string }[];
  roles: Role[];
  phone?: string;
  totalAmount: number;
  orderCount: number;
  orders: Types.ObjectId[];
  lastOrderDate: Date | null;
  lastOrder: Types.ObjectId | null;
}

interface IUserMethods {
  generateAccessToken(): string;
  generateRefreshToken(): Promise<string>;
  calculateOrderStats(): Promise<void>;
}

interface IUserModel extends Model<IUser, {}, IUserMethods> {
  findUserByCredentials(
    email: string,
    password: string
  ): Promise<HydratedDocument<IUser, IUserMethods>>;
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
        const r: any = ret;
        delete r.tokens;
        delete r.password;
        delete r._id;
        delete r.roles;
        return r;
      },
    },
  }
);

userSchema.pre('save', async function hashingPassword(next) {
  try {
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.methods.generateAccessToken = function generateAccessToken() {
  const user = this as HydratedDocument<IUser, IUserMethods>;
  return jwt.sign(
    { _id: String(user._id), email: user.email },
    ACCESS_TOKEN.secret,
    { expiresIn: ACCESS_TOKEN.expiry, subject: String(user._id) }
  );
};

userSchema.methods.generateRefreshToken = async function generateRefreshToken() {
  const user = this as HydratedDocument<IUser, IUserMethods>;

  const refreshToken = jwt.sign(
    { _id: String(user._id) },
    REFRESH_TOKEN.secret,
    { expiresIn: REFRESH_TOKEN.expiry, subject: String(user._id) }
  );

  const rTknHash = crypto
    .createHmac('sha256', REFRESH_TOKEN.secret)
    .update(refreshToken)
    .digest('hex');

  if (!Array.isArray(user.tokens)) {
    user.tokens = [];
  }
  user.tokens.push({ token: rTknHash });
  await user.save();

  return refreshToken;
};

userSchema.statics.findUserByCredentials = async function findByCredentials(
  this: IUserModel,
  email: string,
  password: string
) {
  const user = await this.findOne({ email })
    .select('+password')
    .orFail(() => new UnauthorizedError('Неправильные почта или пароль'));

  const okBcrypt = await bcrypt.compare(password, (user as any).password);
  if (okBcrypt) return user;

  const md5 = crypto.createHash('md5').update(password).digest('hex');
  if (md5 !== (user as any).password) {
    throw new UnauthorizedError('Неправильные почта или пароль');
  }

  (user as any).password = await bcrypt.hash(password, 12);
  await user.save();
  return user;
};

userSchema.methods.calculateOrderStats = async function calculateOrderStats() {
  const user = this as HydratedDocument<IUser, IUserMethods>;
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
  ]);

  if (orderStats.length > 0) {
    const stats = orderStats[0] as any;
    user.totalAmount = stats.totalAmount ?? 0;
    user.orderCount = stats.orderCount ?? 0;
    user.lastOrderDate = stats.lastOrderDate ?? null;
    user.lastOrder = stats.lastOrder ?? null;
  } else {
    user.totalAmount = 0;
    user.orderCount = 0;
    user.lastOrderDate = null;
    user.lastOrder = null;
  }

  await user.save();
};

const UserModel = mongoose.model<IUser, IUserModel>('user', userSchema);
export default UserModel;
