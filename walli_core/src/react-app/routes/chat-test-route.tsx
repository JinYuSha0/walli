import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  WalliChat,
  WalliChatComposer,
  WalliChatTrashIcon,
  type WalliChatComposerTranscriptionContext,
  type WalliChatComposerUploadImagesCallback,
  type WalliChatMessage,
  type WalliChatRef,
  type WalliChatStreamingHandle,
} from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";
import { authClient } from "@/auth-client";
import { deleteChatSession, getChatHistory, transcribeAudio, uploadAsset } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChatTestRoute() {
  const { t } = useTranslation();
  const session = authClient.useSession();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<readonly WalliChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const chatRef = useRef<WalliChatRef>(null);
  const historyCursorRef = useRef<number | null>(null);
  const historyLoadingRef = useRef(false);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const streamingHandleRef = useRef<WalliChatStreamingHandle | null>(null);
  const currentUserId = session.data?.user.id ?? "";
  const trimmedUserId = currentUserId.trim();

  useEffect(() => {
    setMessages([]);
    historyCursorRef.current = null;
    historyLoadingRef.current = false;
    setIsLoadingHistory(Boolean(trimmedUserId));
    if (!trimmedUserId) return;

    const abortController = new AbortController();
    const startRequest = window.setTimeout(() => {
      historyLoadingRef.current = true;
      void getChatHistory(trimmedUserId, undefined, 30, abortController.signal)
        .then((page) => {
          setMessages(page.messages);
          historyCursorRef.current = page.nextCursor;
        })
        .catch((cause) => {
          if (!abortController.signal.aborted) console.error(cause);
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            historyLoadingRef.current = false;
            setIsLoadingHistory(false);
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(startRequest);
      abortController.abort();
    };
  }, [trimmedUserId]);

  const handleLoadOlder = useCallback(async () => {
    const cursor = historyCursorRef.current;
    if (cursor === null || historyLoadingRef.current) return;

    historyLoadingRef.current = true;
    try {
      const page = await getChatHistory(trimmedUserId, cursor);
      if (page.messages.length > 0) {
        chatRef.current?.insertMessagesAtTop(page.messages, { stick: true });
      }
      historyCursorRef.current = page.nextCursor;
    } catch (cause) {
      console.error(cause);
    } finally {
      historyLoadingRef.current = false;
    }
  }, [trimmedUserId]);

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
    chatRef.current?.insertMessagesAtBottom([userMessage], { stick: true });

    const abortController = new AbortController();
    requestAbortControllerRef.current = abortController;

    try {
      const responseBody = fetch("/api/internal/chat", {
        body: JSON.stringify({
          messages: [{ content: userMessage.markdown, role: userMessage.role }],
          sessionId: trimmedUserId,
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
        bottomPaddingHeight: ((chatRef.current?.element?.clientHeight ?? 720) * 2) / 3,
        messageId: crypto.randomUUID(),
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

  const clearChat = async () => {
    historyLoadingRef.current = true;
    setIsLoadingHistory(true);
    try {
      await deleteChatSession(trimmedUserId);
      setMessages([]);
      historyCursorRef.current = null;
      const page = await getChatHistory(trimmedUserId);
      setMessages(page.messages);
      historyCursorRef.current = page.nextCursor;
      toast.success(t("chatTestClearSuccess"));
    } catch (cause) {
      console.error(cause);
      toast.error(cause instanceof Error ? cause.message : t("chatTestClearError"));
    } finally {
      historyLoadingRef.current = false;
      setIsLoadingHistory(false);
    }
  };

  const handleClearChat = () => {
    if (!trimmedUserId) return;
    setClearConfirmOpen(true);
  };

  const handleUploadImages: WalliChatComposerUploadImagesCallback = async (
    files,
    setProgress,
    setResult,
  ) => {
    await Promise.all(
      files.map(async (file) => {
        try {
          const asset = await uploadAsset(file, (progress) => setProgress(file, progress));
          setResult(file, { url: asset.url });
        } catch (cause) {
          setResult(file, {
            error: cause instanceof Error ? cause : new Error("Upload failed"),
          });
        }
      }),
    );
  };

  const handleTranscribe = async ({ finished, signal }: WalliChatComposerTranscriptionContext) => {
    const { audio } = await finished;
    try {
      return await transcribeAudio(audio, signal);
    } catch (error) {
      if (!signal.aborted) {
        toast.error(error instanceof Error ? error.message : t("chatTestTranscriptionError"));
      }
      throw error;
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <WalliChat
        className="block h-full w-full"
        loading={isLoadingHistory}
        messages={messages}
        onEndReached={handleLoadOlder}
        onEndReachedThreshold={0.2}
        intervalSeconds={60 * 5}
        ref={chatRef}
      >
        <WalliChatComposer
          disabled={!trimmedUserId || isLoadingHistory}
          menuItems={[
            { icon: WalliChatTrashIcon, onClick: handleClearChat, title: t("chatTestClear") },
          ]}
          onCancel={handleStop}
          onSubmit={handleSubmit}
          onTranscribe={handleTranscribe}
          onUploadImages={handleUploadImages}
          onValueChange={setInput}
          placeholder={t("chatTestInputPlaceholder")}
          slot="composer"
          transcribingText={t("chatTestTranscribing")}
          uploadImagesTitle={t("chatTestUploadImages")}
          value={input}
        />
      </WalliChat>
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("chatTestClear")}</DialogTitle>
            <DialogDescription>{t("chatTestClearConfirm")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>
              {t("chatTestClearCancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setClearConfirmOpen(false);
                void clearChat();
              }}
            >
              {t("chatTestClearAction")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
