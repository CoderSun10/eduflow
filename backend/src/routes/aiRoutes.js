/**
 * AI 相关路由
 *
 * 挂载在 /api/sessions/:sessionId 下，共享会话上下文。
 */
import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import * as aiCtrl from "../controllers/aiController.js";

const router = Router({ mergeParams: true });

router.use(authRequired);

router.post("/:sessionId/nodes/:nodeId/content", aiCtrl.generateNodeContent);
router.post("/:sessionId/chat", aiCtrl.chat);
router.get("/:sessionId/chat/history", aiCtrl.getChatHistory);
router.post("/:sessionId/chat/stream", aiCtrl.chatStream);
router.post("/:sessionId/review", aiCtrl.reviewCode);
router.get("/:sessionId/reviews", aiCtrl.getReviewHistory);

export default router;
