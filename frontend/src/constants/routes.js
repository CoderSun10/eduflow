/**
 * 路由路径常量
 *
 * 所有跳转必须引用本对象，避免在代码里散落硬编码字符串。
 * 改路径时只改这里，IDE 可自动跟踪所有引用。
 */
export const RoutePaths = Object.freeze({
  ROOT: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  HOME: "/home",
  STATS: "/stats",
  PRACTICE: "/practice",
  PRACTICE_WRONG_NOTES: "/practice/wrong-notes",
  LEARNING_MAP: "/learning-map",
  LEARNING_MAP_DETAIL: "/learning-map/:mapId",
  PRACTICE_HISTORY_DETAIL: "/practice/history/:historyId",
  SETTINGS: "/settings",
  PROFILE: "/profile",
  WORKBENCH: "/workbench/:sessionId",
  NOT_FOUND: "/404",
  // 保留旧路径做兼容重定向
  SESSIONS: "/sessions",
  HISTORY: "/history",
  REPORTS: "/reports",
  // 工厂函数：拼接动态参数
  learningMapOf: (mapId) => `/learning-map/${mapId}`,
  practiceHistoryOf: (historyId) => `/practice/history/${historyId}`,
  workbenchOf: (sessionId) => `/workbench/${sessionId}`,
});
