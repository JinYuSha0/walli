import { Send, Square, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  WalliChat,
  type WalliChatMessage,
  type WalliChatRef,
  type WalliChatStreamingHandle,
} from "walli_chat/react";
import "walli_chat/theme.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/auth-client";

export function ChatTestRoute() {
  const { t } = useTranslation();
  const session = authClient.useSession();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<readonly WalliChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const chatRef = useRef<WalliChatRef>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const streamingHandleRef = useRef<WalliChatStreamingHandle | null>(null);
  const currentUserId = session.data?.user.id ?? "";
  const trimmedUserId = currentUserId.trim();

  const syncMessagesFromChat = () => {
    const nextMessages = chatRef.current?.element?.messages;
    if (nextMessages) setMessages(nextMessages.map((message) => ({ ...message })));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();

    if (!text || !trimmedUserId || isRunning) {
      return;
    }

    setInput("");
    setError(null);
    setIsRunning(true);

    const userMessage: WalliChatMessage = {
      id: crypto.randomUUID(),
      markdown: text,
      role: "user",
    };
    const requestMessages = [...messages, userMessage];
    chatRef.current?.insertMessagesAtBottom([userMessage]);
    setMessages(requestMessages);

    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/internal/chat", {
        body: JSON.stringify({
          messages: requestMessages.map((message) => ({
            content: message.markdown,
            role: message.role,
          })),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => undefined)) as
          { error?: unknown } | undefined;
        throw new Error(
          typeof payload?.error === "string" ? payload.error : `Chat failed (${response.status})`,
        );
      }
      if (!response.body) throw new Error("Chat response did not include a stream");

      const streamingHandle = chatRef.current?.insertStreamingMessageAtBottom(response.body, {
        messageId: crypto.randomUUID(),
        stickToBottom: true,
      });
      if (!streamingHandle) throw new Error("Walli Chat is not mounted");

      streamingHandleRef.current = streamingHandle;
      await streamingHandle.finished;
    } catch (cause) {
      if (!abortController.signal.aborted) {
        setError(cause instanceof Error ? cause : new Error("Chat failed"));
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

  return (
    <div className="grid h-full min-h-[calc(100svh-var(--header-height))] grid-rows-[auto_1fr] gap-4 p-4 lg:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t("chatTestTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("chatTestDescription")}</p>
      </div>

      <Card className="min-h-0 overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>{t("chatTestPanelTitle")}</CardTitle>
          <CardDescription>{t("chatTestPanelDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-4 p-4">
          <div className="relative min-h-0 overflow-hidden rounded-md border bg-muted/20">
            {messages.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
                {t("chatTestEmpty")}
              </div>
            )}
            <WalliChat className="h-full" messages={messages} ref={chatRef} />
          </div>

          <form className="grid gap-2" onSubmit={handleSubmit}>
            {error && (
              <p className="text-sm text-destructive">{error.message || t("chatTestError")}</p>
            )}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <textarea
                className="min-h-16 resize-none rounded-md border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning}
                placeholder={t("chatTestInputPlaceholder")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              {isRunning ? (
                <Button type="button" variant="outline" onClick={handleStop}>
                  <Square />
                  {t("chatTestStop")}
                </Button>
              ) : (
                <Button type="submit" disabled={input.trim().length === 0 || !trimmedUserId}>
                  <Send />
                  {t("chatTestSend")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isRunning || messages.length === 0}
                onClick={() => setMessages([])}
              >
                <Trash2 />
                {t("chatTestClear")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
