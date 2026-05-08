/**
 * 学习会话路由
 *
 * 所有接口均需认证（authRequired）。
 */
import { Router } from 'express';
import * as sessionController from '../controllers/sessionController.js';
import { validate } from '../middlewares/validate.js';
import { authRequired } from '../middlewares/auth.js';
import { createSessionSchema, updateSessionSchema } from '../validators/sessionSchemas.js';

const router = Router();

router.use(authRequired);

router.post('/', validate(createSessionSchema), sessionController.create);
router.get('/', sessionController.list);
router.get('/:id', sessionController.get);
router.get('/:id/generation-progress', sessionController.getProgress);
router.patch('/:id', validate(updateSessionSchema), sessionController.update);
router.delete('/:id', sessionController.remove);

export default router;
