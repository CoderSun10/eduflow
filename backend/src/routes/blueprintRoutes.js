/**
 * 知识蓝图路由
 *
 * 挂载在 /api/sessions/:sessionId/blueprint 下，所有接口需认证。
 */
import { Router } from "express";
import * as blueprintController from "../controllers/blueprintController.js";
import { validate } from "../middlewares/validate.js";
import { authRequired } from "../middlewares/auth.js";
import { advanceNodeSchema } from "../validators/blueprintSchemas.js";

const router = Router({ mergeParams: true });

router.use(authRequired);

router.get("/", blueprintController.get);
router.get("/sources", blueprintController.getSources);
router.patch(
  "/nodes",
  validate(advanceNodeSchema),
  blueprintController.advanceNode,
);

export default router;
