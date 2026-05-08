export const getSessionDisplayTitle = (session) =>
  String(
    session?.displayTitle || session?.title || session?.language || "学习之旅",
  ).trim();

export const getSessionDisplaySubtitle = (session) =>
  String(session?.displaySubtitle || session?.intent || "").trim();
