/**
 * 已登录区域的整体外壳：左侧侧边栏 + 右侧内容
 *
 * 路由层用 <AppShell> 包裹需要侧边栏的页面，登录 / 注册等独立页面直接渲染。
 */
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import AIGenerationBanner from "./AIGenerationBanner.jsx";
import AIGenerationOverlay from "./AIGenerationOverlay.jsx";
import { RoutePaths } from "../../constants/routes.js";
import styles from "./AppShell.module.css";

const HomeIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

const StatsIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="9" width="3" height="5" rx="0.5" />
    <rect x="6.5" y="5" width="3" height="9" rx="0.5" />
    <rect x="11" y="2" width="3" height="12" rx="0.5" />
  </svg>
);

const PracticeIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 3h12v10H2z" rx="1" />
    <path d="M5 7l2 2 4-4" />
  </svg>
);

const LearningMapIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="3" cy="3" r="1.5" />
    <circle cx="13" cy="4" r="1.5" />
    <circle cx="6" cy="13" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M4.4 3.7l7.2.6M3.9 4.1l1.7 7.4M7.2 12.7l3.6-.7" />
  </svg>
);

const SettingsIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.7 2.4l.3-1.1a1 1 0 0 1 1-.7h.4a1 1 0 0 1 1 .7l.3 1.1a1 1 0 0 0 1.2.6l1-.5a1 1 0 0 1 1.2.2l.3.3a1 1 0 0 1 .2 1.2l-.5 1a1 1 0 0 0 .6 1.2l1.1.3a1 1 0 0 1 .7 1v.4a1 1 0 0 1-.7 1l-1.1.3a1 1 0 0 0-.6 1.2l.5 1a1 1 0 0 1-.2 1.2l-.3.3a1 1 0 0 1-1.2.2l-1-.5a1 1 0 0 0-1.2.6l-.3 1.1a1 1 0 0 1-1 .7h-.4a1 1 0 0 1-1-.7l-.3-1.1a1 1 0 0 0-1.2-.6l-1 .5a1 1 0 0 1-1.2-.2l-.3-.3a1 1 0 0 1-.2-1.2l.5-1a1 1 0 0 0-.6-1.2l-1.1-.3a1 1 0 0 1-.7-1v-.4a1 1 0 0 1 .7-1l1.1-.3a1 1 0 0 0 .6-1.2l-.5-1a1 1 0 0 1 .2-1.2l.3-.3a1 1 0 0 1 1.2-.2l1 .5a1 1 0 0 0 1.2-.6z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

const sidebarItems = [
  { kind: "section", title: "导航" },
  { to: RoutePaths.HOME, label: "主页", icon: HomeIcon, end: true },
  { to: RoutePaths.LEARNING_MAP, label: "学习地图", icon: LearningMapIcon },
  { to: RoutePaths.STATS, label: "学习统计", icon: StatsIcon },
  { to: RoutePaths.PRACTICE, label: "例题训练", icon: PracticeIcon },
  { kind: "section", title: "系统" },
  { to: RoutePaths.SETTINGS, label: "设置", icon: SettingsIcon },
];

const AppShell = () => (
  <div className={styles.shell}>
    <Sidebar items={sidebarItems} />
    <main className={styles.main}>
      <AIGenerationBanner />
      <div className={styles.content}>
        <Outlet />
      </div>
    </main>
    <AIGenerationOverlay />
  </div>
);

export default AppShell;
