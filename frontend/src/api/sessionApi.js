/**
 * 学习会话相关接口
 */
import { httpClient } from "./client.js";

export const sessionApi = {
  create: (payload) =>
    httpClient.post("/sessions", payload, { timeout: 120_000 }),
  list: (params) => httpClient.get("/sessions", { params }),
  get: (id) => httpClient.get(`/sessions/${id}`),
  update: (id, patch) => httpClient.patch(`/sessions/${id}`, patch),
  remove: (id) => httpClient.delete(`/sessions/${id}`),
  getGenerationProgress: (id) =>
    httpClient.get(`/sessions/${id}/generation-progress`),
};
