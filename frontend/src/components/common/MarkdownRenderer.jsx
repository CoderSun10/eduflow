import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import * as markdownItKatexModule from "@vscode/markdown-it-katex";
import hljs from "highlight.js";
import "katex/dist/katex.min.css";
import { useTheme } from "../../hooks/useTheme.jsx";

const markdownItKatex =
  markdownItKatexModule?.default?.default ??
  markdownItKatexModule?.default ??
  markdownItKatexModule;

const normalizeMathContent = (value) => {
  if (!value) return "";

  return String(value)
    .replace(/\\\[(.*?)\\\]/gs, (_, expr) => `$$${expr.trim()}$$`)
    .replace(/\\\((.*?)\\\)/gs, (_, expr) => `$${expr.trim()}$`);
};

const MarkdownRenderer = ({ content, className }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const html = useMemo(() => {
    const md = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
      typographer: true,
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
          } catch (_) {
            /* ignore */
          }
        }
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
      },
    });

    if (typeof markdownItKatex === "function") {
      md.use(markdownItKatex, {
        throwOnError: false,
        displayMode: false,
        output: "html",
      });
    }

    return content ? md.render(normalizeMathContent(content)) : "";
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={`markdownRenderer ${className ?? ""}`.trim()}
      data-theme={theme}
      data-markdown-theme={isDark ? "dark" : "light"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
