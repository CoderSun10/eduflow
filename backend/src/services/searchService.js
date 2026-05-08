/**
 * Web 搜索服务
 *
 * 使用 Tavily API 搜索最新的官方文档和权威资源。
 * 用于 RAG 流程：先搜索最新资料，再让 AI 基于搜索结果生成内容。
 *
 * 如果未配置 TAVILY_API_KEY，则返回空结果（AI 将基于自身知识生成）。
 */
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

const MATH_PATTERN =
  /数学|高数|高等数学|代数|线性代数|几何|解析几何|微积分|概率|统计|离散数学|数论|方程|三角|最优化|矩阵|mathematics|math|algebra|geometry|calculus|linear algebra|probability|statistics|discrete math|optimization/i;

const isMathRelated = (...values) =>
  values.some((value) => value && MATH_PATTERN.test(String(value)));

/**
 * 搜索相关的官方文档和权威资源
 * @param {string} query - 搜索关键词
 * @param {object} options - 搜索选项
 * @returns {Promise<{results: Array, query: string}>}
 */
const TAVILY_KEY_PLACEHOLDER = "your_tavily_api_key_here";

export const searchDocs = async (query, options = {}) => {
  if (!env.tavily.apiKey || env.tavily.apiKey === TAVILY_KEY_PLACEHOLDER) {
    logger.info("未配置有效 TAVILY_API_KEY，跳过网络搜索");
    return { results: [], query };
  }

  const {
    maxResults = 10,
    searchDepth = "advanced",
    includeDomains = [],
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: env.tavily.apiKey,
        query,
        search_depth: searchDepth,
        include_raw_content: true,
        max_results: maxResults,
        include_domains: includeDomains,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API 返回 ${response.status}`);
    }

    const data = await response.json();
    clearTimeout(timeoutId);

    const results = (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      rawContent: r.raw_content?.slice(0, 5000) ?? "",
      score: r.score,
    }));

    logger.info(`搜索完成，获取到 ${results.length} 条结果`, { query });
    return { results, query };
  } catch (err) {
    clearTimeout(timeoutId);
    logger.error("Web 搜索失败", { err: err.message, query });
    return { results: [], query };
  }
};

/**
 * 针对编程学习生成搜索查询列表
 * @param {string} language - 编程语言/技术关键词
 * @param {string} intent - 学习意图
 * @returns {string[]} 搜索查询列表
 */
export const buildSearchQueries = (language, intent) => {
  if (isMathRelated(language, intent)) {
    const subject = `${language} ${intent ?? ""}`.trim();
    return [
      `${subject} official curriculum textbook lecture notes`,
      `${subject} theorem formula summary university course`,
      `${subject} worked examples problem solving guide`,
      `${subject} foundational concepts definitions proofs`,
      `${subject} latest recommended learning resources`,
    ];
  }

  const queries = [
    `${language} official documentation latest version`,
    `${language} latest stable release notes official`,
    `${language} migration guide latest stable version`,
    `${language} tutorial comprehensive guide 2025 2026`,
    `${language} best practices modern latest`,
  ];

  if (intent) {
    queries.push(`${language} ${intent} official guide latest stable`);
  }

  return queries;
};

/**
 * 执行多个搜索并聚合结果
 * @param {string} language - 编程语言/技术关键词
 * @param {string} intent - 学习意图
 * @returns {Promise<{sources: Array, aggregatedContent: string}>}
 */
export const searchForLearningResources = async (language, intent) => {
  const queries = buildSearchQueries(language, intent);

  const allResults = [];
  const seenUrls = new Set();

  for (const q of queries) {
    const { results } = await searchDocs(q);
    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allResults.push(r);
      }
    }
  }

  // 按相关度排序
  allResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // 取前 15 个最相关的结果
  const topResults = allResults.slice(0, 15);

  // 聚合内容供 AI 使用
  const aggregatedContent = topResults
    .map(
      (r, i) =>
        `[来源${i + 1}] ${r.title}\nURL: ${r.url}\n内容摘要: ${r.content}\n详细内容: ${r.rawContent}`,
    )
    .join("\n\n---\n\n");

  const sources = topResults.map((r) => ({
    title: r.title,
    url: r.url,
    description: r.content,
    snippet: r.content,
  }));

  return { sources, aggregatedContent };
};
