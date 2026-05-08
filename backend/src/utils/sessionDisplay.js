const splitKeywords = (value) =>
  String(value ?? "")
    .split(/[·•,，/|、\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);

const truncate = (value, maxLength) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

const normalizeSubtitle = (value, fallbackItems = []) => {
  const directItems = splitKeywords(value);
  if (directItems.length > 0) {
    return directItems
      .slice(0, 3)
      .map((item) => truncate(item, 12))
      .join(" · ");
  }

  const fallback = fallbackItems
    .flatMap((item) => splitKeywords(item))
    .slice(0, 3)
    .map((item) => truncate(item, 12));

  return fallback.join(" · ");
};

export const buildSessionDisplay = ({ language, title, intent, metadata }) => {
  const normalizedTitle = String(title ?? "").trim();
  const normalizedLanguage = String(language ?? "").trim();
  const prefersCustomTitle =
    normalizedTitle &&
    normalizedLanguage &&
    normalizedTitle.toLowerCase() !== normalizedLanguage.toLowerCase();

  const displayTitle =
    truncate(prefersCustomTitle ? normalizedTitle : "", 24) ||
    truncate(metadata?.displayTitle, 24) ||
    truncate(title, 24) ||
    truncate(language, 24) ||
    "学习之旅";

  const displaySubtitle =
    normalizeSubtitle(metadata?.displaySubtitle, metadata?.useCases ?? []) ||
    normalizeSubtitle(metadata?.useCases?.join(" · ")) ||
    truncate(intent, 24) ||
    "从基础到实践";

  return { displayTitle, displaySubtitle };
};

export const attachSessionDisplay = (session, metadata = null) => ({
  ...session,
  ...buildSessionDisplay({
    language: session?.language,
    title: session?.title,
    intent: session?.intent,
    metadata,
  }),
});
