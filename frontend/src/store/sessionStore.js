/**
 * 学习会话全局状态（Zustand）
 *
 * 缓存当前用户的会话列表，供 HomePage 等多处消费。
 * 实际数据获取通过 useSession hook 结合 TanStack Query 完成。
 */
import { create } from 'zustand';

export const useSessionStore = create((set) => ({
  /** 当前打开的会话 ID（用于 Workbench 页） */
  activeSessionId: null,

  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
