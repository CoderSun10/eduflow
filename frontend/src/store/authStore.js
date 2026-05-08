/**
 * 认证全局状态（Zustand）
 *
 * 与 localStorage 双写：刷新页面后从 storage 还原，登出时清除。
 * 业务组件通过 useAuthStore 读取，避免到处直接读 storage。
 */
import { create } from "zustand";
import { storage } from "../utils/storage.js";
import { StorageKeys } from "../constants/storageKeys.js";

const clearStoredSession = () => {
  storage.removeFromAll(StorageKeys.AUTH_USER);
  storage.removeFromAll(StorageKeys.AUTH_TOKEN);
  storage.removeFromAll(StorageKeys.AUTH_REFRESH);
  storage.removeFromAll(StorageKeys.AUTH_REMEMBER);
  storage.removeFromAll(StorageKeys.AUTH_LAST_ACTIVE_AT);
  storage.removeFromAll(StorageKeys.AUTH_IDLE_TIMEOUT_MS);
};

const readInitialState = () => ({
  user: storage.getAny(StorageKeys.AUTH_USER),
  accessToken: storage.getAny(StorageKeys.AUTH_TOKEN),
  refreshToken: storage.getAny(StorageKeys.AUTH_REFRESH),
  rememberSession: Boolean(storage.getAny(StorageKeys.AUTH_REMEMBER)),
});

export const useAuthStore = create((set) => ({
  ...readInitialState(),

  setSession: ({
    user,
    accessToken,
    refreshToken,
    rememberSession = false,
  }) => {
    const scope = rememberSession ? "local" : "session";
    clearStoredSession();
    storage.set(StorageKeys.AUTH_USER, user, scope);
    storage.set(StorageKeys.AUTH_TOKEN, accessToken, scope);
    storage.set(StorageKeys.AUTH_REFRESH, refreshToken, scope);
    storage.set(StorageKeys.AUTH_REMEMBER, rememberSession, scope);
    set({ user, accessToken, refreshToken, rememberSession });
  },

  updateUser: (user) => {
    const rememberSession = Boolean(storage.getAny(StorageKeys.AUTH_REMEMBER));
    storage.set(
      StorageKeys.AUTH_USER,
      user,
      rememberSession ? "local" : "session",
    );
    set({ user });
  },

  clear: () => {
    clearStoredSession();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      rememberSession: false,
    });
  },
}));

/** 派生选择器：是否登录 */
export const selectIsAuthenticated = (state) => Boolean(state.accessToken);
