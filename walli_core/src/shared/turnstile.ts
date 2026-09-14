export function webChatTurnstileAction(method: string, path: string): string | undefined {
  if (method === "POST" && path === "/sessions") return "chat_session";
  if (method === "POST" && /^\/sessions\/[^/]+\/messages$/.test(path)) return "chat_message";
  if (method === "POST" && path === "/image") return "chat_image";
  if (method === "POST" && path === "/transcribe") return "chat_transcribe";
  if (method === "DELETE" && /^\/sessions\/[^/]+$/.test(path)) return "chat_delete";
}
