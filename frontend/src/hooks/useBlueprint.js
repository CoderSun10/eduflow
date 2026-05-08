/**
 * 知识蓝图操作 Hook
 *
 * 封装 TanStack Query + blueprintApi，提供：
 *   - blueprint: 当前会话的蓝图数据
 *   - advanceNode: 推进某个知识节点状态
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blueprintApi } from "../api/blueprintApi.js";

export const useBlueprint = (sessionId, options = {}) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["blueprint", sessionId],
    queryFn: () => blueprintApi.get(sessionId),
    enabled: Boolean(sessionId),
    ...options,
  });
  return { blueprint: data ?? null, isLoading, error, refetch };
};

export const useAdvanceNode = (sessionId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => blueprintApi.advanceNode(sessionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprint", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
};
