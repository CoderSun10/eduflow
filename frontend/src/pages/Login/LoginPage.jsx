/**
 * 登录页面
 *
 * 双栏布局严格对齐 description/page1_login_light.html：
 *   - 左栏品牌 / Hero / 数据徽标
 *   - 右栏登录表单
 *
 * 表单仅做最基本的"非空 + 邮箱"前端校验，业务错误由后端返回再展示。
 */
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import TextField from "../../components/common/TextField.jsx";
import Logo from "../../components/common/Logo.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { RoutePaths } from "../../constants/routes.js";
import { StorageKeys } from "../../constants/storageKeys.js";
import { storage } from "../../utils/storage.js";
import styles from "./LoginPage.module.css";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // 检查是否从注册页跳转过来
  const registeredEmail = location.state?.email || "";
  const justRegistered = location.state?.registered || false;
  const rememberedCredentials =
    storage.get(StorageKeys.LOGIN_CREDENTIALS) || null;

  const [form, setForm] = useState(() => ({
    email: registeredEmail || rememberedCredentials?.email || "",
    password: rememberedCredentials?.password || "",
    rememberPassword: Boolean(rememberedCredentials),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(
    justRegistered ? "注册成功！请使用新账户登录" : "",
  );

  useEffect(() => {
    const logoutReason = storage.get(StorageKeys.AUTH_LOGOUT_REASON, "session");
    if (!logoutReason) return;
    setSuccessMsg(logoutReason);
    storage.remove(StorageKeys.AUTH_LOGOUT_REASON, "session");
  }, []);

  const update = (field) => (e) =>
    setForm((prev) => ({
      ...prev,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setServerError("请输入邮箱和密码");
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await login(
        { email: form.email, password: form.password },
        { rememberSession: form.rememberPassword },
      );
      if (form.rememberPassword) {
        storage.set(StorageKeys.LOGIN_CREDENTIALS, {
          email: form.email,
          password: form.password,
        });
      } else {
        storage.removeFromAll(StorageKeys.LOGIN_CREDENTIALS);
      }
      const redirect = location.state?.from?.pathname ?? RoutePaths.HOME;
      navigate(redirect, { replace: true });
    } catch (err) {
      setServerError(err.message || "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <section className={styles.left}>
          <div className={styles.bgCircles} aria-hidden="true">
            <span style={{ width: 320, height: 320, top: -80, right: -80 }} />
            <span style={{ width: 200, height: 200, bottom: 40, left: -60 }} />
            <span
              style={{
                width: 120,
                height: 120,
                bottom: 200,
                right: 30,
                opacity: 0.04,
              }}
            />
          </div>

          <Logo theme="light" label="EduFlow AI" />

          <div className={styles.hero}>
            <div className={styles.tag}>智慧学习平台 · v1.0</div>
            <h1 className={styles.h1}>
              用 AI 重构
              <br />
              你的编程
              <br />
              学习方式
            </h1>
            <p className={styles.sub}>
              基于权威文档，AI 提炼核心知识，用精炼语言助你快速掌握每个要点。
            </p>
          </div>

          <ul className={styles.stats}>
            <li>
              <div className={styles.statNum}>12+</div>
              <div className={styles.statLabel}>语言支持</div>
            </li>
            <li>
              <div className={styles.statNum}>RAG</div>
              <div className={styles.statLabel}>文档驱动</div>
            </li>
            <li>
              <div className={styles.statNum}>4D</div>
              <div className={styles.statLabel}>代码评价</div>
            </li>
          </ul>
        </section>

        <section className={styles.right}>
          <h2 className={styles.formTitle}>欢迎回来</h2>
          <p className={styles.formSub}>登录你的学习账户，继续上次的进度</p>

          <form onSubmit={handleSubmit} noValidate>
            <TextField
              label="邮箱地址"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update("email")}
            />
            <div style={{ height: 18 }} />
            <TextField
              label="密码"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={update("password")}
              allowPasswordToggle
            />

            <div className={styles.forgotRow}>
              <label className={styles.rememberLabel}>
                <input
                  type="checkbox"
                  checked={form.rememberPassword}
                  onChange={update("rememberPassword")}
                />
                <span>记住密码</span>
              </label>
              <Link className={styles.forgot} to={RoutePaths.FORGOT_PASSWORD}>
                忘记密码？
              </Link>
            </div>

            {successMsg && <div className={styles.success}>{successMsg}</div>}

            {serverError ? (
              <div className={styles.error}>{serverError}</div>
            ) : null}

            <Button type="submit" fullWidth loading={submitting}>
              登录
            </Button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>或通过</span>
            <span className={styles.dividerLine} />
          </div>

          <button
            type="button"
            className={styles.github}
            onClick={() => alert("GitHub 登录功能暂未开放，敬请期待")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            使用 GitHub 登录
          </button>

          <div className={styles.switch}>
            还没有账户？<Link to={RoutePaths.REGISTER}>立即注册</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
