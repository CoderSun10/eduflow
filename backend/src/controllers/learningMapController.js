import * as learningMapService from "../services/learningMapService.js";
import { success } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const generate = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { goal } = req.body;
  const data = await learningMapService.generateLearningMap(userId, goal);
  res.json(success(data, "学习地图生成成功"));
});

export const list = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const data = await learningMapService.listLearningMaps(userId);
  res.json(success(data, "学习地图加载成功"));
});

export const getById = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { mapId } = req.params;
  const data = await learningMapService.getLearningMap(userId, mapId);
  res.json(success(data, "学习地图详情加载成功"));
});

export const remove = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { mapId } = req.params;
  await learningMapService.deleteLearningMap(userId, mapId);
  res.json(success(null, "学习地图已删除"));
});
