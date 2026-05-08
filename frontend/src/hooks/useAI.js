/**
 * AI 相关 React Hooks
 *
 * 封装 TanStack Query 的 AI 内容生成、对话、代码评价能力。
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import * as aiApi from '../api/aiApi.js';

/** 获取知识节点的学习内容（按需加载） */
export const useNodeContent = (sessionId, nodeId, options = {}) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nodeContent', sessionId, nodeId],
    queryFn: () => aiApi.generateNodeContent(sessionId, nodeId),
    enabled: !!sessionId && !!nodeId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    ...options,
  });

  return {
    content: data ?? null,
    isLoading,
    error,
    refetch,
  };
};

/** AI 助教对话 mutation */
export const useAIChat = (sessionId) => {
  return useMutation({
    mutationFn: (payload) => aiApi.chat(sessionId, payload),
  });
};

/** 代码评价 mutation */
export const useCodeReview = (sessionId) => {
  return useMutation({
    mutationFn: (payload) => aiApi.reviewCode(sessionId, payload),
  });
};
