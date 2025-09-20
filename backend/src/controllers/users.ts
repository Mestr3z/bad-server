import { NextFunction, Request, Response } from 'express'
import User from '../models/user'

export const getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1)
        const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 10))
        const search = (req.query.search as string | undefined)?.trim()

        const filter: Record<string, any> = {}
        if (search) {
            const rx = new RegExp(
                search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i'
            )
            filter.$or = [{ name: rx }, { email: rx }]
        }

        const totalUsers = await User.countDocuments(filter)
        const users = await User.find(filter)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 })
            .select('-password -refreshToken')

        res.status(200).json({
            users,
            pagination: {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: page,
                pageSize: limit,
            },
        })
    } catch (e) {
        next(e)
    }
}
