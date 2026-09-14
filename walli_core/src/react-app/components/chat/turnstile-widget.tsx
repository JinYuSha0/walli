import { useEffect, useEffectEvent, useRef } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string; action: string; cData: string; theme: "auto"; size: "flexible";
    callback: (token: string) => void;
    "error-callback": () => void; "expired-callback": () => void; "timeout-callback": () => void;
  }) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }
let scriptPromise: Promise<TurnstileApi> | undefined;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 20_000);
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("Verification unavailable"));
    };
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => { scriptPromise = undefined; throw error; });
}

export function ChallengeWidget({ siteKey, clientId, action, onToken, onError }: {
  siteKey: string; clientId: string; action: string;
  onToken: (token: string) => void; onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const success = useEffectEvent(onToken);
  const failure = useEffectEvent(onError);
  useEffect(() => {
    let canceled = false;
    let api: TurnstileApi | undefined;
    let widget: string | undefined;
    void loadTurnstile().then((loaded) => {
      if (canceled || !container.current) return;
      api = loaded;
      widget = loaded.render(container.current, {
        sitekey: siteKey, cData: clientId, action, theme: "auto", size: "flexible",
        callback: (token) => { if (!canceled) success(token); },
        "error-callback": () => { if (!canceled) failure(); },
        "expired-callback": () => { if (!canceled) failure(); },
        "timeout-callback": () => { if (!canceled) failure(); },
      });
    }).catch(() => { if (!canceled) failure(); });
    // Every request mounts a fresh widget; single-use tokens are never cached or reused.
    return () => { canceled = true; if (widget !== undefined) api?.remove(widget); };
  }, [siteKey, clientId, action]);
  return <div ref={container} className="min-h-16 w-full" />;
}

