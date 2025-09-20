import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import UnauthorizedError from '../errors/unauthorized-error';
import ForbiddenError from '../errors/forbidden-error';
import User, { type Role } from '../models/user';
import { ACCESS_TOKEN } from '../config';

export type ReqWithUser = Request & {
  user?: { _id: string; roles: Role[] };
};

const ACCESS_SECRET = ACCESS_TOKEN.secret || 'dev-access-secret';

export const auth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return next(new UnauthorizedError('Необходима авторизация'));

    const payload = jwt.verify(token, ACCESS_SECRET) as {
      id?: string; _id?: string; sub?: string; roles?: Role[];
    };

    const userId = String(payload.id ?? payload._id ?? payload.sub ?? '');
    if (!userId) return next(new UnauthorizedError('Необходима авторизация'));

    let roles = Array.isArray(payload.roles) ? payload.roles : undefined;
    if (!roles) {
      const u = await User.findById(userId).select('roles').lean();
      roles = (u?.roles as Role[]) ?? [];
    }

    (req as ReqWithUser).user = { _id: userId, roles };
    next();
  } catch {
    next(new UnauthorizedError('Необходима авторизация'));
  }
};

export const roleGuardMiddleware =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    const user = (req as ReqWithUser).user;
    if (!user?._id) return next(new UnauthorizedError('Необходима авторизация'));
    if (!allowed.some((r) => user.roles?.includes(r))) {
      return next(new ForbiddenError('Доступ запрещён'));
    }
    next();
  };
