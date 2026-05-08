/**
 * 认证路由
 *
 * 仅做"路径 → 中间件 → controller"的编排，不放业务逻辑。
 */
import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { validate } from "../middlewares/validate.js";
import { authRequired } from "../middlewares/auth.js";
import { registerSchema, loginSchema } from "../validators/authSchemas.js";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", authRequired, authController.me);
router.put("/profile", authRequired, authController.updateProfile);
router.post("/change-password", authRequired, authController.changePassword);
router.delete(
  "/delete-all-data",
  authRequired,
  authController.deleteAllUserData,
);

// 密码重置（无需登录）
router.post("/forgot-password", authController.requestPasswordReset);
router.get("/verify-reset-token", authController.verifyResetToken);
router.post("/reset-password", authController.resetPassword);

export default router;
