/**
 * 全屏知识蓝图模态框
 *
 * 使用 markmap 将蓝图可视化为从左到右的树状思维导图，全屏展示。
 * 蓝图 JSON 树先转为 Markdown 分级标题，再通过 markmap-lib 转换、markmap-view 渲染。
 * 点击叶子节点可选中并关闭模态框跳转到对应内容。
 */
import { useEffect, useRef, useCallback } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { downloadSvgAsImage } from "../../../utils/downloadSvgAsImage.js";
import { useTheme } from "../../../hooks/useTheme.jsx";
import styles from "./BlueprintModal.module.css";

const transformer = new Transformer();

/**
 * 将蓝图 JSON 树递归转换为 Markdown 分级标题字符串
 * depth=0 → # Root
 * depth=1 → ## Module
 * depth=2 → ### Topic
 * depth=3+ → #### Sub-topic
 * 最多 6 级标题，超出用列表
 */
const treeToMarkdown = (node, depth = 0) => {
  if (!node) return "";
  const lines = [];
  const maxHeading = 6;

  if (depth <= maxHeading) {
    lines.push(`${"#".repeat(depth + 1)} ${node.name}`);
  } else {
    const indent = "  ".repeat(depth - maxHeading);
    lines.push(`${indent}- ${node.name}`);
  }

  if (node.children?.length) {
    for (const child of node.children) {
      lines.push(treeToMarkdown(child, depth + 1));
    }
  }
  return lines.join("\n");
};

/**
 * 在 markmap 渲染后，遍历 SVG 中的文本节点，
 * 为匹配的叶子节点附加 data-node-id 属性以支持点击选中。
 */
const attachNodeIds = (svgEl, node) => {
  if (!node || !svgEl) return;
  const textEls = svgEl.querySelectorAll("text");
  const map = {};
  const collectLeaves = (n) => {
    if (!n.children || n.children.length === 0) {
      map[n.name] = n.id;
    }
    n.children?.forEach(collectLeaves);
  };
  collectLeaves(node);

  textEls.forEach((el) => {
    const text = el.textContent?.trim();
    if (text && map[text]) {
      const g = el.closest("g.markmap-node");
      if (g) {
        g.setAttribute("data-node-id", map[text]);
        g.style.cursor = "pointer";
      }
    }
  });
};

const toDownloadName = (value) =>
  (value || "knowledge-blueprint")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60);

const BlueprintModal = ({ blueprint, onNodeSelect, onClose }) => {
  const svgRef = useRef(null);
  const mmRef = useRef(null);
  const { theme } = useTheme();

  const handleDownload = useCallback(async () => {
    await downloadSvgAsImage(
      svgRef.current,
      `${toDownloadName(blueprint?.tree?.name || blueprint?.title)}-blueprint`,
    );
  }, [blueprint]);

  useEffect(() => {
    if (!blueprint?.tree || !svgRef.current) return;

    const svgEl = svgRef.current;
    const syncSvgPresentation = () => {
      const rect = svgEl.getBoundingClientRect();
      const width = Math.max(
        1,
        Math.round(rect.width || svgEl.clientWidth || 1),
      );
      const height = Math.max(
        1,
        Math.round(rect.height || svgEl.clientHeight || 1),
      );
      const rootStyle = window.getComputedStyle(document.documentElement);
      const textColor = rootStyle
        .getPropertyValue("--color-text-strong")
        .trim();
      const lineColor = rootStyle.getPropertyValue("--color-text-muted").trim();

      svgEl.setAttribute("width", String(width));
      svgEl.setAttribute("height", String(height));
      svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");

      svgEl.querySelectorAll("text").forEach((node) => {
        node.setAttribute("fill", textColor);
      });

      svgEl.querySelectorAll("path,line,polyline,polygon").forEach((node) => {
        if (
          node.getAttribute("stroke") &&
          node.getAttribute("stroke") !== "none"
        ) {
          node.setAttribute("stroke", lineColor);
        }
      });
    };

    svgEl.innerHTML = "";
    mmRef.current = null;

    const md = treeToMarkdown(blueprint.tree);
    const { root } = transformer.transform(md);

    mmRef.current = Markmap.create(
      svgEl,
      {
        autoFit: true,
        duration: 300,
        maxWidth: 260,
        paddingX: 16,
        colorFreezeLevel: 2,
      },
      root,
    );

    const timer = setTimeout(() => {
      syncSvgPresentation();
      attachNodeIds(svgEl, blueprint.tree);
    }, 400);

    requestAnimationFrame(() => {
      requestAnimationFrame(syncSvgPresentation);
    });

    return () => {
      clearTimeout(timer);
      svgEl.innerHTML = "";
      mmRef.current = null;
    };
  }, [blueprint, theme]);

  // 点击 SVG 中的节点
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleClick = (e) => {
      const g = e.target.closest("g[data-node-id]");
      if (g) {
        const nodeId = g.getAttribute("data-node-id");
        if (nodeId) {
          onNodeSelect(nodeId);
          onClose();
        }
      }
    };
    svg.addEventListener("click", handleClick);
    return () => svg.removeEventListener("click", handleClick);
  }, [onNodeSelect, onClose]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>知识蓝图</h2>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: "#22c55e" }}
              />
              已完成
            </span>
            <span className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: "#1a56db" }}
              />
              学习中
            </span>
            <span className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: "#94a3b8" }}
              />
              待学习
            </span>
          </div>
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={handleDownload}
          >
            下载图片
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.flowWrap}>
          <svg ref={svgRef} className={styles.markmapSvg} />
        </div>
      </div>
    </div>
  );
};

export default BlueprintModal;
