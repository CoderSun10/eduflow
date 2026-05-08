/**
 * JWT 认证中间件
 *
 * 解析 Authorization: Bearer <token>，校验通过后将 payload 挂载到 req.user。
 * 路由级使用：router.get('/me', authRequired, controller.me);
 */
import { AppError } from '../utils/AppError.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { verifyToken } from '../utils/jwt.js';

const BEARER_PREFIX = 'Bearer ';

export const authRequired = (req, _res, next) => {
  const header = req.headers.authorization ?? '';

  if (!header.startsWith(BEARER_PREFIX)) {
    return next(
      new AppError({
        code: ErrorCodes.UNAUTHORIZED,
        message: '缺少认证令牌',
        status: 401,
      }),
    );
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  const payload = verifyToken(token); // 失败抛 JsonWebTokenError，由全局错误处理捕获
  req.user = payload;
  next();
};
