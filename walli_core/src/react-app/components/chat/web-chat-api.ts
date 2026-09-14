import { webChatTurnstileAction } from "@shared/turnstile";
import { getDeviceFingerprint } from "./device-fingerprint";
import type { ClientDialogSettings } from "@shared/client";
import type { WalliChatMessage } from "@wallilabs/chat/react";
export type WebChatConfig = {
  id: string;
  name: string;
  slug: string;
  loginMethod: "none" | "google";
  authenticated: boolean;
  turnstileEnabled: boolean;
  turnstileSiteKey?: string;
  userId?: string;
  userName?: string;
  userImage?: string | null;
  multiSession: boolean;
  dialogSettings: ClientDialogSettings;
};
export type WebSession = { id: string; title: string; createdAt: number };
export type WebSessionsPage = { sessions: WebSession[]; nextCursor: string | null };
export type WebHistory = {
  session?: WebSession;
  messages: WalliChatMessage[];
  nextCursor: number | null;
};
export type WebCredentials = { userId: string; token: string; verifyBot?: (action: string, signal?: AbortSignal | null) => Promise<string> };
export class WebChatError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function webChatRequest(
  slug: string,
  path: string,
  credentials?: WebCredentials,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  if (path === "/config") headers.set("X-Chat-Device", await getDeviceFingerprint());
  if (credentials?.token) {
    headers.set("X-Chat-User", credentials.userId);
    headers.set("Authorization", `Bearer ${credentials.token}`);
  }
  const action = webChatTurnstileAction((init?.method ?? "GET").toUpperCase(), path);
  if (action && credentials?.verifyBot && !headers.has("X-Turnstile-Token")) {
    headers.set("X-Turnstile-Token", await credentials.verifyBot(action, init?.signal));
  }
  const response = await fetch(`/api/web-chat/${encodeURIComponent(slug)}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    if (response.status === 401 && path !== "/config" && typeof window !== "undefined") {
      window.dispatchEvent(new Event("walli-chat-access-changed"));
    }
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new WebChatError(body?.error ?? `Request failed (${response.status})`, response.status);
  }
  return response;
}
export async function webChatJson<T>(
  slug: string,
  path: string,
  credentials?: WebCredentials,
  init?: RequestInit,
): Promise<T> {
  return (await webChatRequest(slug, path, credentials, init)).json();
}
