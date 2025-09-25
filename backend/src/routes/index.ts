import { Router } from 'express'
import authRouter from './auth'
import productRouter from './product'
import userRouter from './users'
import uploadRouter from './upload'
import customerRouter from './customers'
import orderRouter from './order'

const router = Router()

router.use('/auth', authRouter)
router.use('/products', productRouter)
router.use('/users', userRouter)
router.use('/upload', uploadRouter)
router.use('/customers', customerRouter)
router.use('/orders', orderRouter)

export default router
