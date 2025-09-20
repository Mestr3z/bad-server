import { Router } from 'express';
import { auth } from '../middlewares/auth';
import {
  login,
  logout,
  register,
  refreshAccessToken,
  getCurrentUser,
  updateCurrentUser,
  getCurrentUserRoles,
} from '../controllers/auth';
import { validateAuthentication, validateUserBody } from '../middlewares/validations';

const router = Router();

router.post('/register', validateUserBody, register);
router.post('/login', validateAuthentication, login);

router.post('/token', refreshAccessToken);
router.post('/logout', logout);

router.get('/user', auth, getCurrentUser);
router.patch('/user', auth, updateCurrentUser);
router.get('/user/roles', auth, getCurrentUserRoles);

export default router;
