import { Router } from 'express'
import {
    deleteCustomer,
    getCustomerById,
    getCustomers,
    updateCustomer,
} from '../controllers/customers'
import { auth, roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'
import { validateCustomerId } from '../middlewares/validations'

const customerRouter = Router()

customerRouter.get('/', auth, roleGuardMiddleware(Role.Admin), getCustomers)
customerRouter.get(
    '/:id',
    auth,
    roleGuardMiddleware(Role.Admin),
    validateCustomerId,
    getCustomerById
)
customerRouter.patch(
    '/:id',
    auth,
    roleGuardMiddleware(Role.Admin),
    validateCustomerId,
    updateCustomer
)
customerRouter.delete(
    '/:id',
    auth,
    roleGuardMiddleware(Role.Admin),
    validateCustomerId,
    deleteCustomer
)

export default customerRouter
