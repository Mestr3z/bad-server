import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN } from '../config';
import UnauthorizedError from '../errors/unauthorized-error';
import ForbiddenError from '../errors/forbidden-error';
import User, { Role } from '../models/user';

type JwtPayload = { _id: string; email?: string };

export type ReqWithUser = Request & {
    user?: {
      _id: string;
      email?: string;
      roles?: ('customer' | 'admin')[];
    };
  };

export async function auth(req: ReqWithUser, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  const token =
    (req.cookies?.accessToken as string | undefined) ??
    (bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined);

  if (!token) return next(new UnauthorizedError('Необходима авторизация'));

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN.secret) as JwtPayload;
    req.user = { _id: payload._id, ...(payload.email && { email: payload.email }) };
    return next();
  } catch {
    return next(new UnauthorizedError('Необходима авторизация'));
  }
}

export function roleGuardMiddleware(role: Role) {
  return async (req: ReqWithUser, _res: Response, next: NextFunction) => {
    if (!req.user?._id) return next(new UnauthorizedError('Необходима авторизация'));

    const user = await User.findById(req.user._id);
    if (!user || !user.roles.includes(role)) {
      return next(new ForbiddenError('Доступ запрещён'));
    }

    return next();
  };
}
