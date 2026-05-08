/**
 * 知识蓝图请求体 schema
 */
import { z } from "zod";

export const advanceNodeSchema = z.object({
  nodeId: z.string().min(1, "节点 ID 不能为空"),
  status: z.enum(["done", "active", "pending"], {
    errorMap: () => ({ message: "状态值不合法" }),
  }),
});
