/**
 * 例题训练 Hooks
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as practiceApi from "../api/practiceApi.js";
import { useAuthStore } from "../store/authStore.js";

export const useSubjects = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["practice-subjects", userId],
    queryFn: practiceApi.getSubjects,
    enabled: !!userId,
  });
  return { subjects: data, isLoading, error };
};

export const useGeneratePractice = () => {
  return useMutation({
    mutationFn: (params) => practiceApi.generatePractice(params),
  });
};

export const useGenerateAtomicPractice = () => {
  return useMutation({
    mutationFn: (params) => practiceApi.generateAtomicPractice(params),
  });
};

export const useGradeAnswer = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (params) => practiceApi.gradeAnswer(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-history", userId] });
      qc.invalidateQueries({ queryKey: ["practice-stats", userId] });
      qc.invalidateQueries({ queryKey: ["practice-wrong-notes", userId] });
      qc.invalidateQueries({
        queryKey: ["practice-recent-activities", userId],
      });
    },
  });
};

export const usePracticeHistory = (mode) => {
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["practice-history", userId, mode],
    queryFn: () => practiceApi.getHistory(mode),
    enabled: !!userId,
  });
  return { history: data, isLoading, error };
};

export const useRecentPracticeActivities = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["practice-recent-activities", userId],
    queryFn: practiceApi.getRecentActivities,
    enabled: !!userId,
  });
  return { recentActivities: data, isLoading, error };
};

export const usePracticeDetail = (id) => {
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, error } = useQuery({
    queryKey: ["practice-detail", userId, id],
    queryFn: () => practiceApi.getHistoryDetail(id),
    enabled: !!userId && !!id,
  });
  return { detail: data, isLoading, error };
};

export const useWrongNotes = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["practice-wrong-notes", userId],
    queryFn: practiceApi.getWrongNotes,
    enabled: !!userId,
  });
  return { wrongNotes: data, isLoading, error };
};

export const useRetryWrongNote = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: ({ id, userAnswer }) =>
      practiceApi.retryWrongNote(id, { userAnswer }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-wrong-notes", userId] });
      qc.invalidateQueries({ queryKey: ["practice-stats", userId] });
      qc.invalidateQueries({
        queryKey: ["practice-recent-activities", userId],
      });
    },
  });
};

export const useMarkWrongNoteReviewed = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (id) => practiceApi.markWrongNoteReviewed(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-wrong-notes", userId] });
    },
  });
};

export const useDeleteWrongNote = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (id) => practiceApi.deleteWrongNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-wrong-notes", userId] });
      qc.invalidateQueries({ queryKey: ["practice-stats", userId] });
    },
  });
};

export const usePracticeStats = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, error } = useQuery({
    queryKey: ["practice-stats", userId],
    queryFn: practiceApi.getStats,
    enabled: !!userId,
  });
  return { stats: data, isLoading, error };
};
