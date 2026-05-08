/**
 * 语音识别 Hook
 *
 * 使用浏览器 MediaRecorder API 录音，然后发送到后端进行语音识别。
 * 支持实时录音状态反馈。
 */
import { useState, useRef, useCallback } from "react";
import * as speechApi from "../api/speechApi.js";

/**
 * 将 AudioBuffer 转换为 PCM 16bit 格式
 */
const audioBufferToPcm16 = (audioBuffer, targetSampleRate = 16000) => {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sourceSampleRate = audioBuffer.sampleRate;

  // 获取单声道数据（如果是立体声，取平均值）
  let monoData;
  if (numberOfChannels === 1) {
    monoData = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    monoData = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      monoData[i] = (left[i] + right[i]) / 2;
    }
  }

  // 重采样到目标采样率
  const resampleRatio = targetSampleRate / sourceSampleRate;
  const newLength = Math.round(monoData.length * resampleRatio);
  const resampledData = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i / resampleRatio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, monoData.length - 1);
    const fraction = srcIndex - srcIndexFloor;
    resampledData[i] =
      monoData[srcIndexFloor] * (1 - fraction) +
      monoData[srcIndexCeil] * fraction;
  }

  // 转换为 16bit PCM
  const pcm16 = new Int16Array(resampledData.length);
  for (let i = 0; i < resampledData.length; i++) {
    const sample = Math.max(-1, Math.min(1, resampledData[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return new Blob([pcm16.buffer], { type: "audio/pcm" });
};

/**
 * 将 Blob 转换为 AudioBuffer
 */
const blobToAudioBuffer = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();
  return audioBuffer;
};

export const useSpeechRecognition = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // 每 100ms 收集一次数据
      setIsRecording(true);
    } catch (err) {
      console.error("启动录音失败:", err);
      setError(err.message || "无法访问麦克风");
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        setIsRecording(false);
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          // 停止所有音轨
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          // 合并录音数据
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

          if (audioBlob.size < 1000) {
            // 录音太短
            setIsProcessing(false);
            resolve(null);
            return;
          }

          // 转换为 PCM 格式
          const audioBuffer = await blobToAudioBuffer(audioBlob);
          const pcmBlob = audioBufferToPcm16(audioBuffer, 16000);

          // 发送到后端识别
          const result = await speechApi.recognize(pcmBlob);
          setIsProcessing(false);
          resolve(result.text || "");
        } catch (err) {
          console.error("语音识别失败:", err);
          setError(err.message || "语音识别失败");
          setIsProcessing(false);
          reject(err);
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setIsRecording(false);
    setIsProcessing(false);
  }, []);

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
