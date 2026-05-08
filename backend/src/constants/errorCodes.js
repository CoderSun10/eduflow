/**
 * 业务错误码集中定义
 *
 * 命名约定：
 *   - 4xxxx 客户端错误
 *   - 5xxxx 服务端错误
 *   - 第二位语义分组：1=认证 2=用户 3=学习会话 4=AI 9=通用
 */
export const ErrorCodes = Object.freeze({
  // 通用
  VALIDATION_FAILED: 40901,
  RESOURCE_NOT_FOUND: 40902,
  RATE_LIMITED: 40903,
  INTERNAL_ERROR: 50901,

  // 认证 / 授权
  UNAUTHORIZED: 40101,
  TOKEN_INVALID: 40102,
  TOKEN_EXPIRED: 40103,
  CREDENTIALS_INVALID: 40104,

  // 用户
  USER_ALREADY_EXISTS: 40201,
  USER_NOT_FOUND: 40202,

  // 学习会话
  SESSION_NOT_FOUND: 40301,

  // 蓝图
  BLUEPRINT_NOT_FOUND: 40401,
  NODE_NOT_FOUND: 40402,
});
