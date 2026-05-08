import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import * as learningMapController from "../controllers/learningMapController.js";
import {
  generateLearningMapSchema,
  learningMapParamsSchema,
} from "../validators/learningMapSchemas.js";

const router = Router();

router.use(authRequired);
router.get("/", learningMapController.list);
router.get(
  "/:mapId",
  validate(learningMapParamsSchema, "params"),
  learningMapController.getById,
);
router.delete(
  "/:mapId",
  validate(learningMapParamsSchema, "params"),
  learningMapController.remove,
);
router.post(
  "/",
  validate(generateLearningMapSchema),
  learningMapController.generate,
);

export default router;
