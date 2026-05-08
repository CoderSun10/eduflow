/**
 * 通用按钮
 *
 * 风格变体：
 *   - primary：主操作（蓝底白字）
 *   - secondary：次操作（白底灰字 + 边框）
 *   - ghost：弱化按钮（透明底）
 *
 * size：md（默认）/ sm（紧凑场景）
 */
import styles from "./Button.module.css";

const variantClass = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
};

const Button = ({
  variant = "primary",
  size = "md",
  type = "button",
  fullWidth = false,
  loading = false,
  disabled = false,
  className = "",
  children,
  ...rest
}) => {
  const classes = [
    styles.btn,
    variantClass[variant] ?? styles.primary,
    size === "sm" ? styles.sm : size === "xs" ? styles.xs : "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classes}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{loading ? "处理中…" : children}</span>
    </button>
  );
};

export default Button;
