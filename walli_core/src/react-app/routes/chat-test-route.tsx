import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatComposerUploadImagesCallback,
  type WalliChatMessage,
  type WalliChatRef,
  type WalliChatStreamingHandle,
} from "walli_chat/react";
import "walli_chat/theme.css";
import { authClient } from "@/auth-client";
import { uploadAsset } from "@/api";

export function ChatTestRoute() {
  const { t } = useTranslation();
  const session = authClient.useSession();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<readonly WalliChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const chatRef = useRef<WalliChatRef>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const streamingHandleRef = useRef<WalliChatStreamingHandle | null>(null);
  const currentUserId = session.data?.user.id ?? "";
  const trimmedUserId = currentUserId.trim();

  const syncMessagesFromChat = () => {
    const nextMessages = chatRef.current?.element?.messages;
    if (nextMessages) setMessages(nextMessages.map((message) => ({ ...message })));
  };

  const handleSubmit = async (markdown: string) => {
    if (!markdown || !trimmedUserId || isRunning) {
      return;
    }

    setInput("");
    setIsRunning(true);

    const userMessage: WalliChatMessage = {
      id: crypto.randomUUID(),
      markdown,
      role: "user",
    };
    const requestMessages = [...messages, userMessage];
    chatRef.current?.insertMessagesAtBottom([userMessage]);

    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;

    try {
      const responseBody = fetch("/api/internal/chat", {
        body: JSON.stringify({
          messages: requestMessages.map((message) => ({
            content: message.markdown,
            role: message.role,
          })),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      }).then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => undefined)) as
            { error?: unknown } | undefined;
          throw new Error(
            typeof payload?.error === "string" ? payload.error : `Chat failed (${response.status})`,
          );
        }
        if (!response.body) throw new Error("Chat response did not include a stream");
        return response.body;
      });

      const streamingHandle = chatRef.current?.insertStreamingMessageAtBottom(responseBody, {
        messageId: crypto.randomUUID(),
        stickToBottom: true,
      });
      if (!streamingHandle) throw new Error("Walli Chat is not mounted");

      streamingHandleRef.current = streamingHandle;
      await streamingHandle.finished;
    } catch (cause) {
      if (!abortController.signal.aborted) {
        console.error(cause instanceof Error ? cause : new Error("Chat failed"));
      }
    } finally {
      syncMessagesFromChat();
      requestAbortControllerRef.current = null;
      streamingHandleRef.current = null;
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    requestAbortControllerRef.current?.abort();
    streamingHandleRef.current?.abort();
  };

  const handleUploadImages: WalliChatComposerUploadImagesCallback = async (
    files,
    setProgress,
    setResult,
  ) => {
    await Promise.all(
      files.map(async (file) => {
        try {
          const asset = await uploadAsset(file);
          setProgress(file, 100);
          setResult(file, { url: asset.url });
        } catch (cause) {
          setResult(file, {
            error: cause instanceof Error ? cause : new Error("Upload failed"),
          });
        }
      }),
    );
  };

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <WalliChat className="block h-full w-full" messages={messages} ref={chatRef}>
        <WalliChatComposer
          disabled={!trimmedUserId}
          onCancel={handleStop}
          onSubmit={handleSubmit}
          onUploadImages={handleUploadImages}
          onValueChange={setInput}
          placeholder={t("chatTestInputPlaceholder")}
          slot="composer"
          uploadImagesTitle={t("chatTestUploadImages")}
          value={input}
        />
      </WalliChat>
    </div>
  );
}
