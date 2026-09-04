import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

// Use the same bundled workerd/Miniflare and compiler as the installed Wrangler.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
const { build } = wranglerRequire("esbuild");
const { Miniflare } = wranglerRequire("miniflare");
const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ["scripts/fixtures/context-worker.ts"],
  bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
  conditions: ["workerd", "worker", "browser"],
  mainFields: ["module", "main"],
  external: ["cloudflare:*", "node:*"],
  loader: { ".sql": "text" },
  tsconfig: "tsconfig.worker.json",
});

const mf = new Miniflare({
  modules: true, script: result.outputFiles[0].text,
  compatibilityDate: "2025-10-08", compatibilityFlags: ["nodejs_compat"],
  bindings: { API_TOKEN: "runtime-token" }, kvNamespaces: ["APP_KV"],
  durableObjects: {
    PROBE: { className: "ContextProbe", useSQLite: true },
    USER_DO: { className: "UserDO", useSQLite: true },
  },
});

const get = async (path) => {
  const response = await mf.dispatchFetch(`https://test.local${path}`);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};

try {
  const initial = await get("/");
  assert.equal(initial.initialized, "runtime-token");
  assert.equal(initial.current.sessionId, null);
  const nested = await get("/nested");
  assert.equal(nested.sessionId, "task");
  assert.equal((await get("/")).current.sessionId, null);
  assert.equal((await get("/fetch")).token, "runtime-token");
  const peers = await Promise.all([get("/?name=first"), get("/?name=second")]);
  assert.deepEqual(peers.map((peer) => peer.current.name), ["first", "second"]);
  await mf.dispatchFetch("https://test.local/arm");
  let status;
  for (let attempt = 0; attempt < 100; attempt++) {
    status = await get("/");
    if (status.alarm) break;
    await setTimeout(20);
  }
  assert.equal(status.alarm?.token, "runtime-token");
  assert.equal(status.alarm?.sessionId, null);
  const user = await get("/user");
  assert.equal(user.session.clientId, "client-1");
  assert.equal(user.usage.totalToken, 0);
  console.log("DO context runtime checks passed: initialization, RPC, nested context, isolation, fetch, alarm, UserDO.");
} finally {
  await mf.dispose();
}
