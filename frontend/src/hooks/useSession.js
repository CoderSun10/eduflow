/**
 * 学习会话操作 Hook
 *
 * 封装 TanStack Query + sessionApi，提供：
 *   - sessions: 当前用户的会话列表（自动缓存 / 刷新）
 *   - createSession: 创建新会话并自动刷新列表
 *   - updateSession / deleteSession: 修改 / 删除
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionApi } from '../api/sessionApi.js';

const SESSIONS_KEY = ['sessions'];

export const useSessions = (filters = {}) => {
  const { data = [], isLoading, error } = useQuery({
    queryKey: [...SESSIONS_KEY, filters],
    queryFn: () => sessionApi.list(filters),
  });
  return { sessions: data, isLoading, error };
};

export const useSession = (sessionId) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionApi.get(sessionId),
    enabled: Boolean(sessionId),
  });
  return { session: data ?? null, isLoading, error };
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => sessionApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
};

export const useUpdateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...patch }) => sessionApi.update(id, patch),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['session', variables.id] });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => sessionApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
};
