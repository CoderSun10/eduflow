/**
 * 工作台右栏：AI 苏格拉底式对话（流式输出）
 *
 * 现代聊天界面，全高布局，仅包含对话区域和输入框。
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { chatStream } from "../../../api/aiApi.js";
import { useSpeechRecognition } from "../../../hooks/useSpeechRecognition.js";
import MarkdownRenderer from "../../../components/common/MarkdownRenderer.jsx";
import styles from "./AIAssistantPanel.module.css";

const MicIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const AIAssistantPanel = ({ session, currentNode }) => {
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    isRecording,
    isProcessing,
    error: speechError,
    startRecording,
    stopRecording,
  } = useSpeechRecognition();

  const resizeInput = useCallback(() => {
    const element = inputRef.current;
    if (!element) return;

    const computedStyle = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom =
      Number.parseFloat(computedStyle.borderBottomWidth) || 0;
    const maxHeight =
      lineHeight * 3 + paddingTop + paddingBottom + borderTop + borderBottom;

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY =
      element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const handleVoiceClick = useCallback(async () => {
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (text) {
          setInput((prev) => (prev ? `${prev} ${text}` : text));
          inputRef.current?.focus();
        }
      } catch (err) {
        console.error("语音识别失败", err);
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        console.error("启动录音失败", err);
      }
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    resizeInput();
  }, [input, resizeInput]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !session?.id) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const body = await chatStream(session.id, {
        messages: newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        nodeId: currentNode?.id,
      });

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.content) {
              accumulated += parsed.content;
              const snap = accumulated;
              setChatMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: snap };
                return copy;
              });
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    } catch (err) {
      console.error("AI 流式回复失败", err);
      setChatMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "抱歉，AI 暂时无法回复，请稍后再试。",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, chatMessages, session, currentNode]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <aside className={styles.panel}>
      {/* ── 顶部标题栏 ── */}
      <div className={styles.chatHeader}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className={styles.chatHeaderTitle}>AI 助教</span>
        {currentNode && (
          <span className={styles.chatHeaderContext}>{currentNode.name}</span>
        )}
      </div>

      {/* ── 消息列表 ── */}
      <div className={styles.chatMessages}>
        {chatMessages.length === 0 && (
          <div className={styles.chatEmpty}>
            <div className={styles.chatEmptyIcon}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className={styles.chatEmptyTitle}>
              {currentNode ? `正在学习「${currentNode.name}」` : "AI 助教"}
            </div>
            <div className={styles.chatEmptyDesc}>
              {currentNode
                ? "有任何疑问都可以直接问我，我会尽快给出清晰答案。"
                : "选择知识节点后，可以在这里向 AI 助教提问。"}
            </div>
          </div>
        )}
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`${styles.chatBubble} ${
              msg.role === "user" ? styles.chatUser : styles.chatAI
            }`}
          >
            {msg.role === "assistant" && (
              <div className={styles.chatAvatar}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            )}
            <div className={styles.chatContent}>
              {msg.role === "assistant" ? (
                streaming &&
                idx === chatMessages.length - 1 &&
                msg.content === "" ? (
                  <div className={styles.chatText}>
                    <span className={styles.typing}>
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                    </span>
                  </div>
                ) : (
                  <MarkdownRenderer
                    content={msg.content}
                    className={styles.chatText}
                  />
                )
              ) : (
                <div className={styles.chatText}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* ── 输入区域 ── */}
      <div className={styles.chatInputWrap}>
        <textarea
          ref={inputRef}
          className={styles.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "正在录音..." : "输入问题，按 Enter 发送…"}
          rows={1}
          disabled={isRecording || isProcessing}
        />
        <button
          className={`${styles.chatVoice} ${isRecording ? styles.recording : ""} ${isProcessing ? styles.processing : ""}`}
          onClick={handleVoiceClick}
          disabled={streaming || isProcessing}
          aria-label={isRecording ? "停止录音" : "语音输入"}
          title={isRecording ? "点击停止录音" : "点击开始语音输入"}
        >
          {isProcessing ? (
            <span className={styles.voiceLoading} />
          ) : isRecording ? (
            <StopIcon />
          ) : (
            <MicIcon />
          )}
        </button>
        <button
          className={styles.chatSend}
          onClick={sendMessage}
          disabled={!input.trim() || streaming || isRecording || isProcessing}
          aria-label="发送"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      {speechError && <div className={styles.speechError}>{speechError}</div>}
    </aside>
  );
};

export default AIAssistantPanel;
