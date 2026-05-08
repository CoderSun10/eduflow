/**
 * 统一响应封装
 *
 * 严格遵循 SRS §7.1：所有接口返回 { code, message, data, timestamp }。
 * controller 层使用 success() 和 fail()，避免直接拼装裸对象。
 */

export const success = (data = null, message = 'OK') => ({
  code: 0,
  message,
  data,
  timestamp: Date.now(),
});

export const fail = (code, message, details = null) => ({
  code,
  message,
  data: details,
  timestamp: Date.now(),
});
