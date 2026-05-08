/**
 * 语音识别 API
 */
import { httpClient } from "./client.js";

/**
 * 获取语音识别 Token（供前端 WebSocket 直连使用）
 */
export const getToken = () => httpClient.get("/speech/token");

/**
 * 一句话语音识别
 * @param {Blob} audioBlob - 音频数据
 */
export const recognize = async (audioBlob) => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.pcm");

  return httpClient.post("/speech/recognize", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 30000,
  });
};
