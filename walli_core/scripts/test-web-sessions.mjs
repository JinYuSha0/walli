import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
const { build } = wranglerRequire("esbuild");
const { Miniflare } = wranglerRequire("miniflare");
const result = await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["scripts/fixtures/web-sessions-worker.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  conditions: ["workerd", "worker", "browser"],
  mainFields: ["module", "main"],
  external: ["cloudflare:*", "node:*"],
  loader: { ".sql": "text" },
  tsconfig: "tsconfig.worker.json",
});
const persistence = await mkdtemp(join(tmpdir(), "walli-cleanup-test-"));
const options = {
  durableObjectsPersist: persistence,
  modules: true,
  script: result.outputFiles[0].text,
  compatibilityDate: "2025-10-08",
  compatibilityFlags: ["nodejs_compat"],
  bindings: { API_TOKEN: "runtime-token" },
  kvNamespaces: ["APP_KV"],
  durableObjects: { USER_DO: { className: "SessionProbe", useSQLite: true } },
};
let mf = new Miniflare(options);
try {
  const response = await mf.dispatchFetch("https://test.local/");
  assert.equal(response.status, 200, await response.clone().text());
  const data = await response.json();
  assert.deepEqual(
    [data.first.sessions.length, data.second.sessions.length, data.third.sessions.length],
    [20, 20, 5],
  );
  const ids = [...data.first.sessions, ...data.second.sessions, ...data.third.sessions].map(
    ({ id }) => id,
  );
  assert.equal(new Set(ids).size, 45);
  assert.deepEqual(
    ids,
    Array.from({ length: 45 }, (_, i) => `session-${String(44 - i).padStart(2, "0")}`),
  );
  assert.equal(data.third.nextCursor, null);
  assert.equal(data.deletion.deletedSessionCount, 1);
  assert.equal(data.secondDeletion.deletedSessionCount, 0);
  assert.equal(data.deletedSession, null);
  assert.equal(data.active.length, 44);
  assert.ok(!data.active.some(({ id }) => id === "session-25"));
  assert.ok(data.record.deleted_at > 0);
  assert.equal(data.messages[0].id, "retained-message");
  assert.equal(data.usage.totalToken, 30);
  assert.equal(data.rejectedDeletedSession, true);
  assert.deepEqual(data.otherVisitor, { sessions: [], nextCursor: null });
  console.log(
    "Web session runtime checks passed: migration, cursor ties, deleted boundary, retained data, idempotent deletion, visitor isolation.",
  );
  const deadline = await (await mf.dispatchFetch("https://test.local/cleanup/prepare")).json();
  await mf.dispose();
  mf = new Miniflare(options);
  const restoredDeadline = await (await mf.dispatchFetch("https://test.local/cleanup/deadline")).json();
  assert.equal(restoredDeadline, deadline, "Restart must preserve the pending cleanup deadline");
  const cleanup = await (await mf.dispatchFetch("https://test.local/cleanup/run")).json();
  assert.deepEqual(cleanup.oldMessages, []);
  assert.equal(cleanup.newMessages.length, 1);
  assert.deepEqual(cleanup.sessions.map(({ id }) => id), ["new-session"]);
  assert.ok(cleanup.nextDeadline > Date.now());
  console.log("Cleanup runtime checks passed: restart preserves deadline, expired data deleted, recent data retained, next daily task scheduled.");
} finally {
  await mf.dispose();
  await rm(persistence, { recursive: true, force: true });
}
