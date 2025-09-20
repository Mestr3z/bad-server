import { NextFunction, Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import NotFoundError from '../errors/not-found-error';
import Order from '../models/order';
import User, { IUser } from '../models/user';
import escapeRegExp from '../utils/escapeRegExp';

const SORT_WHITELIST = new Set(['createdAt', 'lastOrderDate', 'totalAmount', 'orderCount', 'name', 'email']);

export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageRaw = Number(req.query.page ?? 1);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.trunc(pageRaw) : 1;

    const limitRaw = Number(req.query.limit ?? 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10, 1), 10);
    const skip = (page - 1) * limit;

    const sortFieldRaw = String(req.query.sortField ?? 'createdAt');
    const sortField = SORT_WHITELIST.has(sortFieldRaw) ? sortFieldRaw : 'createdAt';
    const sortOrder = String(req.query.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const {
      registrationDateFrom,
      registrationDateTo,
      lastOrderDateFrom,
      lastOrderDateTo,
      totalAmountFrom,
      totalAmountTo,
      orderCountFrom,
      orderCountTo,
    } = req.query;

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const filters: FilterQuery<Partial<IUser>> = {};

    if (registrationDateFrom) {
      const d = new Date(String(registrationDateFrom));
      if (!Number.isNaN(d.getTime())) {
        filters.createdAt = { ...(filters.createdAt || {}), $gte: d };
      }
    }
    if (registrationDateTo) {
      const d = new Date(String(registrationDateTo));
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        filters.createdAt = { ...(filters.createdAt || {}), $lte: d };
      }
    }
    if (lastOrderDateFrom) {
      const d = new Date(String(lastOrderDateFrom));
      if (!Number.isNaN(d.getTime())) {
        filters.lastOrderDate = { ...(filters.lastOrderDate || {}), $gte: d };
      }
    }
    if (lastOrderDateTo) {
      const d = new Date(String(lastOrderDateTo));
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        filters.lastOrderDate = { ...(filters.lastOrderDate || {}), $lte: d };
      }
    }

    const totalFrom = Number(totalAmountFrom);
    if (Number.isFinite(totalFrom)) {
      filters.totalAmount = { ...(filters.totalAmount || {}), $gte: totalFrom };
    }
    const totalTo = Number(totalAmountTo);
    if (Number.isFinite(totalTo)) {
      filters.totalAmount = { ...(filters.totalAmount || {}), $lte: totalTo };
    }

    const cntFrom = Number(orderCountFrom);
    if (Number.isFinite(cntFrom)) {
      filters.orderCount = { ...(filters.orderCount || {}), $gte: cntFrom };
    }
    const cntTo = Number(orderCountTo);
    if (Number.isFinite(cntTo)) {
      filters.orderCount = { ...(filters.orderCount || {}), $lte: cntTo };
    }

    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      const orders = await Order.find({ deliveryAddress: rx }, '_id', { limit: 200 });
      const orderIds = orders.map((o) => o._id);

      filters.$or = [{ name: rx }, { email: rx }, { lastOrder: { $in: orderIds } }];
    }

    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder as 1 | -1 };

    const users = await User.find(filters, { tokens: 0, password: 0, roles: 0 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate([
        'orders',
        { path: 'lastOrder', populate: { path: 'products' } },
        { path: 'lastOrder', populate: { path: 'customer' } },
      ]);

    const totalUsers = await User.countDocuments(filters);
    const totalPages = Math.ceil(totalUsers / limit);

    return res.status(200).json({
      customers: users,
      pagination: { totalUsers, totalPages, currentPage: page, pageSize: limit },
    });
  } catch (error) {
    return next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -tokens')
      .populate(['orders', 'lastOrder'])
      .orFail(() => new NotFoundError('Пользователь не найден'));
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone } = req.body as { name?: string; phone?: string };
    const $set: any = {};
    if (typeof name === 'string') $set.name = name;
    if (typeof phone === 'string') $set.phone = phone;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set },
      { new: true, runValidators: true }
    )
      .select('-password -tokens')
      .orFail(() => new NotFoundError('Пользователь по заданному id отсутствует в базе'))
      .populate(['orders', 'lastOrder']);

    return res.status(200).json(updatedUser);
  } catch (error) {
    return next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
      () => new NotFoundError('Пользователь по заданному id отсутствует в базе')
    );
    return res.status(200).json(deletedUser);
  } catch (error) {
    return next(error);
  }
};
