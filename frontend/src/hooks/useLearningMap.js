import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { learningMapApi } from "../api/learningMapApi.js";

const LEARNING_MAPS_KEY = ["learning-maps"];

export const useLearningMaps = () => {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: LEARNING_MAPS_KEY,
    queryFn: learningMapApi.list,
  });

  return { learningMaps: data, isLoading, error };
};

export const useLearningMap = (mapId) => {
  const { data, isLoading, error } = useQuery({
    queryKey: [...LEARNING_MAPS_KEY, mapId],
    queryFn: () => learningMapApi.get(mapId),
    enabled: Boolean(mapId),
  });

  return { learningMap: data ?? null, isLoading, error };
};

export const useGenerateLearningMap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => learningMapApi.generate(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: LEARNING_MAPS_KEY });
      if (data?.id) {
        queryClient.setQueryData([...LEARNING_MAPS_KEY, data.id], data);
      }
    },
  });
};

export const useDeleteLearningMap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mapId) => learningMapApi.remove(mapId),
    onSuccess: (_data, mapId) => {
      queryClient.invalidateQueries({ queryKey: LEARNING_MAPS_KEY });
      if (mapId) {
        queryClient.removeQueries({ queryKey: [...LEARNING_MAPS_KEY, mapId] });
      }
    },
  });
};
