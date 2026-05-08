import { z } from "zod";

export const generateLearningMapSchema = z.object({
  goal: z
    .string()
    .min(1, "学习目标不能为空")
    .max(500, "学习目标不能超过 500 个字符"),
});

export const learningMapParamsSchema = z.object({
  mapId: z.string().uuid("学习地图 ID 不合法"),
});
