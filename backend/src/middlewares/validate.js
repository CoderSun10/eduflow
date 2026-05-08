/**
 * 基于 zod 的请求体校验中间件
 *
 * 用法：
 *   router.post('/login', validate(loginSchema), controller.login);
 *
 * schema 定义统一放在 src/validators/ 下，以便复用与单测。
 */
import { AppError } from '../utils/AppError.js';
import { ErrorCodes } from '../constants/errorCodes.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new AppError({
          code: ErrorCodes.VALIDATION_FAILED,
          message: '请求参数不合法',
          status: 400,
          details: result.error.flatten(),
        }),
      );
    }
    req[source] = result.data;
    next();
  };
