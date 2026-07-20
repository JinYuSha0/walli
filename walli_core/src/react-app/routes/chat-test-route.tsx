import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { Send, Square, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ChatRole = "system" | "user" | "assistant";

const getMessageText = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

const toChatApiMessages = (messages: UIMessage[]) =>
  messages
    .map((message) => ({
      role: message.role as ChatRole,
      content: getMessageText(message).trim(),
    }))
    .filter((message) => message.content.length > 0);

const parseSseBlock = (block: string) => {
  let event = "message";
  const dataLines: string[] = [];

  block.split("\n").forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      return;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  });

  return {
    event,
    data: dataLines.join("\n"),
  };
};

const createSseToTextFetch =
  (): typeof fetch =>
  async (input, init) => {
    const response = await fetch(input, init);

    if (!response.ok || !response.body) {
      return response;
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = response.body?.getReader();

        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";

        const processBlock = (block: string) => {
          const { event, data } = parseSseBlock(block);

          if (event === "delta") {
            const payload = JSON.parse(data) as { text?: unknown };

            if (typeof payload.text === "string") {
              controller.enqueue(encoder.encode(payload.text));
            }
            return;
          }

          if (event === "error") {
            const payload = JSON.parse(data) as { error?: { message?: unknown } };
            controller.error(
              new Error(
                typeof payload.error?.message === "string"
                  ? payload.error.message
                  : "Chat stream failed",
              ),
            );
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (buffer.includes("\n\n")) {
              const separatorIndex = buffer.indexOf("\n\n");
              const block = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);

              if (block.trim().length > 0) {
                processBlock(block);
              }
            }
          }

          buffer += decoder.decode();

          if (buffer.trim().length > 0) {
            processBlock(buffer);
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  };

export function ChatTestRoute() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [appId, setAppId] = useState("");
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState("");
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        fetch: createSseToTextFetch(),
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            appId: appId.trim() || undefined,
            userId: userId.trim() || undefined,
            token: token.trim() || undefined,
            messages: toChatApiMessages(messages),
          },
        }),
      }),
    [appId, token, userId],
  );
  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    transport,
  });
  const isRunning = status === "submitted" || status === "streaming";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();

    if (!text || isRunning) {
      return;
    }

    setInput("");
    void sendMessage({ text });
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
          <div className="min-h-0 overflow-auto rounded-md border bg-muted/20 p-3">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                {t("chatTestEmpty")}
              </div>
            ) : (
              <div className="grid gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[80%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "mr-auto max-w-[80%] whitespace-pre-wrap rounded-md border bg-background px-3 py-2 text-sm"
                    }
                  >
                    {getMessageText(message)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form className="grid gap-2" onSubmit={handleSubmit}>
            {error && (
              <p className="text-sm text-destructive">
                {error.message || t("chatTestError")}
              </p>
            )}
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning}
                placeholder={t("chatTestAppIdPlaceholder")}
                value={appId}
                onChange={(event) => setAppId(event.target.value)}
              />
              <input
                className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning}
                placeholder={t("chatTestUserIdPlaceholder")}
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
              />
              <input
                className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning}
                placeholder={t("chatTestTokenPlaceholder")}
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <textarea
                className="min-h-16 resize-none rounded-md border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning}
                placeholder={t("chatTestInputPlaceholder")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              {isRunning ? (
                <Button type="button" variant="outline" onClick={() => void stop()}>
                  <Square />
                  {t("chatTestStop")}
                </Button>
              ) : (
                <Button type="submit" disabled={input.trim().length === 0}>
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
