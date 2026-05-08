/**
 * 设置页
 *
 * 两个分区：个人资料（含修改密码弹窗 + 退出登录）、外观设置、关于。
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import Logo from "../../components/common/Logo.jsx";
import TextField from "../../components/common/TextField.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { authApi } from "../../api/authApi.js";
import {
  loadStoredPreferences,
  saveStoredPreferences,
  useTheme,
} from "../../hooks/useTheme.jsx";
import { RoutePaths } from "../../constants/routes.js";
import styles from "./SettingsPage.module.css";

const ProfileIcon = (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="5.5" r="3" />
    <path d="M2.5 14c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" />
  </svg>
);

const AppearanceIcon = (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" />
  </svg>
);

const AboutIcon = (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6.5" />
    <line x1="8" y1="10.5" x2="8" y2="8" />
    <line x1="8" y1="5.5" x2="8.01" y2="5.5" />
  </svg>
);

const TABS = [
  { key: "profile", label: "个人资料", icon: ProfileIcon },
  { key: "appearance", label: "外观", icon: AppearanceIcon },
  { key: "about", label: "关于", icon: AboutIcon },
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");

  const handleLogout = () => {
    logout();
    navigate(RoutePaths.LOGIN, { replace: true });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>设置</h1>
        <p className={styles.subtitle}>管理你的个人资料与系统偏好</p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.navItem} ${activeTab === tab.key ? styles.navActive : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className={styles.navIcon}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {activeTab === "profile" && (
            <ProfileTab
              user={user}
              onLogout={handleLogout}
              refreshUser={refreshUser}
            />
          )}
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
};

/* ── 个人资料 ── */
const ProfileTab = ({ user, onLogout, refreshUser }) => {
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // 修改密码弹窗状态
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // 删除所有数据弹窗状态
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveProfile = async () => {
    if (!username.trim() || username.trim().length < 2) {
      setSaveMsg("用户名至少 2 个字符");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      await authApi.updateProfile({ username: username.trim() });
      setSaveMsg("资料已更新");
      setEditMode(false);
      if (refreshUser) refreshUser();
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err) {
      setSaveMsg(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePwd = async () => {
    setPwdMsg("");
    if (!curPwd || !newPwd) {
      setPwdMsg("请填写当前密码和新密码");
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg("新密码至少 8 位");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("两次输入的新密码不一致");
      return;
    }
    setPwdSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: curPwd,
        newPassword: newPwd,
      });
      setPwdMsg("密码修改成功");
      setCurPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => {
        setShowPwdModal(false);
        setPwdMsg("");
      }, 1500);
    } catch (err) {
      setPwdMsg(err.message || "修改失败");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAllData();
      setShowDeleteModal(false);
      alert("所有数据已删除，页面将刷新");
      window.location.reload();
    } catch (err) {
      alert(err.message || "删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h2 className={styles.secTitle}>个人资料</h2>
      <p className={styles.secDesc}>查看和管理你的账户信息</p>

      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          <span className={styles.avatarText}>
            {user?.username?.charAt(0)?.toUpperCase() ?? "U"}
          </span>
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>{user?.username ?? "用户"}</div>
          <div className={styles.profileEmail}>
            {user?.email ?? "未设置邮箱"}
          </div>
        </div>
      </div>

      <div className={styles.settingsGroup}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>用户名</span>
            <span className={styles.settingDesc}>你的显示名称</span>
          </div>
          {editMode ? (
            <input
              className={styles.inlineInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          ) : (
            <span className={styles.settingValue}>{user?.username ?? "-"}</span>
          )}
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>邮箱</span>
            <span className={styles.settingDesc}>
              注册时使用的邮箱（不可修改）
            </span>
          </div>
          <span className={styles.settingValue}>{user?.email ?? "-"}</span>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>密码</span>
            <span className={styles.settingDesc}>修改你的登录密码</span>
          </div>
          <button
            type="button"
            className={styles.inlineBtn}
            onClick={() => {
              setShowPwdModal(true);
              setPwdMsg("");
              setCurPwd("");
              setNewPwd("");
              setConfirmPwd("");
            }}
          >
            修改密码
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        {editMode ? (
          <>
            <Button size="sm" onClick={handleSaveProfile} loading={saving}>
              {saving ? "保存中…" : "保存修改"}
            </Button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setEditMode(false);
                setUsername(user?.username ?? "");
              }}
            >
              取消
            </button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
            编辑资料
          </Button>
        )}
        {saveMsg && <span className={styles.inlineMsg}>{saveMsg}</span>}
      </div>

      <div className={styles.logoutRow}>
        <button type="button" className={styles.logoutBtn} onClick={onLogout}>
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" />
            <polyline points="10 11 14 8 10 5" />
            <line x1="14" y1="8" x2="6" y2="8" />
          </svg>
          退出登录
        </button>
      </div>

      {/* 修改密码弹窗 */}
      {showPwdModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowPwdModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>修改密码</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowPwdModal(false)}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <TextField
                label="当前密码"
                type="password"
                value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)}
              />
              <div style={{ height: 12 }} />
              <TextField
                label="新密码"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <div style={{ height: 12 }} />
              <TextField
                label="确认新密码"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
              {pwdMsg && <p className={styles.pwdMsg}>{pwdMsg}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowPwdModal(false)}
              >
                取消
              </button>
              <Button size="sm" onClick={handleChangePwd} loading={pwdSaving}>
                {pwdSaving ? "修改中…" : "确认修改"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 危险区域 */}
      <div className={styles.dangerZone}>
        <div className={styles.dangerTitle}>危险区域</div>
        <p className={styles.dangerDesc}>
          删除所有学习数据，包括知识蓝图、学习会话、学习地图和练习记录。此操作不可撤销。
        </p>
        <button
          type="button"
          className={styles.dangerBtn}
          onClick={() => setShowDeleteModal(true)}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M2 4h12M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4M13 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4" />
          </svg>
          删除所有数据
        </button>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className={styles.confirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <h3 className={styles.confirmTitle}>确定要删除所有数据吗？</h3>
            <p className={styles.confirmDesc}>
              此操作将永久删除你的所有学习数据，包括：
              <br />• 所有知识蓝图和学习会话
              <br />• 所有学习地图
              <br />• 所有练习记录和错题本
              <br />
              <br />
              <strong>此操作不可撤销！</strong>
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelBtn}
                onClick={() => setShowDeleteModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.confirmDangerBtn}
                onClick={handleDeleteAllData}
                disabled={deleting}
              >
                {deleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── 外观设置 ── */
const AppearanceTab = () => {
  const stored = loadStoredPreferences();
  const { theme, setTheme } = useTheme();
  const [editorTheme, setEditorTheme] = useState(
    stored.editorTheme ?? "vs-dark",
  );
  const [editorFontSize, setEditorFontSize] = useState(
    stored.editorFontSize ?? 13,
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveStoredPreferences({
      editorTheme,
      editorFontSize: Number(editorFontSize),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={styles.tabContent}>
      <h2 className={styles.secTitle}>外观</h2>
      <p className={styles.secDesc}>自定义界面主题和编辑器外观</p>

      <div className={styles.settingsGroup}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>界面主题</span>
            <span className={styles.settingDesc}>选择亮色或暗色模式</span>
          </div>
          <div className={styles.themeSwitch}>
            <button
              type="button"
              className={`${styles.themeOption} ${theme === "light" ? styles.themeOptionActive : ""}`}
              onClick={() => {
                setTheme("light");
                saveStoredPreferences({ uiTheme: "light" });
              }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="16"
                height="16"
              >
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" />
              </svg>
              亮色
            </button>
            <button
              type="button"
              className={`${styles.themeOption} ${theme === "dark" ? styles.themeOptionActive : ""}`}
              onClick={() => {
                setTheme("dark");
                saveStoredPreferences({ uiTheme: "dark" });
              }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="16"
                height="16"
              >
                <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3 4.5 4.5 0 0 0 13 9.5Z" />
              </svg>
              暗色
            </button>
          </div>
        </div>
      </div>

      <h3 className={styles.subTitle}>代码编辑器</h3>
      <div className={styles.settingsGroup}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>编辑器主题</span>
            <span className={styles.settingDesc}>代码编辑器的配色方案</span>
          </div>
          <select
            className={styles.select}
            value={editorTheme}
            onChange={(e) => setEditorTheme(e.target.value)}
          >
            <option value="vs-dark">深色</option>
            <option value="light">浅色</option>
            <option value="hc-black">高对比</option>
          </select>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>编辑器字号</span>
            <span className={styles.settingDesc}>代码字体大小</span>
          </div>
          <select
            className={styles.select}
            value={editorFontSize}
            onChange={(e) => setEditorFontSize(e.target.value)}
          >
            {[11, 12, 13, 14, 15, 16, 18].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <Button size="sm" onClick={handleSave}>
          {saved ? "已保存 ✓" : "保存外观设置"}
        </Button>
      </div>
    </div>
  );
};

/* ── 关于 ── */
const AboutTab = () => (
  <div className={styles.tabContent}>
    <h2 className={styles.secTitle}>关于 EduFlow AI</h2>
    <p className={styles.secDesc}>版本信息与产品介绍</p>

    <div className={styles.aboutCard}>
      <div className={styles.aboutLogo}>
        <Logo size="lg" label="" />
      </div>
      <div className={styles.aboutInfo}>
        <div className={styles.aboutName}>EduFlow AI</div>
        <div className={styles.aboutVersion}>v1.0.0</div>
      </div>
    </div>

    <div className={styles.settingsGroup}>
      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <span className={styles.settingLabel}>产品定位</span>
        </div>
        <span className={styles.settingValue}>智慧编程学习平台</span>
      </div>
      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <span className={styles.settingLabel}>AI 引擎</span>
        </div>
        <span className={styles.settingValue}>DeepSeek</span>
      </div>
      <div className={styles.settingRow}>
        <div className={styles.settingInfo}>
          <span className={styles.settingLabel}>技术栈</span>
        </div>
        <span className={styles.settingValue}>
          React + Node.js + PostgreSQL
        </span>
      </div>
    </div>

    <div className={styles.aboutDesc}>
      <p>
        EduFlow AI 是一个基于人工智能的智慧编程学习平台。通过 AI
        自动生成个性化知识蓝图、智能助教对话、代码评审和练习题生成，为每位学习者提供量身定制的学习路径。
      </p>
      <p style={{ marginTop: 10 }}>核心功能包括：</p>
      <ul>
        <li>AI 驱动的知识蓝图生成与可视化</li>
        <li>直接回答式 AI 助教对话</li>
        <li>四维度代码质量评价</li>
        <li>混合题型智能练习与自动批改</li>
        <li>学习进度跟踪与数据统计</li>
      </ul>
    </div>
  </div>
);

export default SettingsPage;
