/**
 * 受控文本输入框（含 Label / 错误提示）
 *
 * 设计稿风格：浅灰底、聚焦时变白底蓝边。
 * 业务表单只关心数据与校验，输入状态展示交给本组件。
 */
import { useId, useState } from "react";
import styles from "./TextField.module.css";

const TextField = ({
  label,
  error,
  hint,
  type = "text",
  allowPasswordToggle = false,
  className = "",
  id,
  ...rest
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const effectiveType =
    allowPasswordToggle && type === "password"
      ? visible
        ? "text"
        : "password"
      : type;

  return (
    <div className={`${styles.field} ${className}`}>
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={styles.inputWrap}>
        <input
          id={inputId}
          type={effectiveType}
          className={`${styles.input} ${allowPasswordToggle ? styles.inputWithAction : ""} ${error ? styles.inputError : ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...rest}
        />
        {allowPasswordToggle && type === "password" ? (
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? "隐藏密码" : "显示密码"}
          >
            {visible ? (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-1 2.8-3.08 5.05-5.76 6.32" />
                <path d="M6.61 6.61C4.62 8 3.12 9.82 2 12c1.73 4.89 6 8 10 8 1.61 0 3.16-.35 4.56-.98" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <div id={`${inputId}-error`} className={styles.error}>
          {error}
        </div>
      ) : hint ? (
        <div id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
};

export default TextField;
