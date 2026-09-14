import { ChallengeWidget } from "./turnstile-widget";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Challenge = { id: string; action: string; resolve: (token: string) => void; reject: (reason: Error) => void; cleanup: () => void };
export function useTurnstileChallenge(siteKey: string | undefined, clientId: string | undefined) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<Challenge[]>([]);
  const pending = useRef(new Map<string, Challenge>());
  const finish = useCallback((id: string, token?: string) => {
    const request = pending.current.get(id);
    if (!request) return;
    pending.current.delete(id);
    request.cleanup();
    if (token) request.resolve(token);
    else request.reject(new Error("Verification incomplete"));
    setQueue((current) => current.filter((entry) => entry.id !== id));
  }, []);
  useEffect(() => {
    const requests = pending.current;
    return () => {
      for (const request of requests.values()) {
        request.cleanup();
        request.reject(new DOMException("Aborted", "AbortError"));
      }
      requests.clear();
    };
  }, []);
  const verify = useCallback((action: string, signal?: AbortSignal | null): Promise<string> => {
    if (!siteKey || !clientId) return Promise.reject(new Error("Bot verification is not configured"));
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const abort = () => finish(id);
      const request = { id, action, resolve, reject, cleanup: () => signal?.removeEventListener("abort", abort) };
      pending.current.set(id, request);
      signal?.addEventListener("abort", abort, { once: true });
      setQueue((current) => [...current, request]);
    });
  }, [siteKey, clientId, finish]);
  const active = queue[0];
  const dialog = (
    <Dialog open={!!active} onOpenChange={(open) => { if (!open && active) finish(active.id); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("webBotCheckTitle")}</DialogTitle>
          <DialogDescription>{t("webBotCheckHint")}</DialogDescription>
        </DialogHeader>
        {active && siteKey && clientId && <ChallengeWidget key={active.id} siteKey={siteKey} clientId={clientId} action={active.action}
          onToken={(token) => finish(active.id, token)} onError={() => finish(active.id)} />}
      </DialogContent>
    </Dialog>
  );
  return { verify, dialog };
}
