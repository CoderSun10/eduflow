/**
 * 例题训练路由
 */
import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import * as practiceCtrl from "../controllers/practiceController.js";

const router = Router();

router.use(authRequired);

router.get("/subjects", practiceCtrl.getSubjects);
router.post("/generate", practiceCtrl.generate);
router.post("/generate-atomic", practiceCtrl.generateAtomic);
router.post("/grade", practiceCtrl.grade);
router.get("/recent-activities", practiceCtrl.getRecentActivities);
router.get("/history", practiceCtrl.getHistory);
router.get("/history/:id", practiceCtrl.getHistoryDetail);
router.get("/wrong-notes", practiceCtrl.getWrongNotes);
router.post("/wrong-notes/:id/retry", practiceCtrl.retryWrongNote);
router.patch("/wrong-notes/:id/reviewed", practiceCtrl.markWrongNoteReviewed);
router.delete("/wrong-notes/:id", practiceCtrl.removeWrongNote);
router.get("/ai-corrections", practiceCtrl.getAiCorrections);
router.get("/stats", practiceCtrl.getStatsData);

export default router;
