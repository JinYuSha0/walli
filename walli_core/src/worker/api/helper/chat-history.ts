/** Convert stored model messages into visible chat history without exposing tool internals. */
export const toWebHistoryMessage = (message: { id: string; content: string }) => {
  try {
    const parsed: unknown = JSON.parse(message.content);
    if (typeof parsed !== "object" || parsed === null) return undefined;

    const { role, content } = parsed as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return undefined;

    const markdown = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.flatMap((part: unknown) => {
            if (typeof part !== "object" || part === null) return [];
            const { type, text } = part as { type?: unknown; text?: unknown };
            return type === "text" && typeof text === "string" ? [text] : [];
          }).join("\n\n")
        : "";

    if (!markdown.trim()) return undefined;
    return { id: message.id, role, markdown };
  } catch {
    return undefined;
  }
};
