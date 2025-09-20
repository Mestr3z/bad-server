import { Router } from 'express'
import authRouter from './auth'
import productRouter from './product'
import userRouter from './users'
import orderRouter from './order'
import uploadRouter from './upload'
import customerRouter from './customers'

const router = Router()

router.use('/auth', authRouter)
router.use('/products', productRouter)
router.use('/users', userRouter)
router.use('/orders', orderRouter)
router.use('/upload', uploadRouter)
router.use('/customers', customerRouter)

export default router
