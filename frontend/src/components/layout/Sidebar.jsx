/**
 * 应用侧边栏（可收起）
 *
 * 数据驱动：菜单从 props.items 接收，避免硬编码到组件里。
 * 当前选中项通过 react-router 的 useLocation 自动判定，
 * 业务页面只需把侧边栏放到 AppShell 中即可。
 */
import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Logo from "../common/Logo.jsx";
import styles from "./Sidebar.module.css";

const Sidebar = ({ items, footerSlot }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sections = items.reduce((acc, item) => {
    const last = acc[acc.length - 1];
    if (item.kind === "section") {
      acc.push({ title: item.title, items: [] });
    } else {
      if (!last) acc.push({ title: null, items: [item] });
      else last.items.push(item);
    }
    return acc;
  }, []);

  return (
    <>
      {/* 移动端菜单按钮 */}
      <button
        type="button"
        className={styles.mobileMenuBtn}
        onClick={() => setMobileOpen(true)}
        aria-label="打开菜单"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 4h10M3 8h10M3 12h10" />
        </svg>
      </button>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""} ${mobileOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.brand}>
          {collapsed ? (
            /* 收起态：只显示logo图标，hover时变为展开汉堡图标 */
            <button
              type="button"
              className={styles.brandToggle}
              onClick={() => setCollapsed(false)}
              title="展开菜单"
            >
              <span className={styles.brandToggleLogo}>
                <Logo size="sm" label="" />
              </span>
              <span className={styles.brandToggleIcon}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M3 4h10M3 8h10M3 12h10" />
                </svg>
              </span>
            </button>
          ) : (
            <>
              <Logo size="sm" />
              <button
                type="button"
                className={styles.collapseToggle}
                onClick={() => setCollapsed(true)}
                title="收起菜单"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M3 4h10M3 8h10M3 12h10" />
                </svg>
              </button>
            </>
          )}
        </div>

        <nav className={styles.nav}>
          {sections.map((sec, idx) => (
            <div key={idx}>
              {sec.title && !collapsed ? (
                <div className={styles.section}>{sec.title}</div>
              ) : null}
              {sec.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `${styles.item} ${isActive ? styles.itemActive : ""}`
                  }
                >
                  <span className={styles.itemIcon}>{item.icon}</span>
                  {!collapsed && (
                    <span className={styles.itemLabel}>{item.label}</span>
                  )}
                  {!collapsed && item.badge ? (
                    <span className={styles.itemBadge}>{item.badge}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {!collapsed && footerSlot ? (
          <div className={styles.footer}>
            <div className={styles.footerSlot}>{footerSlot}</div>
          </div>
        ) : null}
      </aside>
    </>
  );
};

export default Sidebar;
