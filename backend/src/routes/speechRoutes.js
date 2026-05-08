/**
 * 语音识别路由
 */
import { Router } from "express";
import multer from "multer";
import * as speechController from "../controllers/speechController.js";
import { authRequired } from "../middlewares/auth.js";

const router = Router();

// 配置 multer 用于处理音频文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 最大 10MB
  },
});

// 获取语音识别 Token（供前端 WebSocket 直连使用）
router.get("/token", authRequired, speechController.getToken);

// 一句话语音识别
router.post(
  "/recognize",
  authRequired,
  upload.single("audio"),
  speechController.recognize,
);

export default router;
