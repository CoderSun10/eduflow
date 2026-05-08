/**
 * 知识蓝图控制器
 *
 * HTTP 适配层：蓝图查询、节点状态推进、参考来源查询。
 */
import * as blueprintService from "../services/blueprintService.js";
import { success } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const get = asyncHandler(async (req, res) => {
  const blueprint = await blueprintService.getBlueprint(
    req.user.sub,
    req.params.sessionId,
  );
  res.json(success(blueprint));
});

export const advanceNode = asyncHandler(async (req, res) => {
  const { nodeId, status } = req.body;
  const result = await blueprintService.advanceNode(
    req.user.sub,
    req.params.sessionId,
    nodeId,
    status,
  );
  res.json(success(result, "节点状态已更新"));
});

export const getSources = asyncHandler(async (req, res) => {
  const sources = await blueprintService.getBlueprintSources(
    req.user.sub,
    req.params.sessionId,
  );
  res.json(success(sources));
});
