/**
 * 阿里云智能语音交互服务
 *
 * 提供语音转文字（ASR）功能，使用阿里云一句话识别 API。
 * 支持 WebSocket 实时流式识别。
 */
import { RPCClient } from "@alicloud/pop-core";
import { SpeechRecognition } from "alibabacloud-nls";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const NLS_URL = "wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1";

let cachedToken = null;
let tokenExpireTime = 0;

/**
 * 获取阿里云 NLS Token
 * Token 有效期约 24 小时，这里做缓存避免频繁请求
 */
export const getToken = async () => {
  const now = Date.now();

  // 如果 token 还有 5 分钟以上有效期，直接返回缓存
  if (cachedToken && tokenExpireTime - now > 5 * 60 * 1000) {
    return cachedToken;
  }

  const { accessKeyId, accessKeySecret } = env.aliyunNls;

  if (!accessKeyId || !accessKeySecret) {
    throw new Error("阿里云 AccessKey 未配置");
  }

  const client = new RPCClient({
    accessKeyId,
    accessKeySecret,
    endpoint: "http://nls-meta.cn-shanghai.aliyuncs.com",
    apiVersion: "2019-02-28",
  });

  try {
    const result = await client.request("CreateToken");
    cachedToken = result.Token.Id;
    // ExpireTime 是秒级时间戳
    tokenExpireTime = result.Token.ExpireTime * 1000;
    logger.info("阿里云 NLS Token 获取成功", {
      expireTime: new Date(tokenExpireTime).toISOString(),
    });
    return cachedToken;
  } catch (error) {
    logger.error("获取阿里云 NLS Token 失败", { error: error.message });
    throw new Error("获取语音识别 Token 失败");
  }
};

/**
 * 一句话语音识别
 *
 * @param {Buffer} audioData - PCM 格式音频数据（16kHz, 16bit, 单声道）
 * @returns {Promise<string>} 识别结果文本
 */
export const recognizeSpeech = async (audioData) => {
  const token = await getToken();
  const { appKey } = env.aliyunNls;

  if (!appKey) {
    throw new Error("阿里云 NLS AppKey 未配置");
  }

  return new Promise((resolve, reject) => {
    let finalResult = "";
    let settled = false;

    const sr = new SpeechRecognition({
      url: NLS_URL,
      appkey: appKey,
      token,
    });

    sr.on("started", (msg) => {
      logger.debug("语音识别开始", { msg });
    });

    sr.on("changed", (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.payload?.result) {
          finalResult = data.payload.result;
        }
      } catch {
        // ignore
      }
    });

    sr.on("completed", (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.payload?.result) {
          finalResult = data.payload.result;
        }
      } catch {
        // ignore
      }
      logger.info("语音识别完成", { result: finalResult });
      settled = true;
      resolve(finalResult);
    });

    sr.on("failed", (msg) => {
      logger.error("语音识别失败", { msg });
      settled = true;
      reject(new Error(`语音识别失败: ${msg}`));
    });

    sr.on("closed", () => {
      logger.debug("语音识别连接关闭");
      if (!settled) {
        settled = true;
        resolve(finalResult);
      }
    });

    // 启动识别
    const params = sr.defaultStartParams();
    params.format = "pcm";
    params.sample_rate = 16000;

    sr.start(params, true, 6000)
      .then(() => {
        const chunkSize = 3200;

        for (let offset = 0; offset < audioData.length; offset += chunkSize) {
          const chunk = audioData.slice(offset, offset + chunkSize);
          if (!sr.sendAudio(chunk)) {
            settled = true;
            reject(new Error("发送音频数据失败"));
            return;
          }
        }

        sr.close().catch((err) => {
          logger.error("关闭语音识别连接失败", { error: err.message });
          if (!settled) {
            settled = true;
            reject(new Error("关闭语音识别连接失败"));
          }
        });
      })
      .catch((error) => {
        logger.error("启动语音识别失败", { error: error.message });
        settled = true;
        reject(new Error("启动语音识别失败"));
      });
  });
};

/**
 * 获取 Token 信息（供前端 WebSocket 直连使用）
 */
export const getTokenInfo = async () => {
  const token = await getToken();
  const { appKey } = env.aliyunNls;

  return {
    token,
    appKey,
    url: NLS_URL,
  };
};
