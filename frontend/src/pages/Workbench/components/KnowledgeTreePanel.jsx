/**
 * 工作台左栏：紧凑型知识节点列表导航
 *
 * 顶级模块默认展开。点击模块名可折叠/展开（带平滑动画）。
 * 思维导图已移至 BlueprintModal 全屏展示。
 */
import { useState } from "react";
import styles from "./KnowledgeTreePanel.module.css";

/** 递归渲染树节点 */
const TreeNode = ({ node, depth, activeNodeId, onNodeSelect }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = !hasChildren;
  const isSelected = node.id === activeNodeId;
  const statusClass = node.status ?? "pending";
  return (
    <div key={node.id}>
      {isLeaf ? (
        <div
          className={`${styles.item} ${styles[`item_${statusClass}`] ?? ""} ${
            isSelected ? styles.itemSelected : ""
          }`}
          style={{ paddingLeft: `${Math.max(0, (depth - 2) * 12 + 8)}px` }}
          onClick={() => onNodeSelect(node.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onNodeSelect(node.id);
          }}
        >
          <span
            className={`${styles.dot} ${styles[`dot_${statusClass}`] ?? ""} ${
              isSelected ? styles.dotSelected : ""
            }`}
          />
          <span
            className={`${styles.label} ${isSelected ? styles.labelSelected : ""}`}
          >
            {node.name}
          </span>
        </div>
      ) : depth > 1 ? (
        <div
          className={styles.group}
          style={{ paddingLeft: `${Math.max(0, (depth - 2) * 12 + 4)}px` }}
        >
          <span className={styles.groupLabel}>{node.name}</span>
        </div>
      ) : null}

      {hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            activeNodeId={activeNodeId}
            onNodeSelect={onNodeSelect}
          />
        ))}
    </div>
  );
};

/** 顶级模块（带平滑展开/收缩动画） */
const Section = ({ section, activeNodeId, onNodeSelect, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.sectionBlock}>
      <button
        type="button"
        className={`${styles.sec} ${open ? styles.secOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className={`${styles.secChevron} ${open ? styles.secChevronOpen : ""}`}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </span>
        <span className={styles.secLabel}>{section.name}</span>
      </button>
      <div
        className={`${styles.collapseArea} ${open ? styles.collapseOpen : ""}`}
      >
        <div className={styles.collapseInner}>
          {section.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={2}
              activeNodeId={activeNodeId}
              onNodeSelect={onNodeSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const KnowledgeTreePanel = ({
  blueprint,
  activeNodeId,
  onNodeSelect,
  onOpenMap,
}) => {
  if (!blueprint?.tree) {
    return <aside className={styles.tree} />;
  }

  return (
    <aside className={styles.tree}>
      <button type="button" className={styles.mapBtn} onClick={onOpenMap}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        查看知识蓝图
      </button>

      {blueprint.tree.children?.map((section, idx) => (
        <Section
          key={section.id}
          section={section}
          activeNodeId={activeNodeId}
          onNodeSelect={onNodeSelect}
          defaultOpen={idx === 0}
        />
      ))}
    </aside>
  );
};

export default KnowledgeTreePanel;
