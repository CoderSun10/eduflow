/**
 * 语音识别控制器
 */
import * as speechService from "../services/speechService.js";
import { logger } from "../utils/logger.js";

/**
 * 获取语音识别 Token（供前端 WebSocket 直连使用）
 */
export const getToken = async (req, res, next) => {
  try {
    const tokenInfo = await speechService.getTokenInfo();
    res.json(tokenInfo);
  } catch (error) {
    logger.error("获取语音识别 Token 失败", { error: error.message });
    next(error);
  }
};

/**
 * 一句话语音识别
 * 接收 PCM 格式音频数据，返回识别结果
 */
export const recognize = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "请上传音频文件" });
    }

    const audioData = req.file.buffer;
    const result = await speechService.recognizeSpeech(audioData);

    res.json({ text: result });
  } catch (error) {
    logger.error("语音识别失败", { error: error.message });
    next(error);
  }
};
