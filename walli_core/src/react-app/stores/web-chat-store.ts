import { createStore } from "zustand";
import type { WalliChatMessage } from "@wallilabs/chat/react";

export const createWebChatStore = () =>
  createStore<{
    loginOpen: boolean;
    sidebarOpen: boolean;
    sidebarCollapsed: boolean;
    running: boolean;
    draftVersion: number;
    createdSessionId?: string;
    setCreatedSessionId: (id: string) => void;
    setLoginOpen: (open: boolean) => void;
    setSidebarOpen: (open: boolean) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setRunning: (running: boolean) => void;
    startDraft: () => void;
  }>((set) => ({
    loginOpen: false,
    sidebarOpen: false,
    sidebarCollapsed: false,
    running: false,
    draftVersion: 0,
    setCreatedSessionId: (createdSessionId) => set({ createdSessionId }),
    setLoginOpen: (loginOpen) => set({ loginOpen }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    setRunning: (running) => set({ running }),
    startDraft: () => set((state) => ({ draftVersion: state.draftVersion + 1, createdSessionId: undefined, sidebarOpen: false })),
  }));

export type WebChatStore = ReturnType<typeof createWebChatStore>;

type ConversationState = {
  input: string;
  messages: WalliChatMessage[];
  cursor: number | null;
  loadingOlder: boolean;
  setInput: (input: string) => void;
  setMessages: (messages: WalliChatMessage[]) => void;
  setHistory: (messages: WalliChatMessage[], cursor: number | null) => void;
  setLoadingOlder: (loading: boolean) => void;
};

// A new instance belongs to each mounted conversation, including unsent drafts.
export const createConversationStore = (
  initial: Pick<ConversationState, "input" | "messages" | "cursor">,
) => createStore<ConversationState>((set) => ({
  ...initial,
  loadingOlder: false,
  setInput: (input) => set({ input }),
  setMessages: (messages) => set({ messages }),
  setHistory: (messages, cursor) => set({ messages, cursor }),
  setLoadingOlder: (loadingOlder) => set({ loadingOlder }),
}));
