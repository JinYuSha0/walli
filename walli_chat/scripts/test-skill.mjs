import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  renameSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "walli-chat-skill-"));
try {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const [packed] = JSON.parse(
    execFileSync(
      npm,
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--cache",
        join(temp, "cache"),
        "--pack-destination",
        temp,
      ],
      { cwd: packageRoot, encoding: "utf8" },
    ),
  );
  const files = new Set(packed.files.map((file) => file.path));
  for (const file of [
    "bin/install-skill.mjs",
    "dist/index.js",
    "dist/react.js",
    "dist/vue.js",
    "dist/types/index.d.ts",
    "skills/walli-chat/SKILL.md",
    ...["api", "javascript", "react", "vue", "blocks", "installation", "existing-blocks"].map(
      (name) => `skills/walli-chat/references/${name}.md`,
    ),
  ])
    assert(files.has(file), `Missing packed file: ${file}`);

  // Use the real tarball as a consumer's installed package, without network dependencies.
  const consumer = join(temp, "consumer");
  const installed = join(consumer, "node_modules/@wallilabs/chat");
  mkdirSync(installed, { recursive: true });
  execFileSync("tar", [
    "-xzf",
    join(temp, packed.filename),
    "--strip-components=1",
    "-C",
    installed,
  ]);
  const require = createRequire(join(consumer, "package.json"));
  const entry = require.resolve("@wallilabs/chat/skills/walli-chat/SKILL.md");
  const skill = readFileSync(entry, "utf8");
  assert.match(skill, /^---\nname: walli-chat\ndescription: .+\n---\n/);
  for (const [, reference] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
    assert(readFileSync(join(dirname(entry), reference), "utf8").length > 0);
  }
  const manifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  const bin = join(installed, manifest.bin["walli-chat-skill"]);
  const run = () => spawnSync(process.execPath, [bin], { cwd: consumer, encoding: "utf8" });
  assert.equal(manifest.scripts.postinstall, "node bin/install-skill.mjs --postinstall");
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", version: "1.0.0" }),
  );
  // Run npm's real dependency lifecycle from the consumer, not the helper CLI.
  execFileSync(
    npm,
    [
      "rebuild",
      "@wallilabs/chat",
      "--offline",
      "--ignore-scripts=false",
      "--cache",
      join(temp, "cache"),
    ],
    { cwd: consumer, encoding: "utf8" },
  );
  assert.equal(
    realpathSync(join(consumer, ".agents/skills/walli-chat")),
    realpathSync(dirname(entry)),
  );
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const destination = join(consumer, ".agents/skills/walli-chat");
  assert.equal(realpathSync(destination), realpathSync(dirname(entry)));
  assert.equal(run().status, 0, "Repeat installation must succeed");
  writeFileSync(join(dirname(entry), "references/api.md"), "updated package docs\n");
  assert.equal(
    readFileSync(join(destination, "references/api.md"), "utf8"),
    "updated package docs\n",
  );

  rmSync(destination);
  mkdirSync(destination);
  writeFileSync(join(destination, "SKILL.md"), "user-owned skill\n");
  const conflict = run();
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /Refusing to overwrite/);
  assert.equal(readFileSync(join(destination, "SKILL.md"), "utf8"), "user-owned skill\n");
  const autoConflict = spawnSync(process.execPath, [bin, "--postinstall"], {
    cwd: installed,
    env: { ...process.env, INIT_CWD: consumer },
    encoding: "utf8",
  });
  assert.equal(autoConflict.status, 0, "Optional skill conflict must not fail npm install");
  assert.match(autoConflict.stderr, /Refusing to overwrite/);
  assert.equal(readFileSync(join(destination, "SKILL.md"), "utf8"), "user-owned skill\n");

  // Simulate pnpm's physical store and stable public dependency symlink.
  rmSync(destination, { recursive: true });
  const stored = join(consumer, "node_modules/.pnpm/chat@1/node_modules/@wallilabs/chat");
  mkdirSync(dirname(stored), { recursive: true });
  renameSync(installed, stored);
  symlinkSync(stored, installed, "dir");
  const pnpmAuto = spawnSync(
    process.execPath,
    [join(stored, "bin/install-skill.mjs"), "--postinstall"],
    {
      cwd: stored,
      env: { ...process.env, INIT_CWD: join(consumer, "src") },
      encoding: "utf8",
    },
  );
  assert.equal(pnpmAuto.status, 0, pnpmAuto.stderr);
  assert.equal(realpathSync(destination), realpathSync(join(stored, "skills/walli-chat")));
  rmSync(destination);
  const globalAuto = spawnSync(process.execPath, [bin, "--postinstall"], {
    cwd: installed,
    env: { ...process.env, INIT_CWD: consumer, npm_config_global: "true" },
    encoding: "utf8",
  });
  assert.equal(globalAuto.status, 0);
  assert.throws(() => realpathSync(destination), { code: "ENOENT" });
  console.log(
    "Skill packaging, npm lifecycle, pnpm layout, global skip, repeat install, updates, and conflict preservation passed.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
