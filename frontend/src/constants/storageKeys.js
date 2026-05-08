/**
 * 浏览器持久化（localStorage / sessionStorage）键名集中管理
 */
export const StorageKeys = Object.freeze({
  AUTH_TOKEN: "eduflow.auth.access_token",
  AUTH_REFRESH: "eduflow.auth.refresh_token",
  AUTH_USER: "eduflow.auth.user",
  AUTH_REMEMBER: "eduflow.auth.remember",
  AUTH_LAST_ACTIVE_AT: "eduflow.auth.last_active_at",
  AUTH_IDLE_TIMEOUT_MS: "eduflow.auth.idle_timeout_ms",
  AUTH_LOGOUT_REASON: "eduflow.auth.logout_reason",
  LOGIN_CREDENTIALS: "eduflow.login.credentials",
});
