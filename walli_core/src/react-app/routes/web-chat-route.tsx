import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createWebChatStore, createConversationStore, type WebChatStore } from "@/stores/web-chat-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTurnstileChallenge } from "@/components/chat/turnstile-challenge";
import { readPendingQuestion, savePendingQuestion, clearPendingQuestion } from "@/components/chat/pending-question";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { authClient } from "@/auth-client";
import {
  createOpeningMessages,
  getAssistantMeta,
  OPENING_MESSAGE_PREFIX,
} from "@/components/chat/opening-messages";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PanelLeft, SquarePen } from "lucide-react";
import { WebChatSidebar, WebChatThemeToggle, WebChatUserMenu } from "@/components/chat/web-chat-sidebar";
import "@/components/chat/web-chat.css";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  WalliChat,
  WalliChatComposer,
  type WalliChatMessage,
  type WalliChatRef,
  type WalliChatStreamingHandle,
  type WalliChatComposerUploadImagesCallback,
  type WalliChatComposerTranscriptionContext,
} from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";
import "@/components/chat/blocks";
import {
  WebChatError,
  webChatJson,
  type WebSessionsPage,
  webChatRequest,
  type WebChatConfig,
  type WebCredentials,
  type WebHistory,
  type WebSession,
} from "@/components/chat/web-chat-api";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  webChatConfigQuery,
  webChatSessionsQuery,
  webChatHistoryQuery,
} from "@/components/chat/web-chat-queries";
import { WebChatLoading } from "@/components/chat/web-chat-loading";

export function WebChatRoute() {
  const { slug, sessionId } = useParams({ strict: false });
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const viewport = window.visualViewport;
    const scrollY = window.scrollY;
    let frame = 0;
    const update = () => {
      if (viewport && viewport.scale !== 1) return;
      element.style.height = `${viewport?.height ?? window.innerHeight}px`;
      element.style.top = `${viewport?.offsetTop ?? 0}px`;
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    document.documentElement.classList.add("web-chat-page");
    update();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      document.documentElement.classList.remove("web-chat-page");
      window.scrollTo(0, scrollY);
    };
  }, []);
  if (!slug) return null;
  return (
    <div ref={viewportRef} className="fixed inset-x-0 top-0 h-dvh overflow-hidden">
      <WebChatPage key={slug} slug={slug} sessionId={sessionId} />
      <Toaster />
    </div>
  );
}

function WebChatPage({ slug, sessionId }: { slug: string; sessionId?: string }) {
  const { t } = useTranslation();
  const config = useQuery(webChatConfigQuery(slug));
  const [pageStore] = useState(createWebChatStore);
  const loginOpen = useStore(pageStore, (state) => state.loginOpen);
  const { setLoginOpen } = pageStore.getState();
  const botCheck = useTurnstileChallenge(config.data?.turnstileSiteKey, config.data?.id);
  const queryClient = useQueryClient();
  useEffect(() => {
    const refreshAccess = () => { void queryClient.invalidateQueries({ queryKey: ["web-chat-config", slug] }); };
    window.addEventListener("walli-chat-access-changed", refreshAccess);
    return () => window.removeEventListener("walli-chat-access-changed", refreshAccess);
  }, [queryClient, slug]);
  const auth = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.social({
        provider: "google", callbackURL: window.location.href,
        errorCallbackURL: window.location.href,
      });
      if (result.error) throw new Error(result.error.message);
    },
    onError: () => toast.error(t("webChatAuthFailed")),
  });
  if (config.isPending) return <WebChatLoading />;
  if (config.isError)
    return (
      <div className="grid h-full place-items-center p-6">
        <p role="alert">{t("webChatUnavailable")}</p>
      </div>
    );
  const credentials = config.data.userId ? { userId: config.data.userId, token: "", verifyBot: config.data.turnstileEnabled ? botCheck.verify : undefined } : undefined;
  return <>
    {botCheck.dialog}
    <WebChatSessions key={config.data.userId ?? "guest"} config={config.data} credentials={credentials} selectedId={sessionId}
      pageStore={pageStore} />
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("webLoginGoogleButton")}</DialogTitle>
          <DialogDescription>{t("webLoginContinueQuestion")}</DialogDescription>
        </DialogHeader>
        <Button disabled={auth.isPending} onClick={() => auth.mutate()}>{t("webLoginGoogleButton")}</Button>
      </DialogContent>
    </Dialog>
  </>;
}

function WebChatSessions({
  config,
  credentials,
  selectedId: requestedId,
  pageStore,
}: {
  config: WebChatConfig;
  credentials?: WebCredentials;
  selectedId?: string;
  pageStore: WebChatStore;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const needsLogin = config.loginMethod === "google" && !config.authenticated;
  const selectedId = needsLogin ? undefined : requestedId;
  const signOut = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      clearPendingQuestion(config.slug);
      await queryClient.cancelQueries({ predicate: (query) =>
        ["web-chat-sessions", "web-chat-history"].includes(String(query.queryKey[0])) });
      queryClient.setQueryData<WebChatConfig>(["web-chat-config", config.slug], {
        ...config, authenticated: false, userId: undefined, userName: undefined, userImage: undefined,
      });
      queryClient.removeQueries({ predicate: (query) =>
        ["web-chat-sessions", "web-chat-history"].includes(String(query.queryKey[0])) });
      await navigate({ to: "/chat/$slug", params: { slug: config.slug }, replace: true });
      await queryClient.invalidateQueries({ queryKey: ["web-chat-config", config.slug] });
    },
    onError: () => toast.error(t("webChatRequestFailed")),
  });
  const { sidebarOpen, sidebarCollapsed, running, draftVersion, createdSessionId } = useStore(pageStore, useShallow(
    (state) => ({
      sidebarOpen: state.sidebarOpen, sidebarCollapsed: state.sidebarCollapsed,
      running: state.running, draftVersion: state.draftVersion, createdSessionId: state.createdSessionId,
    }),
  ));
  const { setSidebarOpen, setSidebarCollapsed } = pageStore.getState();
  const queryKey = useMemo(
    () => ["web-chat-sessions", config.id, credentials?.userId ?? "visitor"],
    [config.id, credentials?.userId],
  );
  const sessions = useInfiniteQuery({ ...webChatSessionsQuery(config, credentials), enabled: !needsLogin });
  const rows = useMemo(() => {
    const unique = new Map<string, WebSession>();
    for (const page of sessions.data?.pages ?? []) {
      for (const session of page.sessions) unique.set(session.id, session);
    }
    return [...unique.values()];
  }, [sessions.data]);
  const selectSession = useCallback(
    (id?: string, replace = false) => {
      setSidebarOpen(false);
      if (id) {
        return navigate({
          to: "/chat/$slug/$sessionId",
          params: { slug: config.slug, sessionId: id },
          replace,
        });
      } else {
        return navigate({ to: "/chat/$slug", params: { slug: config.slug }, replace });
      }
    },
    [navigate, config.slug, setSidebarOpen],
  );
  const firstId = rows[0]?.id;
  useEffect(() => {
    if (!config.multiSession && !selectedId && firstId && !readPendingQuestion(config.slug)) {
      void navigate({
        to: "/chat/$slug/$sessionId",
        params: { slug: config.slug, sessionId: firstId },
        replace: true,
      });
    }
  }, [selectedId, firstId, navigate, config.slug, config.multiSession]);
  // One owner for history; both the sidebar and conversation use this result.
  const selectedHistory = useQuery(webChatHistoryQuery(config, selectedId, credentials));
  const linkedSession = selectedHistory.data?.session;
  const onSessionCreated = async (session: WebSession) => {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<InfiniteData<WebSessionsPage>>(queryKey, (current) => ({
      pages: current?.pages.length
        ? current.pages.map((page, index) => ({
            ...page,
            sessions: [
              ...(index === 0 ? [session] : []),
              ...page.sessions.filter(({ id }) => id !== session.id),
            ],
          }))
        : [{ sessions: [session], nextCursor: null }],
      pageParams: current?.pageParams ?? [null],
    }));
    pageStore.getState().setCreatedSessionId(session.id);
    await selectSession(session.id, true);
  };
  const startDraft = () => {
    pageStore.getState().startDraft();
    void selectSession();
  };
  const deleteSession = useMutation({
    mutationFn: (id: string) =>
      webChatRequest(config.slug, `/sessions/${encodeURIComponent(id)}`, credentials, {
        method: "DELETE",
      }),
    onSuccess: async (_, id) => {
      if (selectedId === id) {
        const nextId = rows.find((session) => session.id !== id)?.id;
        if (nextId) {
          // Keep the current view mounted until the replacement is ready.
          await queryClient.prefetchQuery(webChatHistoryQuery(config, nextId, credentials));
        }
        if (nextId) await selectSession(nextId, true);
      }
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<InfiniteData<WebSessionsPage>>(
        queryKey,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              sessions: page.sessions.filter((session) => session.id !== id),
            })),
          },
      );
      if (selectedId === id && !rows.some((session) => session.id !== id)) {
        await selectSession(undefined, true);
      }
      // Never clear a history query while its conversation is still mounted.
      queryClient.removeQueries({
        queryKey: ["web-chat-history", config.id, credentials?.userId, id],
        exact: true,
        type: "inactive",
      });
      // Cursor pagination stays valid after removal; no full-list reload is needed.
      await queryClient.invalidateQueries({ queryKey, refetchType: "none" });
    },
    onError: () => toast.error(t("webChatRequestFailed")),
  });
  const sidebarRows =
    linkedSession &&
    !(deleteSession.isPending && deleteSession.variables === linkedSession.id) &&
    !rows.some(({ id }) => id === linkedSession.id)
      ? [linkedSession, ...rows]
      : rows;
  const onSent = useCallback(
    (text: string) => {
      queryClient.setQueryData<InfiniteData<WebSessionsPage>>(
        queryKey,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              sessions: page.sessions.map((session) =>
                session.id === selectedId && !session.title
                  ? { ...session, title: text.slice(0, 50) }
                  : session,
              ),
            })),
          },
      );
    },
    [queryClient, queryKey, selectedId],
  );
  const disabled = running || deleteSession.isPending;
  const sidebar = (
    <WebChatSidebar
      onCollapse={() => setSidebarCollapsed(true)}
      onSignOut={() => signOut.mutate()}
      signingOut={signOut.isPending}
      config={config}
      sessions={sidebarRows}
      selectedId={selectedId}
      disabled={disabled}
      canCreate={config.multiSession || !rows.length}
      isPending={!needsLogin && sessions.isPending}
      isError={sessions.isError}
      hasNextPage={sessions.hasNextPage}
      isFetching={sessions.isFetching}
      onSelect={selectSession}
      onCreate={startDraft}
      onDelete={(id) => deleteSession.mutate(id)}
      onLoadMore={() => void sessions.fetchNextPage({ cancelRefetch: false })}
      onRetry={() => void sessions.refetch()}
    />
  );
  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background text-foreground">
      <aside
        className="web-chat-sidebar hidden shrink-0 bg-muted/40 md:block"
        data-collapsed={sidebarCollapsed}
        aria-label={t("webChatSessions")}
      >
        <div
          id="web-chat-desktop-sidebar"
          className="web-chat-sidebar-content h-full min-h-0"
          inert={sidebarCollapsed}
          aria-hidden={sidebarCollapsed}
        >
          {sidebar}
        </div>
        <div
          className="web-chat-sidebar-rail flex h-full flex-col items-center justify-between py-4"
          inert={!sidebarCollapsed}
          aria-hidden={!sidebarCollapsed}
        >
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(false)}
              aria-label={t("webChatOpenSidebar")}
              title={t("webChatOpenSidebar")}
              aria-expanded={false}
              aria-controls="web-chat-desktop-sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
            {(config.multiSession || !rows.length) && (
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={startDraft}
                aria-label={t("webChatNewSession")}
                title={t("webChatNewSession")}
              >
                <SquarePen className="size-4" />
              </Button>
            )}
          </div>
          <WebChatUserMenu config={config} collapsed disabled={disabled || signOut.isPending} onSignOut={() => signOut.mutate()} />
        </div>
      </aside>
      <div className="absolute right-3 top-3 z-20">
        <WebChatThemeToggle />
      </div>
      <main className="web-chat-main relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="absolute top-3 left-3 z-10 md:hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full border border-border/40 bg-background/60 shadow-sm backdrop-blur-md hover:bg-background/80" aria-label={t("webChatOpenSidebar")}>
                <PanelLeft className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0" aria-describedby={undefined}>
              <SheetTitle className="sr-only">{t("webChatSessions")}</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
        </div>
        <Conversation
          key={selectedId && selectedId !== createdSessionId ? selectedId : `draft-${draftVersion}`}
          history={selectedHistory}
          pageStore={pageStore}
          requestedSessionId={requestedId}
          config={config}
          sessionId={selectedId}
          credentials={credentials}
          onSent={onSent}
          onSessionCreated={onSessionCreated}
        />
      </main>
    </div>
  );
}

function openingMessages(config: WebChatConfig): WalliChatMessage[] {
  return createOpeningMessages(
    config.dialogSettings.dialogOpeningMessage,
    getAssistantMeta(config.dialogSettings),
  );
}

function Conversation({
  history,
  config,
  sessionId,
  credentials,
  onSent,
  onSessionCreated,
  pageStore,
  requestedSessionId,
}: {
  history: UseQueryResult<WebHistory, Error>;
  config: WebChatConfig;
  sessionId?: string;
  credentials?: WebCredentials;
  onSent: (text: string) => void;
  onSessionCreated: (session: WebSession) => Promise<void>;
  pageStore: WebChatStore;
  requestedSessionId?: string;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [conversationStore] = useState(() => {
    const pending = readPendingQuestion(config.slug);
    const rows = history.data?.messages.map((message) =>
      message.role === "assistant"
        ? { ...message, meta: getAssistantMeta(config.dialogSettings) }
        : message,
    );
    return createConversationStore({
      input: pending?.sessionId === requestedSessionId ? pending?.markdown ?? "" : "",
      messages: rows
        ? history.data?.nextCursor === null ? [...openingMessages(config), ...rows] : rows
        : sessionId ? [] : openingMessages(config),
      cursor: history.data?.nextCursor ?? null,
    });
  });
  const { input, messages, loadingOlder } = useStore(conversationStore, useShallow(
    (state) => ({ input: state.input, messages: state.messages, loadingOlder: state.loadingOlder }),
  ));
  const { setInput, setMessages, setHistory, setLoadingOlder } = conversationStore.getState();
  const running = useStore(pageStore, (state) => state.running);
  const { setRunning, setLoginOpen } = pageStore.getState();
  const chatRef = useRef<WalliChatRef>(null);
  const sessionRef = useRef(sessionId);
  const requestRef = useRef<AbortController | null>(null);
  const streamRef = useRef<WalliChatStreamingHandle | null>(null);
  const olderRequestRef = useRef<AbortController | null>(null);
  const hydratedHistory = useRef(history.data);
  const alive = useRef(true);
  const dialog = config.dialogSettings;
  const meta = useMemo(() => getAssistantMeta(dialog), [dialog]);
  useEffect(() => {
    if (!history.data || hydratedHistory.current === history.data || pageStore.getState().running) return;
    hydratedHistory.current = history.data;
    const rows = history.data.messages.map((message) =>
      message.role === "assistant" ? { ...message, meta } : message,
    );
    setHistory(history.data.nextCursor === null ? [...openingMessages(config), ...rows] : rows, history.data.nextCursor);
  }, [history.data, config, meta, pageStore, setHistory]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requestRef.current?.abort();
      streamRef.current?.abort();
      olderRequestRef.current?.abort();
      setRunning(false);
    };
  }, [setRunning]);
  const cacheMessages = (session = history.data?.session) => {
    const messages = [...(chatRef.current?.element?.messages ?? [])];
    setMessages(messages);
    const queryKey = ["web-chat-history", config.id, credentials?.userId, sessionRef.current];
    queryClient.setQueryData<WebHistory>(queryKey, {
      session,
      messages: messages.filter((message) => !message.id.startsWith(OPENING_MESSAGE_PREFIX)),
      nextCursor: conversationStore.getState().cursor,
    });
    // This snapshot came from Chat itself; do not feed it back through history hydration.
    hydratedHistory.current = queryClient.getQueryData<WebHistory>(queryKey);
  };
  const loadOlder = async () => {
    const { cursor, loadingOlder } = conversationStore.getState();
    if (!sessionId || cursor === null || loadingOlder || requestRef.current) return;
    const controller = new AbortController();
    olderRequestRef.current = controller;
    setLoadingOlder(true);
    try {
      const page = await webChatJson<WebHistory>(
        config.slug,
        `/sessions/${encodeURIComponent(sessionId)}?cursor=${cursor}`,
        credentials,
        { signal: controller.signal },
      );
      if (!alive.current || controller.signal.aborted) return;
      const rows = page.messages.map((message) =>
        message.role === "assistant" ? { ...message, meta } : message,
      );
      chatRef.current?.insertMessagesAtTop(
        page.nextCursor === null ? [...openingMessages(config), ...rows] : rows,
        { stick: true },
      );
      const messages = [...(chatRef.current?.element?.messages ?? [])];
      setHistory(messages, page.nextCursor);
      cacheMessages();
    } catch {
      if (!controller.signal.aborted) toast.error(t("webChatRequestFailed"));
    } finally {
      olderRequestRef.current = null;
      setLoadingOlder(false);
    }
  };
  const submit = async (markdown: string) => {
    if (requestRef.current || conversationStore.getState().loadingOlder || !markdown.trim()) return;
    const text = markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
    if (text.length > dialog.dialogInputMaxLength) {
      toast.error(t("webChatInputLimit", { count: dialog.dialogInputMaxLength }));
      return;
    }
    if (config.loginMethod === "google" && !config.authenticated) {
      try {
        savePendingQuestion(config.slug, { markdown, sessionId: requestedSessionId, autoSend: true });
        setInput(markdown);
        setLoginOpen(true);
      } catch { toast.error(t("webChatRequestFailed")); }
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setRunning(true);
    let createdSession: WebSession | undefined;
    try {
      const sessionToken = !sessionRef.current ? await credentials?.verifyBot?.("chat_session", controller.signal) : undefined;
      const messageToken = await credentials?.verifyBot?.("chat_message", controller.signal);
      if (controller.signal.aborted || !alive.current) return;
      setInput("");
      chatRef.current?.insertMessagesAtBottom([{ id: crypto.randomUUID(), role: "user", markdown }], { stick: true });
      if (!sessionRef.current) {
        createdSession = await webChatJson<WebSession>(config.slug, "/sessions", credentials, {
          method: "POST",
          signal: controller.signal,
          headers: sessionToken ? { "X-Turnstile-Token": sessionToken } : undefined,
        });
        sessionRef.current = createdSession.id;
      }
      if (controller.signal.aborted || !alive.current) return;
      const activeSessionId = sessionRef.current;
      const body = webChatRequest(
        config.slug,
        `/sessions/${encodeURIComponent(activeSessionId)}/messages`,
        credentials,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(messageToken ? { "X-Turnstile-Token": messageToken } : {}) },
          body: JSON.stringify({ content: markdown }),
        },
      ).then((response) => {
        if (!response.body) throw new Error("Missing stream");
        return response.body;
      });
      const messageId = crypto.randomUUID();
      const stream = chatRef.current?.insertStreamingMessageAtBottom(body, {
        messageId,
        meta,
        bottomPaddingHeight: isMobile
          ? (document.documentElement.clientHeight * 2) / 3
          : ((chatRef.current?.element?.clientHeight ?? 600) * 2) / 3,
      });
      if (!stream) throw new Error("Chat unavailable");
      streamRef.current = stream;
      await stream.finished;
      cacheMessages(history.data?.session
        ? { ...history.data.session, title: history.data.session.title || text.slice(0, 50) }
        : undefined);
      clearPendingQuestion(config.slug);
      onSent(text || t("assistantAvatar"));
    } catch {
      if (alive.current) setInput(markdown);
      if (createdSession) {
        try { savePendingQuestion(config.slug, { markdown, sessionId: createdSession.id, autoSend: false }); } catch { /* Input remains available on this page. */ }
      }
      if (!controller.signal.aborted) toast.error(t("webChatRequestFailed"));
    } finally {
      requestRef.current = null;
      streamRef.current = null;
      if (alive.current) {
        setMessages([...(chatRef.current?.element?.messages ?? [])]);
        setRunning(false);
        if (createdSession) {
          const session = { ...createdSession, title: text.slice(0, 50) };
          cacheMessages(session);
          await onSessionCreated(session);
        } else if (!sessionRef.current) {
          setInput(markdown);
          setMessages(openingMessages(config));
        }
      }
    }
  };
  const resumeQuestion = useEffectEvent(() => {
    const pending = readPendingQuestion(config.slug);
    if (!pending?.autoSend || pending.sessionId !== sessionId) return;
    // Mark before sending, so remounts never submit the same question twice.
    savePendingQuestion(config.slug, { ...pending, autoSend: false });
    void submit(pending.markdown);
  });
  useEffect(() => {
    if (!config.authenticated || (sessionId && !history.isSuccess)) return;
    const timer = window.setTimeout(() => resumeQuestion(), 0);
    return () => window.clearTimeout(timer);
  }, [config.authenticated, sessionId, history.isSuccess]);
  const uploadImages: WalliChatComposerUploadImagesCallback = async (
    files,
    setProgress,
    setResult,
  ) => {
    await Promise.all(
      files.map(async (file) => {
        try {
          if (!file.type.startsWith("image/")) throw new Error("Only images are supported");
          const form = new FormData();
          form.set("file", file);
          setProgress(file, 0);
          const asset = await webChatJson<{ url: string }>(config.slug, "/image", credentials, {
            method: "POST",
            body: form,
          });
          setProgress(file, 100);
          setResult(file, { url: asset.url });
        } catch (error) {
          setResult(file, { error: error instanceof Error ? error : new Error("Upload failed") });
        }
      }),
    );
  };
  const transcribe = async ({ finished, signal }: WalliChatComposerTranscriptionContext) => {
    const { audio } = await finished;
    const form = new FormData();
    form.set("audio", audio, "recording.webm");
    const result = await webChatJson<{ text: string }>(config.slug, "/transcribe", credentials, {
      method: "POST",
      body: form,
      signal,
    });
    return result.text;
  };
  if (sessionId && history.isError)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          {history.error instanceof WebChatError && history.error.status === 404
            ? t("webChatSessionUnavailable")
            : t("webChatRequestFailed")}
        </p>
        <Button variant="outline" onClick={() => void history.refetch()}>
          {t("webChatRetry")}
        </Button>
      </div>
    );
  return (
    <div className="min-h-0 flex-1">
      <WalliChat
        className="web-chat-messages block h-full w-full"
        topOcclusionHeight={isMobile ? 56 : undefined}
        ref={chatRef}
        loading={!!sessionId && history.isPending}
        messages={messages}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.2}
      >
        <WalliChatComposer
          slot="composer"
          disabled={loadingOlder || (!!sessionId && history.isFetching)}
          value={input}
          maxLength={dialog.dialogInputMaxLength}
          onValueChange={setInput}
          onSubmit={submit}
          onCancel={() => {
            requestRef.current?.abort();
            streamRef.current?.abort();
          }}
          placeholder={dialog.dialogPlaceholder || t("webChatInputPlaceholder")}
          onUploadImages={dialog.dialogImageEnabled ? uploadImages : undefined}
          onTranscribe={dialog.dialogSpeechEnabled ? transcribe : undefined}
          transcribingText={t("webChatTranscribing")}
          uploadImagesTitle={t("webChatUploadImages")}
        />
      </WalliChat>
      <span className="sr-only" role="status">
        {running ? t("webChatResponding") : ""}
      </span>
    </div>
  );
}
