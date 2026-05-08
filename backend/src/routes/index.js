/**
 * API 路由总入口
 *
 * 新增模块时在此注册即可（例如未来的 reportRoutes、statsRoutes）。
 */
import { Router } from "express";
import authRoutes from "./authRoutes.js";
import sessionRoutes from "./sessionRoutes.js";
import blueprintRoutes from "./blueprintRoutes.js";
import aiRoutes from "./aiRoutes.js";
import practiceRoutes from "./practiceRoutes.js";
import learningMapRoutes from "./learningMapRoutes.js";
import speechRoutes from "./speechRoutes.js";

const router = Router();

router.get("/health", (_req, res) =>
  res.json({
    code: 0,
    message: "OK",
    data: { status: "up" },
    timestamp: Date.now(),
  }),
);

router.use("/auth", authRoutes);
router.use("/sessions", sessionRoutes);
router.use("/sessions/:sessionId/blueprint", blueprintRoutes);
router.use("/sessions", aiRoutes);
router.use("/practice", practiceRoutes);
router.use("/learning-map", learningMapRoutes);
router.use("/speech", speechRoutes);

export default router;
