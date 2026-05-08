import { httpClient } from "./client.js";

export const learningMapApi = {
  list: () => httpClient.get("/learning-map"),
  get: (mapId) => httpClient.get(`/learning-map/${mapId}`),
  remove: (mapId) => httpClient.delete(`/learning-map/${mapId}`),
  generate: (payload) =>
    httpClient.post("/learning-map", payload, { timeout: 120_000 }),
};
