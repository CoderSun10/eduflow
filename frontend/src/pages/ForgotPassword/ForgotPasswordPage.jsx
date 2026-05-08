/**
 * 忘记密码页面
 *
 * 用户输入邮箱，发送重置密码链接
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import TextField from "../../components/common/TextField.jsx";
import Logo from "../../components/common/Logo.jsx";
import { RoutePaths } from "../../constants/routes.js";
import { authApi } from "../../api/authApi.js";
import styles from "./ForgotPasswordPage.module.css";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("请输入邮箱地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("邮箱格式不正确");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "发送失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Logo size="sm" />
        </div>

        {submitted ? (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className={styles.successTitle}>邮件已发送</h2>
            <p className={styles.successText}>
              重置密码链接已发送至：<strong>{email}</strong>
              <br />
              请检查你的收件箱（包括垃圾邮件）。
              <br />
              <br />
              链接有效期为 1 小时。
            </p>
            <Link to={RoutePaths.LOGIN} className={styles.backLink}>
              返回登录
            </Link>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>忘记密码</h1>
            <p className={styles.subtitle}>
              输入你的注册邮箱，我们将发送重置密码链接
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <TextField
                label="邮箱地址"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {error && <div className={styles.error}>{error}</div>}

              <Button type="submit" fullWidth loading={submitting}>
                {submitting ? "发送中…" : "发送重置链接"}
              </Button>
            </form>

            <div className={styles.footer}>
              <Link to={RoutePaths.LOGIN}>返回登录</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
