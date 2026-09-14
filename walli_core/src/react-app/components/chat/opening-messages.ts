import type { WalliChatMessage } from "@wallilabs/chat/react";

export const OPENING_MESSAGE_PREFIX = "opening:";

export function createOpeningMessages(
  markdown: string,
  meta?: { nickname: string; avatarUrl: string },
): WalliChatMessage[] {
  const messages: WalliChatMessage[] = [];
  const lines = markdown.split("\n");
  let assistantLines: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  const append = (content: string, role: "assistant" | "system") => {
    if (!content.trim()) return;
    messages.push({
      id: `${OPENING_MESSAGE_PREFIX}${messages.length}`,
      role,
      markdown: content.trim(),
      showActions: false,
      ...(role === "assistant" && meta ? { meta } : {}),
    });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (delimiter) {
      const marker = delimiter[1][0];
      if (!fence) fence = { marker, length: delimiter[1].length };
      else if (marker === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined;
      assistantLines.push(line);
      continue;
    }
    const isSystem = /^:::system[ \t]*$/.test(line);
    if (!fence && (isSystem || /^:::notice(?:[ \t]+(?:info|success|error))?[ \t]*$/.test(line))) {
      const end = lines.findIndex((candidate, candidateIndex) => candidateIndex > index && /^:::[ \t]*$/.test(candidate));
      if (end !== -1) {
        append(assistantLines.join("\n"), "assistant");
        assistantLines = [];
        append((isSystem ? lines.slice(index + 1, end) : lines.slice(index, end + 1)).join("\n"), "system");
        index = end;
        continue;
      }
    }
    assistantLines.push(line);
  }
  append(assistantLines.join("\n"), "assistant");
  return messages;
}

export function getAssistantMeta(settings: {
  assistantIdentityEnabled: boolean;
  assistantNickname: string;
  assistantAvatar: string;
}) {
  return settings.assistantIdentityEnabled && settings.assistantNickname.trim()
    ? { nickname: settings.assistantNickname, avatarUrl: settings.assistantAvatar }
    : undefined;
}
