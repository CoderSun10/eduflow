/**
 * 极简结构化日志器
 *
 * 当前为占位实现，输出 JSON 行到 stdout，符合 SRS §4.4 的"结构化日志"要求。
 * 后续接入 pino / winston 时只需替换内部实现，业务代码不必修改。
 */
import { isProduction } from '../config/env.js';

const write = (level, message, meta) => {
  const payload = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(meta && { meta }),
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else if (!isProduction || level !== 'debug') {
    console.log(line);
  }
};

export const logger = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
