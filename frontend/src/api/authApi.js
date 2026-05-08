/**
 * 认证相关接口
 *
 * 仅做"路径 → httpClient 调用"的薄封装，让组件层 import 函数名而不是字符串路径。
 */
import { httpClient } from "./client.js";

export const authApi = {
  register: (payload) => httpClient.post("/auth/register", payload),
  login: (payload) => httpClient.post("/auth/login", payload),
  me: () => httpClient.get("/auth/me"),
  updateProfile: (payload) => httpClient.put("/auth/profile", payload),
  changePassword: (payload) =>
    httpClient.post("/auth/change-password", payload),
  deleteAllData: () => httpClient.delete("/auth/delete-all-data"),
  // 密码重置
  forgotPassword: (email) =>
    httpClient.post("/auth/forgot-password", { email }),
  verifyResetToken: (token) =>
    httpClient.get(`/auth/verify-reset-token?token=${token}`),
  resetPassword: (token, password) =>
    httpClient.post("/auth/reset-password", { token, password }),
};
