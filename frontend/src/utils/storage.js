/**
 * localStorage 安全封装
 *
 * 解决三个问题：
 *   1. SSR / 隐私模式下 window.localStorage 不可用
 *   2. JSON.parse 异常会污染调用方
 *   3. 不存在的 key 应返回 null 而不是字符串 "null"
 */
const isAvailable = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

const getStorage = (scope = "local") => {
  if (!isAvailable()) return null;
  return scope === "session" ? window.sessionStorage : window.localStorage;
};

export const storage = {
  get(key, scope = "local") {
    const store = getStorage(scope);
    if (!store) return null;
    const raw = store.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  getAny(key) {
    return storage.get(key, "local") ?? storage.get(key, "session");
  },

  set(key, value, scope = "local") {
    const store = getStorage(scope);
    if (!store) return;
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    store.setItem(key, serialized);
  },

  remove(key, scope = "local") {
    const store = getStorage(scope);
    if (!store) return;
    store.removeItem(key);
  },

  removeFromAll(key) {
    storage.remove(key, "local");
    storage.remove(key, "session");
  },
};
