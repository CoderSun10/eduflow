/**
 * 知识蓝图相关接口
 */
import { httpClient } from "./client.js";

export const blueprintApi = {
  get: (sessionId) => httpClient.get(`/sessions/${sessionId}/blueprint`),
  getSources: (sessionId) =>
    httpClient.get(`/sessions/${sessionId}/blueprint/sources`),
  advanceNode: (sessionId, payload) =>
    httpClient.patch(`/sessions/${sessionId}/blueprint/nodes`, payload),
};
