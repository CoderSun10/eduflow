/**
 * AI 相关 API 封装
 *
 * 节点内容生成、AI 对话、代码评价。
 */
import { httpClient } from "./client.js";

/** AI 请求超时设为 120 秒 */
const AI_TIMEOUT = 120_000;

/** 生成知识节点的学习内容 */
export const generateNodeContent = (sessionId, nodeId) =>
  httpClient.post(
    `/sessions/${sessionId}/nodes/${nodeId}/content`,
    {},
    { timeout: AI_TIMEOUT },
  );

/** AI 助教对话（非流式） */
export const chat = (sessionId, { messages, nodeId }) =>
  httpClient.post(
    `/sessions/${sessionId}/chat`,
    { messages, nodeId },
    { timeout: AI_TIMEOUT },
  );

/** AI 助教对话（SSE 流式） —— 返回 EventSource 风格的 reader */
export const chatStream = async (sessionId, { messages, nodeId }) => {
  const token = localStorage.getItem("eduflow.auth.access_token");
  const res = await fetch(`/api/sessions/${sessionId}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, nodeId }),
  });
  return res.body;
};

/** 代码评价 */
export const reviewCode = (sessionId, { code, exerciseTitle, nodeId }) =>
  httpClient.post(
    `/sessions/${sessionId}/review`,
    { code, exerciseTitle, nodeId },
    { timeout: AI_TIMEOUT },
  );

/** 获取对话历史 */
export const getChatHistory = (sessionId, nodeId) =>
  httpClient.get(`/sessions/${sessionId}/chat/history`, {
    params: nodeId ? { nodeId } : {},
  });

/** 获取代码评价历史 */
export const getReviewHistory = (sessionId, nodeId) =>
  httpClient.get(`/sessions/${sessionId}/reviews`, {
    params: nodeId ? { nodeId } : {},
  });
