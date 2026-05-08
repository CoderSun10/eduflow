/**
 * 注册页面
 *
 * 与登录页共享双栏布局风格，右栏为注册表单（用户名 + 邮箱 + 密码 + 确认密码）。
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import TextField from "../../components/common/TextField.jsx";
import Logo from "../../components/common/Logo.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { RoutePaths } from "../../constants/routes.js";
import styles from "./RegisterPage.module.css";

const initialForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errors = {};
    if (!form.username.trim()) errors.username = "请输入用户名";
    if (!form.email.trim()) errors.email = "请输入邮箱";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = "邮箱格式不正确";
    if (!form.password) errors.password = "请输入密码";
    else if (form.password.length < 8) errors.password = "密码至少 8 位";
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = "两次密码不一致";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // 注册成功后跳转到登录页，带上成功提示
      navigate(RoutePaths.LOGIN, {
        replace: true,
        state: { registered: true, email: form.email.trim() },
      });
    } catch (err) {
      setServerError(err.message || "注册失败");
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
              开启你的
              <br />
              AI 编程
              <br />
              学习之旅
            </h1>
            <p className={styles.sub}>
              注册账户后，即可获得个性化知识蓝图和 AI 导师服务，让学习效率提升 3
              倍。
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
          <h2 className={styles.formTitle}>创建账户</h2>
          <p className={styles.formSub}>注册后即可开始你的个性化学习之旅</p>

          <form onSubmit={handleSubmit} noValidate>
            <TextField
              label="用户名"
              type="text"
              autoComplete="username"
              placeholder="你的用户名"
              value={form.username}
              onChange={update("username")}
              error={fieldErrors.username}
            />
            <div style={{ height: 14 }} />
            <TextField
              label="邮箱地址"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update("email")}
              error={fieldErrors.email}
            />
            <div style={{ height: 14 }} />
            <TextField
              label="密码"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位"
              value={form.password}
              onChange={update("password")}
              error={fieldErrors.password}
            />
            <div style={{ height: 14 }} />
            <TextField
              label="确认密码"
              type="password"
              autoComplete="new-password"
              placeholder="再输一次密码"
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
              error={fieldErrors.confirmPassword}
            />

            <div style={{ height: 20 }} />

            {serverError ? (
              <div className={styles.error}>{serverError}</div>
            ) : null}

            <Button type="submit" fullWidth loading={submitting}>
              注册
            </Button>
          </form>

          <div className={styles.switch}>
            已有账户？<Link to={RoutePaths.LOGIN}>立即登录</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RegisterPage;
