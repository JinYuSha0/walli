import { getAsyncContext } from "@worker/lib/async-context";

export function isTurnstileConfigured(hostname?: string): boolean {
  const { env, origin } = getAsyncContext();
  if (!env.TURNSTILE_SITE_KEY?.trim() || !env.TURNSTILE_SECRET?.trim()) return false;
  const expectedHost = hostname ?? new URL(origin).hostname;
  return (env.TURNSTILE_HOSTNAMES ?? "").split(",").some((host) => host.trim() === expectedHost);
}

export async function verifyTurnstile(token: string | undefined, action: string, clientId: string, hostname: string, remoteip?: string): Promise<boolean> {
  const env = getAsyncContext().env;
  const secret = env.TURNSTILE_SECRET?.trim();
  const allowed = new Set((env.TURNSTILE_HOSTNAMES ?? "").split(",").map((host) => host.trim()).filter(Boolean));
  if (!secret || !token || token.length > 2048 || !allowed.has(hostname)) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(remoteip ? { remoteip } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; action?: string; hostname?: string; cdata?: string };
    return result.success === true && result.action === action && result.hostname === hostname && result.cdata === clientId;
  } catch {
    return false;
  }
}
