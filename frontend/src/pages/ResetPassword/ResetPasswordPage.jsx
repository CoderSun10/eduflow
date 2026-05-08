/**
 * 重置密码页面
 *
 * 用户通过邮件链接访问，输入新密码
 */
import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import TextField from "../../components/common/TextField.jsx";
import Logo from "../../components/common/Logo.jsx";
import { RoutePaths } from "../../constants/routes.js";
import { authApi } from "../../api/authApi.js";
import styles from "./ResetPasswordPage.module.css";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  // 验证状态
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // 验证令牌
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenError("无效的重置链接");
      return;
    }

    const verifyToken = async () => {
      try {
        const result = await authApi.verifyResetToken(token);
        if (result.valid) {
          setTokenValid(true);
          setUserEmail(result.email || "");
        } else {
          setTokenError(result.error || "无效的重置链接");
        }
      } catch (err) {
        setTokenError(err.message || "链接验证失败");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password || password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      // 3秒后跳转到登录页
      setTimeout(() => {
        navigate(RoutePaths.LOGIN, { 
          state: { passwordReset: true } 
        });
      }, 3000);
    } catch (err) {
      setError(err.message || "重置失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 加载中
  if (verifying) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Logo size="sm" />
          </div>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>正在验证链接...</p>
          </div>
        </div>
      </div>
    );
  }

  // 令牌无效
  if (!tokenValid) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Logo size="sm" />
          </div>
          <div className={styles.errorBox}>
            <div className={styles.errorIcon}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className={styles.errorTitle}>链接无效</h2>
            <p className={styles.errorText}>{tokenError}</p>
            <Link to={RoutePaths.FORGOT_PASSWORD} className={styles.retryLink}>
              重新申请重置密码
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 重置成功
  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Logo size="sm" />
          </div>
          <div className={styles.successBox}>
            <div className={styles.successIcon}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className={styles.successTitle}>密码重置成功</h2>
            <p className={styles.successText}>
              你的密码已成功重置。
              <br />正在跳转到登录页面...
            </p>
            <Link to={RoutePaths.LOGIN} className={styles.backLink}>
              立即登录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 重置表单
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Logo size="sm" />
        </div>

        <h1 className={styles.title}>重置密码</h1>
        {userEmail && (
          <p className={styles.subtitle}>
            为账户 <strong>{userEmail}</strong> 设置新密码
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <TextField
            label="新密码"
            type="password"
            autoComplete="new-password"
            placeholder="至少 8 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <TextField
            label="确认新密码"
            type="password"
            autoComplete="new-password"
            placeholder="再次输入新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" fullWidth loading={submitting}>
            {submitting ? "重置中..." : "重置密码"}
          </Button>
        </form>

        <div className={styles.footer}>
          <Link to={RoutePaths.LOGIN}>返回登录</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
