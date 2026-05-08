/**
 * 通用格式化工具
 *
 * 纯函数，不依赖 React / 浏览器 API；可在任意层使用。
 */

/** 截取用户名首字 / 字母作为头像文本 */
export const initialsOf = (name = "") => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // 中文：取首字 + 第二字（如有）
  if (/[一-龥]/.test(trimmed[0])) {
    return trimmed.slice(0, 2);
  }
  // 英文：取每个单词首字母，最多 2 个
  return trimmed
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

/** 根据当前小时返回中文问候语 */
export const greetingOf = (date = new Date()) => {
  const h = date.getHours();
  if (h < 6) return "凌晨好";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "晚上好";
  return "夜深了";
};

/** 把分钟数转成"X 小时 Y 分"或"Z 分钟" */
export const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 1) return "0 分钟";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
};

/** 把 ISO 时间字符串转成"X 分钟前"/"X 小时前"/"X 天前" */
export const formatRelativeTime = (isoString) => {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(isoString).toLocaleDateString("zh-CN");
};

export const formatDateTime = (isoString) => {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("zh-CN", { hour12: false });
};

export const formatDateRange = (startAt, endAt = null) => {
  if (!startAt) return "";
  const startText = new Date(startAt).toLocaleDateString("zh-CN");
  const endText = endAt ? new Date(endAt).toLocaleDateString("zh-CN") : "至今";
  return `${startText} - ${endText}`;
};

export const formatElapsedSpan = (startAt, endAt = null) => {
  if (!startAt) return "";
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月`;
  const years = Math.floor(days / 365);
  return `${years} 年`;
};
