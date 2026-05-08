/**
 * AI 服务层 —— DeepSeek 大模型集成
 *
 * 提供：
 *   1. 知识蓝图生成（基于网络搜索 + 最新官方文档，生成树状思维导图）
 *   2. 知识节点内容生成（讲解 + 代码练习）
 *   3. AI 助教对话（苏格拉底式追问）
 *   4. 代码评价
 *
 * 使用 OpenAI SDK（DeepSeek 兼容 OpenAI API 格式）。
 */
import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { buildSessionDisplay } from "../utils/sessionDisplay.js";
import { searchForLearningResources } from "./searchService.js";

const client = new OpenAI({
  apiKey: env.deepseek.apiKey,
  baseURL: env.deepseek.baseUrl,
});

const MODEL = env.deepseek.model;

/**
 * 对 AI 调用添加指数退避重试（503/429/500 时自动重试）
 */
const withRetry = async (fn, maxRetries = 3) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      const isRetryable = status === 503 || status === 429 || status === 500;
      if (!isRetryable || attempt >= maxRetries) throw err;
      const delayMs = Math.min(30000, 3000 * Math.pow(2, attempt));
      logger.warn(
        `AI 服务暂时繁忙（${status}），${delayMs / 1000}s 后重试（第 ${attempt + 1}/${maxRetries} 次）`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

const MATH_PATTERN =
  /数学|高数|高等数学|代数|线性代数|几何|解析几何|微积分|概率|统计|离散数学|数论|方程|三角|最优化|矩阵|mathematics|math|algebra|geometry|calculus|linear algebra|probability|statistics|discrete math|optimization/i;

const AI_WITH_MATH_PATTERN =
  /人工智能|机器学习|深度学习|ai|machine learning|deep learning|data science|数据科学|computer vision|nlp|大模型|llm/i;

const isMathRelated = (...values) =>
  values.some((value) => value && MATH_PATTERN.test(String(value)));

const needsMathFoundation = (...values) =>
  values.some((value) => value && AI_WITH_MATH_PATTERN.test(String(value)));

const parseJsonResponse = (text) => {
  const raw = String(text ?? "").trim();
  if (!raw) {
    throw new Error("AI 未返回有效内容");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      return JSON.parse(fenced);
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("AI 返回内容不是有效 JSON");
  }
};

/* ─────────────────────────────────────────────
 * 1. 蓝图生成（树状思维导图）
 * ───────────────────────────────────────────── */

const BLUEPRINT_SYSTEM_PROMPT = `你是 EduFlow AI —— 一个顶级的编程学习架构师和知识图谱专家。
你的任务是生成一份完整、权威的树状知识思维导图。

## 核心原则
1. **只使用最新技术**：必须基于当前最新稳定版本的 API 和特性，坚决摒弃已废弃、过时的旧式 API 和技术
2. **权威性**：所有知识点必须来源于官方文档、官方教程、权威技术书籍
3. **全面性**：必须覆盖该技术的所有重要知识领域，不遗漏关键模块
4. **结构化**：以树状结构组织，从左到右展开，层次清晰

## 输出格式（严格 JSON，不要 markdown 代码块）
{
  "root": {
    "id": "root",
    "name": "技术关键词",
    "children": [
      {
        "id": "唯一ID",
        "name": "模块名称",
        "description": "该模块的学习目标概述",
        "children": [
          {
            "id": "唯一ID",
            "name": "知识点名称",
            "description": "具体学习目标",
            "children": []
          }
        ]
      }
    ]
  },
  "metadata": {
    "version": "该技术的最新稳定版本号",
    "officialDocs": "官方文档URL",
    "totalNodes": 0,
    "displayTitle": "用于会话卡片第一行粗体标题，简短自然，6~18 字，例如 Python 学习之旅、React 学习之旅",
    "displaySubtitle": "用于会话卡片第二行浅灰短句，写核心用途或技术关键词，建议 8~24 字，例如 爬虫 · 数据分析 · 自动化",
    "subjectSummary": "用 2~3 句话概括这门技术是什么、解决什么问题、学习后能做什么",
    "useCases": ["典型应用方向1", "典型应用方向2"],
    "isLatestStable": true,
    "versionNote": "说明该知识体系是否基于最新稳定版、参考了哪些版本说明或官方资料"
  },
  "referenceResources": [
    {
      "title": "资源名称（官方文档/权威书籍/教程名）",
      "url": "资源URL（官方文档链接、书籍豆瓣页或在线阅读链接等）",
      "type": "doc|book|tutorial|video",
      "description": "简要说明该资源的内容和推荐理由"
    }
  ]
}

## 结构规则
- 第一级（root 的 children）：大模块/主题领域（5~10 个），覆盖技术的所有方面
- 第二级：每个模块下的知识点分组（每个模块 3~8 个子项）
- 第三级：具体知识点（每组 2~6 个细化知识点）
- 可以有第四级用于特别复杂的知识点（可选）
- 所有 id 使用短横线连接的英文标识（如 "python-basics", "list-comprehension"）
- name 简洁有力（2~8 个字）
- description 说明学完能掌握什么能力

## 排列顺序
- 模块从基础到高级排列
- 同级知识点从简单到复杂排列
- 学习路径应当自然递进，前面的知识为后面的铺垫

## 关键要求
- 如果提供了搜索到的参考资料，必须充分利用这些资料中的知识体系来组织内容
- 确保使用的 API、方法名、类名等都是最新版本的
- metadata.displayTitle 必须适合直接作为会话名称展示，避免生硬、避免整段句子
- metadata.displaySubtitle 必须简短，优先写该技术能做什么或核心关键词，使用短语而不是长句
- referenceResources 必须包含 5~10 个权威参考资源，包括：
  - 官方文档（必须）
  - 权威技术书籍（推荐 2~3 本经典书籍）
  - 优质教程或学习网站
  - 相关视频教程平台链接（可选）
- 每个资源的 url 必须是真实可访问的链接
- 只输出 JSON，不要任何多余文字`;

const MATH_BLUEPRINT_SYSTEM_PROMPT = `你是 EduFlow AI —— 一个顶级的数学学习架构师和知识图谱专家。
你的任务是为数学主题生成一份完整、权威、适合长期学习的树状知识蓝图。

## 核心原则
1. 以数学学科体系组织内容，从最基础定义、最小前置知识、核心公式、典型方法到应用场景逐步展开
2. 必须强调前置依赖关系，保证学习顺序自然递进
3. 所有知识点都应服务于“理解概念 + 掌握公式 + 学会推导/证明 + 能够解题”
4. 若主题与人工智能/机器学习相关，必须纳入线性代数、微积分、概率统计、最优化等数学基础

## 输出格式（严格 JSON，不要 markdown 代码块）
{
  "root": {
    "id": "root",
    "name": "数学主题",
    "children": [
      {
        "id": "唯一ID",
        "name": "模块名称",
        "description": "该模块的学习目标概述，说明会掌握哪些公式/方法/解题能力",
        "children": []
      }
    ]
  },
  "metadata": {
    "version": "教材体系或课程阶段说明",
    "officialDocs": "优先填权威教材、课程主页、大学公开课或学会资源链接",
    "totalNodes": 0,
    "displayTitle": "用于会话卡片第一行粗体标题，简短自然，6~18 字，例如 线性代数学习之旅、微积分入门",
    "displaySubtitle": "用于会话卡片第二行浅灰短句，写核心用途或关键词，建议 8~24 字，例如 矩阵运算 · 空间理解 · AI 基础",
    "subjectSummary": "用 2~3 句话概括这门数学主题学什么、解决什么问题、能支撑哪些后续领域",
    "useCases": ["典型应用方向1", "典型应用方向2"],
    "isLatestStable": true,
    "versionNote": "说明参考了哪些教材体系、课程资源或权威资料"
  },
  "referenceResources": [
    {
      "title": "资源名称",
      "url": "资源URL",
      "type": "doc|book|tutorial|video|course",
      "description": "推荐理由"
    }
  ]
}

## 结构规则
- 对数学主题，第一批模块必须面向小白，从“这是什么、为什么要学、最基本对象/记号/直观理解”开始，不能一上来直接进入复杂解题或高阶方法
- 如果用户只输入一个学科关键词（如“线性代数”），默认按零基础学习者处理，先安排入门概念、基本对象、基本运算，再进入矩阵解方程组、特征值等进阶主题
- metadata.displayTitle 要像课程名或学习项目名，简洁、自然、适合卡片标题
- metadata.displaySubtitle 要用极短短语概括用途、关键词或学习收益，避免完整句子
- 一级模块应覆盖定义、公式、运算、推导/证明、典型题型、应用方向等关键部分
- 二级和三级节点要具体到可学习、可练习的知识点
- name 简洁，description 要明确能力目标
- 若涉及公式，可在 description 中简要说明该节点围绕哪类公式或方法
- 只输出 JSON，不要任何多余文字`;

export const generateBlueprint = async (language, intent) => {
  try {
    // 步骤 1：搜索最新的官方文档和权威资源
    logger.info("开始搜索最新学习资源", { language, intent });
    const { sources, aggregatedContent } = await searchForLearningResources(
      language,
      intent,
    );

    // 步骤 2：构建用户消息（包含搜索结果）
    const mathMode = isMathRelated(language, intent);
    const requireMathFoundation = needsMathFoundation(language, intent);
    let userMessage = `学科/技术关键词：${language}\n学习意图：${intent || "全面系统学习"}`;

    if (aggregatedContent) {
      userMessage += `\n\n## 以下是搜索到的最新官方文档和权威资源内容，请基于这些内容生成思维导图：\n\n${aggregatedContent}`;
    } else {
      userMessage += `\n\n注意：未能获取到网络搜索结果，请基于你所知的该技术最新稳定版本的完整知识体系生成思维导图。确保所有 API 和概念都是最新的，不要使用任何已废弃的旧式写法。`;
    }

    if (!mathMode && requireMathFoundation) {
      userMessage += `\n\n补充要求：该主题明显涉及人工智能/机器学习等方向，请在知识蓝图中显式补入必要的数学前置基础，例如线性代数、微积分、概率统计、最优化，并说明这些数学基础分别支撑哪些后续主题。`;
    }

    // 步骤 3：调用 AI 生成树状思维导图（失败时最多重试 3 次）
    const response = await withRetry(() =>
      client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: mathMode
              ? MATH_BLUEPRINT_SYSTEM_PROMPT
              : BLUEPRINT_SYSTEM_PROMPT,
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    );

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonResponse(text);
    const metadata = {
      ...(parsed.metadata ?? {}),
      isLatestStable: parsed.metadata?.isLatestStable ?? true,
      subjectSummary:
        parsed.metadata?.subjectSummary ||
        `${language} 的学习内容基于最新稳定版资料整理，覆盖基础概念、核心能力与实践方向。`,
      versionNote:
        parsed.metadata?.versionNote ||
        "系统优先检索最新官方文档、稳定版说明与现代最佳实践后生成该会话知识蓝图。",
      useCases:
        parsed.metadata?.useCases?.length > 0
          ? parsed.metadata.useCases
          : [
              `使用 ${language} 构建真实项目`,
              `围绕“${intent || language}”形成系统能力`,
            ],
    };

    const display = buildSessionDisplay({
      language,
      title: parsed.root?.name,
      intent,
      metadata,
    });

    metadata.displayTitle = metadata.displayTitle || display.displayTitle;
    metadata.displaySubtitle =
      metadata.displaySubtitle || display.displaySubtitle;

    // 合并 AI 生成的参考资源与搜索来源
    const aiReferences = (parsed.referenceResources ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      type: r.type,
      description: r.description,
    }));
    const mergedSources = [...sources];
    const seenUrls = new Set(sources.map((s) => s.url));
    for (const ref of aiReferences) {
      if (ref.url && !seenUrls.has(ref.url)) {
        seenUrls.add(ref.url);
        mergedSources.push(ref);
      }
    }

    return {
      tree: parsed.root,
      metadata,
      sources: mergedSources,
    };
  } catch (err) {
    logger.error("AI 蓝图生成失败", { err: err.message });
    throw err;
  }
};

const LEARNING_MAP_SYSTEM_PROMPT = `你是 EduFlow AI 的学习路线总设计师。
你的任务是基于最新稳定版官方资料与权威资源，生成一份长期可执行的学习地图。

输出必须是严格 JSON，不要输出 markdown 代码块：
{
  "root": {
    "id": "root",
    "name": "学习目标",
    "status": "recommended",
    "children": [
      {
        "id": "阶段唯一ID",
        "name": "阶段名称",
        "description": "阶段目标说明",
        "status": "completed|in_progress|recommended|locked",
        "children": []
      }
    ]
  },
  "metadata": {
    "version": "涉及技术栈的主版本或时代说明",
    "officialDocs": "核心官方入口URL",
    "subjectSummary": "这条学习路线主要在学什么、最终能做什么",
    "useCases": ["应用方向1", "应用方向2"],
    "isLatestStable": true,
    "versionNote": "说明路线依据的最新稳定版或最新行业实践",
    "totalNodes": 0
  },
  "progressInsights": [
    "结合用户当前会话，说明已经学到哪里",
    "下一阶段最应该补什么"
  ],
  "referenceResources": [
    {
      "title": "资源名称",
      "url": "资源链接",
      "type": "doc|book|tutorial|video",
      "description": "推荐原因"
    }
  ]
}

规则：
1. 路线必须按从入门到高级排列，可包含分支
2. 每个节点 name 简洁，description 说明该阶段完成后获得什么能力
3. 必须优先使用最新稳定版、最新官方文档与现代技术栈
4. 如果用户当前已有进行中的学习会话，要据此标注 status，并在 progressInsights 中说明衔接关系
5. 至少输出 3 个一级阶段，每个阶段 2~6 个子节点
6. 如果目标涉及人工智能、机器学习、数据科学等方向，必须明确补入线性代数、微积分、概率统计、最优化等数学基础阶段
7. 如果目标本身是数学主题，路线中必须覆盖概念理解、公式掌握、推导/证明、典型题型训练与应用迁移
8. 只输出 JSON`;

const PROGRESS_INSIGHTS_SYSTEM_PROMPT = `你是 EduFlow AI —— 一个学习进度分析专家。
根据用户的学习地图和当前学习会话状态，生成一段简洁的学习进度建议。

## 输出格式（严格 JSON）
{
  "progressInsight": "一段 80-150 字的学习进度建议，说明当前学习进度、下一步方向和需要补充的知识点。不要用编号列表，用自然流畅的段落描述。"
}

## 规则
1. 用一段话概括当前进度和建议，不要写成编号列表
2. 结合用户已完成、进行中的会话给出针对性建议
3. 如果某些关键节点还未开始学习，简要提及
4. 语言简洁自然，像导师给学生的建议
5. 只输出 JSON`;

export const generateProgressInsights = async (
  mapTitle,
  mapGoal,
  tree,
  sessions,
) => {
  try {
    const sessionContext = sessions.length
      ? sessions
          .map(
            (s, i) =>
              `${i + 1}. ${s.displayTitle || s.title}｜状态：${s.status === "completed" ? "已完成" : s.status === "active" ? "学习中" : "已暂停"}｜进度：${s.progress}%`,
          )
          .join("\n")
      : "当前还没有关联的学习会话。";

    const collectNodeNames = (node, depth = 0, acc = []) => {
      if (!node) return acc;
      if (depth > 0 && depth <= 2) {
        acc.push(
          `${node.name}(${node.status === "completed" ? "已掌握" : node.status === "in_progress" ? "学习中" : "待学习"})`,
        );
      }
      node.children?.forEach((child) =>
        collectNodeNames(child, depth + 1, acc),
      );
      return acc;
    };
    const nodeOverview = collectNodeNames(tree).slice(0, 15).join("、");

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: PROGRESS_INSIGHTS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `学习地图：${mapTitle}\n目标：${mapGoal}\n\n路线节点概览：${nodeOverview}\n\n关联学习会话：\n${sessionContext}\n\n请根据以上信息生成学习进度建议。`,
        },
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonResponse(text);
    // Return as single string (new format) or join array (legacy)
    return parsed.progressInsight || (parsed.progressInsights ?? []).join(" ");
  } catch (err) {
    logger.error("生成学习进度建议失败", { err: err.message });
    return [];
  }
};

const SESSION_MATCHING_SYSTEM_PROMPT = `你是一个学习内容匹配专家。判断用户的学习会话是否与学习路线图中的知识节点相关。

## 输出格式（严格 JSON）
{
  "matches": [
    {"sessionId": "会话ID", "matchedNodes": ["节点名称1", "节点名称2"]}
  ]
}

## 规则
1. 只匹配真正相关的会话和节点，例如"Python学习之旅"与"Python编程入门"相关
2. 不相关的会话不要放入matches数组
3. 一个会话可以匹配多个相关节点
4. 只输出 JSON`;

export const matchSessionsToNodes = async (sessions, leafNodes) => {
  if (!sessions.length || !leafNodes.length) return [];

  try {
    const sessionList = sessions.map((s) => ({
      id: s.id,
      title: s.displayTitle || s.title,
      language: s.language,
      status: s.status,
    }));

    const nodeList = leafNodes.map((n) => n.name);

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SESSION_MATCHING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `学习会话列表：\n${JSON.stringify(sessionList, null, 2)}\n\n学习路线图节点：\n${nodeList.join("、")}\n\n请判断哪些会话与哪些节点相关。`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonResponse(text);
    return parsed.matches ?? [];
  } catch (err) {
    logger.error("AI会话匹配失败", { err: err.message });
    return [];
  }
};

export const generateLearningMap = async (goal, currentSessions = []) => {
  try {
    logger.info("开始生成学习地图", {
      goal,
      sessionCount: currentSessions.length,
    });
    const { sources, aggregatedContent } = await searchForLearningResources(
      goal,
      goal,
    );

    const sessionContext = currentSessions.length
      ? currentSessions
          .map(
            (session, index) =>
              `${index + 1}. ${session.title}｜主题：${session.language}｜进度：${session.progress}%｜状态：${session.status}｜学习意图：${session.intent}`,
          )
          .join("\n")
      : "当前还没有进行中的学习会话。";

    let userMessage = `用户目标：${goal}\n\n当前进行中的学习会话：\n${sessionContext}`;
    if (aggregatedContent) {
      userMessage += `\n\n以下是搜索到的最新官方文档、稳定版资料和权威资源，请你基于这些内容生成学习地图：\n\n${aggregatedContent}`;
    }
    if (needsMathFoundation(goal)) {
      userMessage += `\n\n补充要求：由于该目标与人工智能/机器学习方向相关，请在学习路线中明确纳入数学前置基础（线性代数、微积分、概率统计、最优化等），并说明这些基础与后续 AI 主题的衔接关系。`;
    }

    const response = await withRetry(() =>
      client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: LEARNING_MAP_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    );

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonResponse(text);
    const metadata = {
      ...(parsed.metadata ?? {}),
      isLatestStable: parsed.metadata?.isLatestStable ?? true,
      subjectSummary:
        parsed.metadata?.subjectSummary ||
        `这份学习地图围绕“${goal}”展开，帮助你从基础能力逐步走向真实项目研发与专业进阶。`,
      versionNote:
        parsed.metadata?.versionNote ||
        "系统优先检索最新官方文档、最新稳定版与现代技术实践后生成该学习地图。",
      useCases:
        parsed.metadata?.useCases?.length > 0
          ? parsed.metadata.useCases
          : [
              "形成系统学习路线",
              "指导阶段性进度规划",
              "衔接专项学习与项目实践",
            ],
    };

    const aiReferences = (parsed.referenceResources ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      type: r.type,
      description: r.description,
    }));
    const mergedSources = [...sources];
    const seenUrls = new Set(sources.map((s) => s.url));
    for (const ref of aiReferences) {
      if (ref.url && !seenUrls.has(ref.url)) {
        seenUrls.add(ref.url);
        mergedSources.push(ref);
      }
    }

    return {
      tree: parsed.root,
      metadata,
      progressInsights: parsed.progressInsights ?? [],
      sources: mergedSources,
    };
  } catch (err) {
    logger.error("学习地图生成失败", { err: err.message, goal });
    throw err;
  }
};

/* ─────────────────────────────────────────────
 * 2. 知识节点内容生成
 * ───────────────────────────────────────────── */

const NODE_CONTENT_SYSTEM_PROMPT = `你是 EduFlow AI —— 一个顶级编程教学导师。
你的任务是为一个知识节点生成高质量的学习内容。

## 核心原则
1. **只教最新写法**：必须使用该技术当前最新稳定版本的 API 和最佳实践
2. **坚决摒弃旧写法**：如果某个 API 已废弃或有更现代的替代方案，只教新方案，并简要提及旧方案已废弃
3. **权威准确**：所有代码示例必须可直接运行，语法完全正确
4. **循序渐进**：从概念到示例到练习，逐步深入

## 输出格式（严格 JSON，不要 markdown 代码块）
{
  "explanation": "详细的知识讲解（Markdown 格式，包含：概念解释 → 核心原理 → 代码示例 → 注意事项）",
  "codeExercise": {
    "title": "练习题标题",
    "description": "练习要求描述（清晰说明输入输出和要求）",
    "starterCode": "初始代码模板（包含 TODO 注释标注需要补全的位置）",
    "solution": "完整参考答案代码",
    "testCases": "验证说明或测试用例（描述如何验证代码正确性）"
  },
  "keyPoints": ["要点1", "要点2", "要点3", "要点4", "要点5"]
}

## 规则
- explanation 要像优质技术博客一样详细，包含多个代码示例
- 代码注释使用中文
- codeExercise 的 starterCode 中用 # TODO: 或 // TODO: 标注需要补全的位置
- keyPoints 提炼 3~5 个最关键的知识要点，每个要点一句话概括
- 只输出 JSON`;

const MATH_NODE_CONTENT_SYSTEM_PROMPT = `你是 EduFlow AI —— 一个顶级数学导师。
你的任务是为一个数学知识节点生成高质量的学习内容。

## 输出格式（严格 JSON，不要 markdown 代码块）
{
  "explanation": "详细的数学讲解（Markdown 格式），必须以通俗中文解释为主，包含概念解释、核心公式、必要推导思路、至少 2 个例题；只有在确实必要时才使用 LaTeX 公式语法（行内 $...$，块级 $$...$$）",
  "exerciseType": "math",
  "practiceExercise": {
    "title": "练习题标题",
    "description": "练习要求描述，可包含公式与分步提示",
    "solution": "详细参考解答，必要时给出分步推导，并使用 LaTeX 公式语法",
    "testCases": "建议如何自检，例如代入验证、边界讨论、结果检验"
  },
  "codeExercise": null,
  "keyPoints": ["要点1", "要点2", "要点3", "要点4"]
}

## 规则
- explanation 必须真正适配数学学科，不要强行输出编程代码
- 先用中文把概念讲明白，再给公式；不要一上来堆大量数学符号
- 只有关键定义、关键公式、关键推导步骤才使用 LaTeX，避免整段连续公式
- 每出现一个公式，都要紧跟一句中文解释，说明每个字母/符号代表什么、这个公式是干什么的
- 对初学者内容，优先使用项目符号、分步讲解和自然语言解释，不要写成纯符号笔记
- 公式统一使用 LaTeX 书写，例如 $a^2+b^2=c^2$ 或 $$\\int_0^1 x^2 dx = \\frac{1}{3}$$
- 讲解要覆盖“是什么、为什么、怎么用、容易错在哪里”
- practiceExercise 必须是可直接练习的数学题，而不是代码题
- 只输出 JSON`;

export const generateNodeContent = async (
  language,
  nodeName,
  parentPath,
  intent,
) => {
  try {
    const mathMode = isMathRelated(language, nodeName, parentPath, intent);
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: mathMode
            ? MATH_NODE_CONTENT_SYSTEM_PROMPT
            : NODE_CONTENT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: mathMode
            ? `学科：${language}\n知识路径：${parentPath}\n当前知识节点：${nodeName}\n用户学习意图：${intent}\n\n请生成完整的数学学习内容。要求：以中文讲解为主，先解释概念，再给少量必要公式；每个公式后面都要补一句中文说明，不要输出大段难懂的符号堆叠。使用 Markdown + LaTeX 公式语法。`
            : `技术/编程语言：${language}\n知识路径：${parentPath}\n当前知识节点：${nodeName}\n用户学习意图：${intent}\n\n请确保使用 ${language} 最新稳定版本的语法和 API。`,
        },
      ],
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseJsonResponse(text);
  } catch (err) {
    logger.error("AI 节点内容生成失败", { err: err.message, nodeName });
    throw err;
  }
};

/* ─────────────────────────────────────────────
 * 3. AI 助教对话（苏格拉底式追问）
 * ───────────────────────────────────────────── */

const TUTOR_SYSTEM_PROMPT = `你是 EduFlow AI 助教 —— 一个高效、可靠的编程与学习助手。
你的默认风格是直接回答：用户问什么，就直接给出清晰、可执行、尽量一步到位的答案，不要先反问，不要刻意用苏格拉底式追问。

回答原则：
1. 优先直接回答用户问题，先给结论，再补充必要解释
2. 如果用户是在赶时间，尽量提供最短路径的可用答案
3. 如果问题涉及排错，直接指出最可能原因和修复方案
4. 如果需要代码示例，直接给出能用的示例，代码必须使用最新版本语法
5. 如果用户要求步骤，给出分步骤方案；如果用户没要求，避免冗长铺垫
6. 回答简洁清楚，但信息要完整，避免空泛
7. 使用中文回答
8. 如果涉及具体 API，必须确认是最新版本的用法，不得推荐已废弃的方法`;

export const chat = async (messages, context = {}) => {
  const { language, nodeName, nodePath, sources } = context;
  const mathMode = isMathRelated(language, nodeName, nodePath);

  let systemMsg = `${TUTOR_SYSTEM_PROMPT}\n\n当前学习上下文：
- 技术/编程语言：${language ?? "未指定"}
- 当前知识路径：${nodePath ?? "未指定"}
- 当前知识节点：${nodeName ?? "未指定"}`;

  if (mathMode) {
    systemMsg += `\n\n当前主题带有明显数学属性。请优先用数学老师的方式解释：
- 用定义、公式、推导思路、例题来讲清楚
- 公式统一使用 LaTeX 语法（行内 $...$，块级 $$...$$）
- 如果用户是在求解题目或赶时间，直接给出完整解题步骤和最终答案`;
  }

  if (sources?.length) {
    const srcList = sources
      .map((s) => `  - ${s.title || s.url}${s.url ? ` (${s.url})` : ""}`)
      .join("\n");
    systemMsg += `\n\n该科目的参考资源（用户提供或系统搜索）：\n${srcList}\n你可以引用这些资源中的内容来回答学生的问题，并在适当时候提及参考来源。`;
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: systemMsg }, ...messages],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseJsonResponse(text);
  } catch (err) {
    logger.error("AI 对话失败", { err: err.message });
    throw err;
  }
};

/* ─────────────────────────────────────────────
 * 4. AI 助教对话（流式）
 * ───────────────────────────────────────────── */

export const chatStream = async (messages, context = {}) => {
  const { language, nodeName, nodePath, sources } = context;
  const mathMode = isMathRelated(language, nodeName, nodePath);

  let systemMsg = `${TUTOR_SYSTEM_PROMPT}\n\n当前学习上下文：
- 技术/编程语言：${language ?? "未指定"}
- 当前知识路径：${nodePath ?? "未指定"}
- 当前知识节点：${nodeName ?? "未指定"}`;

  if (mathMode) {
    systemMsg += `\n\n当前主题带有明显数学属性。请优先用数学老师的方式解释：
- 用定义、公式、推导思路、例题来讲清楚
- 公式统一使用 LaTeX 语法（行内 $...$，块级 $$...$$）
- 如果用户是在求解题目或赶时间，直接给出完整解题步骤和最终答案`;
  }

  if (sources?.length) {
    const srcList = sources
      .map((s) => `  - ${s.title || s.url}${s.url ? ` (${s.url})` : ""}`)
      .join("\n");
    systemMsg += `\n\n该科目的参考资源（用户提供或系统搜索）：\n${srcList}\n你可以引用这些资源中的内容来回答学生的问题，并在适当时候提及参考来源。`;
  }

  const stream = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: systemMsg }, ...messages],
    temperature: 0.7,
    max_tokens: 800,
    stream: true,
    response_format: { type: "json_object" },
  });

  return stream;
};

/* ─────────────────────────────────────────────
 * 5. 代码评价
 * ───────────────────────────────────────────── */

const CODE_REVIEW_SYSTEM_PROMPT = `你是 EduFlow AI 的代码评审专家。
请从以下 4 个维度对学生代码进行评价，输出严格 JSON。

## 评价标准
- **正确性**：代码是否能正确完成要求的功能
- **可读性**：变量命名、代码结构、注释是否清晰
- **效率**：算法和数据结构选择是否合理
- **风格**：是否符合该语言最新的最佳实践和编码规范

## 输出格式
{
  "correctness": { "score": 0-100, "comment": "正确性评价" },
  "readability":  { "score": 0-100, "comment": "可读性评价" },
  "efficiency":   { "score": 0-100, "comment": "效率评价" },
  "style":        { "score": 0-100, "comment": "代码风格评价" },
  "overall":      0-100,
  "suggestion":   "综合改进建议（2~3句话，给出具体可操作的改进方向）",
  "improvedCode": "如果代码有明显问题，给出改进后的代码；否则为空字符串"
}

## 规则
- 评分客观，基于代码实际质量
- comment 简洁（1~2句话）
- 如果代码使用了已废弃的旧式 API，在 suggestion 中明确指出并推荐最新替代方案
- 只输出 JSON`;

/* ─────────────────────────────────────────────
 * 6. 例题训练生成（专项 / 综合 / 项目挑战）
 * ───────────────────────────────────────────── */

const FOCUSED_SYSTEM_PROMPT = `你是 EduFlow AI —— 顶级编程练习出题专家。
你要为"专项练习"模式生成 3~5 道混合题型的练习题。

## 题型要求
- 必须包含 1~2 道 **代码实操题**（type="code"），其余可以是 **选择题**（type="choice"）或 **填空题**（type="fill"）
- 选择题必须有 4 个选项（A/B/C/D），并给出唯一正确选项
- 填空题必须给出明确的正确答案文本
- 代码题必须给出 starterCode 和 solution

## 核心原则
- **表意完整**：每道题必须完全自包含、语义完整，读者不需要查阅任何外部资料就能理解题意
- **不允许**出现"代码示意""如上所示""参考之前"这类模糊表述
- **代码题的题目描述**中必须明确写出输入格式、输出格式和至少一个完整的输入输出示例
- 如果涉及特定 API 或函数，必须在题目中简要说明该 API 的用途和签名

## 输出格式（严格 JSON）
{
  "problems": [
    {
      "type": "choice",
      "title": "题目标题",
      "description": "完整的题目描述（Markdown 格式）",
      "difficulty": 1,
      "tags": ["知识点1"],
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "answer": "A",
      "explanation": "详细解析，说明为什么正确以及其他选项为什么错"
    },
    {
      "type": "fill",
      "title": "题目标题",
      "description": "题目描述，用 ____ 标注填空位置",
      "difficulty": 2,
      "tags": ["知识点1"],
      "answer": "正确答案文本",
      "explanation": "解析"
    },
    {
      "type": "code",
      "title": "题目标题",
      "description": "完整的题目描述（含输入输出示例）",
      "difficulty": 2,
      "tags": ["知识点1"],
      "starterCode": "初始代码模板",
      "solution": "完整参考答案",
      "explanation": "解题思路和关键知识点说明"
    }
  ]
}

## 规则
- difficulty 1=简单 2=中等 3=困难
- 只输出 JSON，不要其他文字`;

const COMPREHENSIVE_SYSTEM_PROMPT = `你是 EduFlow AI —— 顶级编程练习出题专家。
你要为"综合练习"模式生成 3~5 道混合题型的练习题，综合考察多个知识点。

## 题型要求
- 必须包含 1~2 道 **代码实操题**（type="code"），其余为 **选择题**（type="choice"）或 **填空题**（type="fill"）
- 题目应当将多个知识点融合在一起考察

## 核心原则
- **表意完整**：每道题必须完全自包含，读者不需要查阅外部资料即可理解
- **不允许**模糊表述
- 代码题必须明确输入输出格式和至少一个完整示例
- AI 应根据用户的学习进度自动选择合适的知识点组合
- 如果涉及特定 API，必须在题目中说明

## 输出格式（严格 JSON，同专项练习格式）
{
  "problems": [
    {
      "type": "choice|fill|code",
      "title": "...",
      "description": "...",
      "difficulty": 1-3,
      "tags": ["..."],
      "options": ["..."],       // choice 专有
      "answer": "...",          // choice / fill 的正确答案
      "starterCode": "...",     // code 专有
      "solution": "...",        // code 专有
      "explanation": "详细解析"
    }
  ]
}

## 规则
- difficulty 1=简单 2=中等 3=困难
- 只输出 JSON`;

const PROJECT_SYSTEM_PROMPT = `你是 EduFlow AI —— 顶级编程项目出题专家。
你要为"项目挑战"模式生成 **恰好 1 道** 代码实操题（type="code"）。

## 核心原则
- 这是一个综合性项目任务，需要融合用户所选的多个学科的知识
- **表意完整**：题目必须完全自包含、语义完整，读者不需要查阅任何外部资料
- 题目描述中必须明确：项目背景、功能需求、输入输出格式、至少一组完整的示例
- 如果涉及特定 API 或库，必须在题目中说明用途和关键方法签名
- 代码量适中，不要太长，但要有一定综合性

## 输出格式（严格 JSON）
{
  "problems": [
    {
      "type": "code",
      "title": "项目挑战标题",
      "description": "完整详细的项目描述（Markdown 格式，包含背景、需求、输入输出示例）",
      "difficulty": 1-3,
      "tags": ["涉及学科1", "涉及学科2"],
      "starterCode": "项目初始代码模板",
      "solution": "完整参考答案",
      "explanation": "解题思路、架构设计和关键知识点说明"
    }
  ]
}

## 规则
- 只生成 1 道题
- 只输出 JSON`;

const MATH_PRACTICE_SYSTEM_PROMPT = `你是 EduFlow AI —— 顶级数学练习命题专家。
你要根据学习目标生成 3~5 道适合数学学科的练习题。

## 题型要求
- 使用 choice 或 fill 两种题型
- 题目必须包含完整题干，必要时使用 LaTeX 公式语法
- explanation 必须说明关键思路、常见错误与公式依据，并尽量用中文自然语言解释，不要堆砌符号
- fill 题的 answer 应给出标准答案；若存在等价形式，也要在 explanation 中说明

## 输出格式（严格 JSON）
{
  "problems": [
    {
      "type": "choice|fill",
      "title": "题目标题",
      "description": "完整题目描述（Markdown + LaTeX）",
      "difficulty": 1,
      "tags": ["知识点"],
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A 或标准答案文本",
      "explanation": "详细解析（Markdown + LaTeX）"
    }
  ]
}

## 规则
- 只输出 JSON
- 若主题涉及人工智能所需数学基础，可适当融入线性代数、概率统计、微积分、最优化等前置知识
- 除非必要，不要让一道题的题干和解析充满连续公式；优先让学生看得懂`;

const GRADE_SYSTEM_PROMPT = `你是 EduFlow AI 的自动批改专家。
请根据题目和用户答案，判断是否正确并给出详细反馈。

## 输入
- 题目类型（choice / fill / code）
- 题目描述
- 正确答案 / 参考代码
- 用户提交的答案

## 输出格式（严格 JSON）
{
  "isCorrect": true/false,
  "score": 0-100,
  "feedback": "详细的批改反馈（Markdown 格式）：说明对错原因、知识点分析、改进建议",
  "correctAnswer": "正确答案（如果用户答错，展示正确答案）",
  "codeReview": {
    "correctness": { "score": 0-100, "comment": "..." },
    "readability":  { "score": 0-100, "comment": "..." },
    "efficiency":   { "score": 0-100, "comment": "..." },
    "style":        { "score": 0-100, "comment": "..." },
    "suggestion":   "改进建议"
  }
}

## 规则
- 选择题/填空题：isCorrect 严格判断对错，score 为 0 或 100
- 代码题：根据代码质量综合打分，codeReview 给出四维评价
- feedback 必须详细说明为什么对/错，涉及哪个知识点
- 只输出 JSON`;

export const generatePractice = async ({
  language,
  mode,
  topics,
  difficulty,
  sourcesContent,
}) => {
  const mathMode = isMathRelated(language, ...(topics ?? []));
  const promptMap = {
    focused: FOCUSED_SYSTEM_PROMPT,
    comprehensive: COMPREHENSIVE_SYSTEM_PROMPT,
    project: PROJECT_SYSTEM_PROMPT,
  };

  let userMsg = `${mathMode ? "学科" : "编程语言"}：${language}\n`;
  if (mathMode) {
    userMsg += `涉及知识点：${topics.join("、")}\n`;
    userMsg += `请生成适合数学学科的练习题，允许使用 Markdown + LaTeX 公式语法。\n`;
    if (needsMathFoundation(language, ...(topics ?? []))) {
      userMsg += `如果主题与人工智能相关，请覆盖线性代数、微积分、概率统计、最优化等必要数学基础。\n`;
    }
  } else if (mode === "focused") {
    userMsg += `涉及知识点：${topics.join("、")}\n`;
    if (difficulty) {
      userMsg += `难度要求：${difficulty} 星（1=简单，2=中等，3=困难）\n`;
    } else {
      userMsg += `难度要求：由 AI 根据知识点的复杂度自行评定每题难度（1~3 星），在每题 difficulty 字段中标注。\n`;
    }
    userMsg += `请生成 5 道左右的专项练习题（含 1~2 道代码实操题），题型多样化（选择题、填空题、代码题混合）。\n`;
  } else if (mode === "comprehensive") {
    userMsg += `用户已学知识点：${topics.join("、")}\n`;
    userMsg += `请 AI 自行根据学习进度选择知识点组合，生成 3~5 道综合练习题（含 1~2 道代码实操题）。\n`;
    userMsg += `难度由 AI 根据知识掌握情况自行决定。\n`;
  } else if (mode === "project") {
    userMsg += `涉及学科/项目：${topics.join("、")}\n`;
    userMsg += `难度要求：${difficulty} 星\n`;
    userMsg += `请生成 1 道综合性代码实操项目挑战题。\n`;
  }

  if (sourcesContent) {
    userMsg += `\n## 以下是用户学习时的参考资料，请严格基于这些资料的内容出题：\n${sourcesContent}\n`;
  }

  userMsg += mathMode
    ? `\n每道题必须表意完整、自包含；如涉及公式，请用 LaTeX 语法输出。`
    : `\n确保使用 ${language} 最新语法和 API。每道题必须表意完整、自包含。`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: mathMode
            ? MATH_PRACTICE_SYSTEM_PROMPT
            : promptMap[mode] || FOCUSED_SYSTEM_PROMPT,
        },
        { role: "user", content: userMsg },
      ],
      temperature: 0.7,
      max_tokens: 6000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseJsonResponse(text);
  } catch (err) {
    logger.error("AI 练习题生成失败", { err: err.message, mode });
    throw err;
  }
};

export const gradePracticeAnswer = async ({
  language,
  problemType,
  problemDescription,
  correctAnswer,
  userAnswer,
}) => {
  try {
    const mathMode = isMathRelated(
      language,
      problemDescription,
      correctAnswer,
      userAnswer,
    );
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: mathMode
            ? `${GRADE_SYSTEM_PROMPT}\n\n补充规则：\n- 如果题目属于数学题，请允许等价公式、等价变形、同义表达\n- feedback 中必须指出公式依据、关键推导或解题思路\n- 如涉及 LaTeX 公式，请使用 Markdown + LaTeX 语法输出`
            : GRADE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `${mathMode ? "学科" : "编程语言"}：${language}
题目类型：${problemType}
题目描述：${problemDescription}
正确答案/参考代码：${correctAnswer}
用户提交的答案：${userAnswer}

请批改并输出 JSON。`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseJsonResponse(text);
  } catch (err) {
    logger.error("AI 批改失败", { err: err.message });
    throw err;
  }
};

export const reviewCode = async (language, code, exerciseTitle) => {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: CODE_REVIEW_SYSTEM_PROMPT },
        {
          role: "user",
          content: `技术/编程语言：${language}\n练习题：${exerciseTitle}\n\n学生代码：\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseJsonResponse(text);
  } catch (err) {
    logger.error("AI 代码评价失败", { err: err.message });
    throw err;
  }
};
