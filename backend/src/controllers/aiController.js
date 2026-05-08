/**
 * AI 控制器
 *
 * 处理 AI 相关的 HTTP 请求：节点内容生成、对话、代码评价。
 * 蓝图生成由 sessionService.createSession 内部调用，不单独暴露。
 *
 * 所有 AI 生成的内容都会持久化到 PostgreSQL，并通过 Redis 缓存加速读取。
 */
import * as aiService from "../services/aiService.js";
import * as sessionRepo from "../models/sessionRepository.js";
import * as blueprintRepo from "../models/blueprintRepository.js";
import * as blueprintSourceRepo from "../models/blueprintSourceRepository.js";
import * as nodeContentRepo from "../models/nodeContentRepository.js";
import * as chatHistoryRepo from "../models/chatHistoryRepository.js";
import * as codeReviewRepo from "../models/codeReviewRepository.js";
import { cache } from "../config/redis.js";
import { success } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";

/**
 * POST /api/sessions/:sessionId/nodes/:nodeId/content
 * 生成某个知识节点的学习内容
 */
export const generateNodeContent = asyncHandler(async (req, res) => {
  const { sessionId, nodeId } = req.params;
  const userId = req.user.sub;

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  const node = await blueprintRepo.findNode(sessionId, nodeId);
  if (!node) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "节点不存在",
      status: 404,
    });
  }

  // 1. 先查 Redis 缓存
  const redisCached = await cache.get(`node_content:${sessionId}:${nodeId}`);
  if (redisCached) {
    const normalizedContent = redisCached?.content ?? redisCached;
    return res.json(success(normalizedContent, "内容加载成功（缓存）"));
  }

  // 2. 再查 PostgreSQL 持久化数据
  const dbCached = await nodeContentRepo.findBySessionAndNode(
    sessionId,
    nodeId,
  );
  if (dbCached) {
    // 回填 Redis 缓存
    await cache.set(
      `node_content:${sessionId}:${nodeId}`,
      dbCached.content,
      3600,
    );
    return res.json(success(dbCached.content, "内容加载成功"));
  }

  // 3. AI 生成新内容
  const content = await aiService.generateNodeContent(
    session.language,
    node.name,
    node.nodePath ?? node.name,
    session.intent,
  );

  // 4. 持久化到 PostgreSQL
  await nodeContentRepo.upsert(sessionId, nodeId, content);

  // 5. 缓存到 Redis
  await cache.set(`node_content:${sessionId}:${nodeId}`, content, 3600);

  res.json(success(content, "内容生成成功"));
});

/**
 * POST /api/sessions/:sessionId/chat
 * AI 助教对话（持久化对话记录）
 */
export const chat = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { messages, nodeId } = req.body;
  const userId = req.user.sub;

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  let context = { language: session.language };
  if (nodeId) {
    const node = await blueprintRepo.findNode(sessionId, nodeId);
    if (node) {
      context.nodeName = node.name;
      context.nodePath = node.nodePath;
    }
  }

  // 注入蓝图参考资源到上下文
  const srcData = await blueprintSourceRepo.findBySession(sessionId);
  if (srcData?.sources?.length) {
    context.sources = srcData.sources;
  }

  const reply = await aiService.chat(messages, context);

  // 持久化对话记录（包含 AI 回复）
  const fullMessages = [...messages, { role: "assistant", content: reply }];
  await chatHistoryRepo.upsert(sessionId, nodeId ?? null, fullMessages);

  res.json(success({ reply }));
});

/**
 * GET /api/sessions/:sessionId/chat/history
 * 获取对话历史（从 DB 加载）
 */
export const getChatHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { nodeId } = req.query;
  const userId = req.user.sub;

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  if (nodeId) {
    const history = await chatHistoryRepo.findBySessionAndNode(
      sessionId,
      nodeId,
    );
    return res.json(success(history));
  }

  const histories = await chatHistoryRepo.findBySession(sessionId);
  res.json(success(histories));
});

/**
 * POST /api/sessions/:sessionId/chat/stream
 * AI 助教对话（SSE 流式，完成后持久化）
 */
export const chatStream = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { messages, nodeId } = req.body;
  const userId = req.user.sub;

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  let context = { language: session.language };
  if (nodeId) {
    const node = await blueprintRepo.findNode(sessionId, nodeId);
    if (node) {
      context.nodeName = node.name;
      context.nodePath = node.nodePath;
    }
  }

  // 注入蓝图参考资源到上下文
  const srcData = await blueprintSourceRepo.findBySession(sessionId);
  if (srcData?.sources?.length) {
    context.sources = srcData.sources;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await aiService.chatStream(messages, context);

  let fullReply = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      fullReply += delta;
      res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();

  // 流结束后异步持久化对话记录
  if (fullReply) {
    const fullMessages = [
      ...messages,
      { role: "assistant", content: fullReply },
    ];
    chatHistoryRepo
      .upsert(sessionId, nodeId ?? null, fullMessages)
      .catch(() => {});
  }
});

/**
 * POST /api/sessions/:sessionId/review
 * 代码评价（持久化评价结果）
 */
export const reviewCode = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { code, exerciseTitle, nodeId } = req.body;
  const userId = req.user.sub;

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  const review = await aiService.reviewCode(
    session.language,
    code,
    exerciseTitle ?? "练习",
  );

  // 持久化代码评价结果
  await codeReviewRepo.create({
    sessionId,
    nodeId: nodeId ?? null,
    code,
    exerciseTitle: exerciseTitle ?? "",
    review,
  });

  res.json(success(review, "评价完成"));
});

/**
 * GET /api/sessions/:sessionId/reviews
 * 获取代码评价历史
 */
export const getReviewHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { nodeId } = req.query;
  const userId = req.user.sub;

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  let reviews;
  if (nodeId) {
    reviews = await codeReviewRepo.findBySessionAndNode(sessionId, nodeId);
  } else {
    reviews = await codeReviewRepo.findBySession(sessionId);
  }

  res.json(success(reviews));
});
