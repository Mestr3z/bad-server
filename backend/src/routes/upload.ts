import { Router } from 'express'
import file from '../middlewares/file'
import { uploadHandler } from '../controllers/upload'

const router = Router()

router.post('/', file.single('file'), uploadHandler)

export default router
