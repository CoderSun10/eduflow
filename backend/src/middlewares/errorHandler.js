/**
 * 全局错误处理中间件
 *
 * 所有路由错误的最终汇聚点：将 AppError 与未知错误统一格式化为 SRS §7.1 响应结构。
 * 注册顺序必须放在 app.use(routes) 之后。
 */
import { AppError } from '../utils/AppError.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { fail } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json(fail(err.code, err.message, err.details));
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const code =
      err.name === 'TokenExpiredError'
        ? ErrorCodes.TOKEN_EXPIRED
        : ErrorCodes.TOKEN_INVALID;
    return res.status(401).json(fail(code, '令牌无效或已过期'));
  }

  logger.error('未捕获错误', {
    path: req.originalUrl,
    method: req.method,
    err: err.message,
    stack: err.stack,
  });

  return res.status(500).json(
    fail(
      ErrorCodes.INTERNAL_ERROR,
      isProduction ? '服务内部错误' : err.message,
    ),
  );
};

export const notFoundHandler = (req, res) =>
  res
    .status(404)
    .json(fail(ErrorCodes.RESOURCE_NOT_FOUND, `路径 ${req.originalUrl} 不存在`));
