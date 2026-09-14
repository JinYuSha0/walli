const storageKey = "walli-chat-device-v1";
let fingerprint: Promise<string> | undefined;

// A per-browser seed prevents identical screens/devices from sharing private history.
// Persist the result so screen rotation, resizing, and browser updates do not change it.
export function getDeviceFingerprint(): Promise<string> {
  return fingerprint ??= (async () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
    } catch { /* Storage may be unavailable in private browsing. */ }
    const features = {
      seed: crypto.randomUUID(),
      screen: typeof screen === "undefined" ? [] : [screen.width, screen.height, screen.colorDepth],
      language: typeof navigator === "undefined" ? "" : navigator.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(features)));
    const value = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(storageKey, value); } catch { /* Signed cookie preserves identity. */ }
    return value;
  })();
}
