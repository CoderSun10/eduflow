/**
 * 例题训练 API 封装
 */
import { httpClient } from "./client.js";

const AI_TIMEOUT = 120_000;

/** 获取用户所有科目和知识点 */
export const getSubjects = () => httpClient.get("/practice/subjects");

/** AI 生成练习题 */
export const generatePractice = (params) =>
  httpClient.post("/practice/generate", params, { timeout: AI_TIMEOUT });

/** AI 针对单个原子知识点生成专项练习（优先命中预生成缓存） */
export const generateAtomicPractice = (params) =>
  httpClient.post("/practice/generate-atomic", params, { timeout: AI_TIMEOUT });

/** AI 批改单题答案 */
export const gradeAnswer = (params) =>
  httpClient.post("/practice/grade", params, { timeout: AI_TIMEOUT });

/** 获取练习历史列表 */
export const getHistory = (mode) =>
  httpClient.get("/practice/history", { params: mode ? { mode } : {} });

export const getRecentActivities = () =>
  httpClient.get("/practice/recent-activities");

/** 获取单次练习详情 */
export const getHistoryDetail = (id) =>
  httpClient.get(`/practice/history/${id}`);

/** 获取错题本 */
export const getWrongNotes = () => httpClient.get("/practice/wrong-notes");

/** 错题重做并再次 AI 评估 */
export const retryWrongNote = (id, params) =>
  httpClient.post(`/practice/wrong-notes/${id}/retry`, params, {
    timeout: AI_TIMEOUT,
  });

/** 标记错题已复习 */
export const markWrongNoteReviewed = (id) =>
  httpClient.patch(`/practice/wrong-notes/${id}/reviewed`);

/** 删除错题 */
export const deleteWrongNote = (id) =>
  httpClient.delete(`/practice/wrong-notes/${id}`);

/** 获取 AI 纠错日志 */
export const getAiCorrections = (scope) =>
  httpClient.get("/practice/ai-corrections", {
    params: scope ? { scope } : {},
  });

/** 获取练习统计 */
export const getStats = () => httpClient.get("/practice/stats");
