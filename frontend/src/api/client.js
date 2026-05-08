/**
 * Axios 实例（统一 HTTP 客户端）
 *
 * 职责：
 *   - 注入 baseURL（来自 vite env）
 *   - 请求拦截：附加 Authorization
 *   - 响应拦截：解包后端 { code, message, data } 结构；错误归一化
 *
 * 业务模块（api/xxxApi.js）只调用本实例，不再各自配 axios。
 */
import axios from "axios";
import { StorageKeys } from "../constants/storageKeys.js";
import { storage } from "../utils/storage.js";
import { useAuthStore } from "../store/authStore.js";

// 开发期默认走 vite 代理（见 vite.config.js → server.proxy），
// 生产构建可通过 VITE_API_BASE_URL 指向真实网关。
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const httpClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

httpClient.interceptors.request.use((config) => {
  const token = storage.getAny(StorageKeys.AUTH_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * 后端响应统一为 { code, message, data, timestamp }（见后端 SRS §7.1）。
 * - code === 0：成功，向上抛出 data
 * - code !== 0：业务错误，转成 Error 抛出，附带原始 payload
 * - HTTP 非 2xx：转成 Error，message 取后端 payload 或 axios message
 */
httpClient.interceptors.response.use(
  (response) => {
    const payload = response.data;
    if (payload && typeof payload === "object" && "code" in payload) {
      if (payload.code === 0) return payload.data;
      const err = new Error(payload.message ?? "请求失败");
      err.code = payload.code;
      err.details = payload.data;
      return Promise.reject(err);
    }
    return payload;
  },
  (error) => {
    const payload = error.response?.data;
    if (error.response?.status === 401) {
      useAuthStore.getState().clear();
      storage.set(
        StorageKeys.AUTH_LOGOUT_REASON,
        "登录状态已失效，请重新登录",
        "session",
      );
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.assign("/login");
      }
    }
    const err = new Error(payload?.message ?? error.message ?? "网络错误");
    err.code = payload?.code ?? error.response?.status ?? 0;
    err.status = error.response?.status;
    err.details = payload?.data;
    return Promise.reject(err);
  },
);
