import { Router } from 'express';
import file from '../middlewares/file';
import { uploadFile } from '../controllers/upload';

const router = Router();

router.post('/', file.single('file'), uploadFile);

export default router;
