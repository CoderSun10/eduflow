/**
 * 异步路由处理器包装
 *
 * Express 4.x 不会自动将 async 函数中抛出的错误传给 next()，
 * 用本工具包装后，未捕获错误会自动进入全局 errorHandler。
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
