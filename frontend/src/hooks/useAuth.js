/**
 * 认证操作 Hook
 *
 * 在 store + api 之上加一层"业务化"接口，
 * 组件只需 useAuth().login(...) 而不必关心 api 调用与 store 写入的串联。
 */
import { useCallback } from "react";
import { useAuthStore } from "../store/authStore.js";
import { authApi } from "../api/authApi.js";

export const useAuth = () => {
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));

  const login = useCallback(
    async (credentials, options = {}) => {
      const result = await authApi.login(credentials);
      setSession({
        ...result,
        rememberSession: Boolean(options.rememberSession),
      });
      return result.user;
    },
    [setSession],
  );

  const register = useCallback(
    async (payload, options = {}) => {
      const result = await authApi.register(payload);
      setSession({
        ...result,
        rememberSession: Boolean(options.rememberSession),
      });
      return result.user;
    },
    [setSession],
  );

  const logout = useCallback(() => {
    clear();
  }, [clear]);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authApi.me();
      useAuthStore.getState().updateUser(profile);
    } catch {
      /* ignore */
    }
  }, []);

  return { user, isAuthenticated, login, register, logout, refreshUser };
};
