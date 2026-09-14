type PendingQuestion = { markdown: string; sessionId?: string; autoSend: boolean };
const key = (slug: string) => `walli-chat-question:${slug}`;
export function readPendingQuestion(slug: string): PendingQuestion | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(slug)) || "null");
    if (value && typeof value.markdown === "string" && typeof value.autoSend === "boolean" &&
      (value.sessionId === undefined || typeof value.sessionId === "string")) return value;
  } catch { /* No saved question. */ }
}
export function savePendingQuestion(slug: string, question: PendingQuestion) {
  sessionStorage.setItem(key(slug), JSON.stringify(question));
}
export function clearPendingQuestion(slug: string) {
  sessionStorage.removeItem(key(slug));
}
