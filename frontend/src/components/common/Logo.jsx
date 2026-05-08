/**
 * 站点 Logo（4 格组合 + 文字）
 *
 * 直接复用设计稿里的 SVG 拼图，提供 size / theme 两种变体：
 *   - theme="dark"  → 用于浅色背景（默认蓝底）
 *   - theme="light" → 用于深色背景
 */
import styles from "./Logo.module.css";

const Logo = ({ size = "md", theme = "dark", label = "EduFlow" }) => {
  const dim = size === "lg" ? 34 : size === "sm" ? 26 : 30;

  return (
    <div className={styles.logo}>
      <div
        className={`${styles.mark} ${theme === "light" ? styles.markLight : styles.markDark}`}
        style={{ width: dim, height: dim }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 3 14h8l-1 8 11-13h-8l1-7Z" fill="currentColor" />
        </svg>
      </div>
      {label ? <span className={styles.label}>{label}</span> : null}
    </div>
  );
};

export default Logo;
