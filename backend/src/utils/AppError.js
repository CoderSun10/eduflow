/**
 * 业务异常基类
 *
 * 所有 controller / service 抛出的"可预期错误"都应使用 AppError，
 * 由全局 errorHandler 中间件统一格式化为 JSON 响应。
 *
 * 用法：
 *   throw new AppError({ code: ErrorCodes.USER_NOT_FOUND, message: '用户不存在', status: 404 });
 */
export class AppError extends Error {
  constructor({ code, message, status = 400, details = null }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}
