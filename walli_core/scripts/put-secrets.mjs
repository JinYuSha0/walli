#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";

const coreDir = resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const helpRequested = args[0] === "--help" || args[0] === "-h";
const defaultEnvFiles = [".env"];
const envFileArg = helpRequested
  ? undefined
  : (args[0] ?? defaultEnvFiles.find((file) => existsSync(resolve(coreDir, file))));

if (helpRequested) {
  console.error("Usage:");
  console.error("  pnpm run secrets");
  console.error("  pnpm run secrets -- <env-file>");
  console.error("");
  console.error("Examples:");
  console.error("  pnpm run secrets");
  console.error("  pnpm run secrets -- .env.production");
  process.exit(0);
}

if (!envFileArg) {
  console.error("No env file found. Expected walli_core/.env, or pass one explicitly:");
  console.error("  pnpm --filter walli_core run secrets -- .env.production");
  process.exit(1);
}

const envFile = resolve(coreDir, envFileArg);

if (!existsSync(envFile)) {
  console.error("Env file does not exist: " + envFileArg);
  process.exit(1);
}

const parseEnvLines = (source) => {
  const entries = [];

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex === -1) {
      console.warn("Skipping line " + (index + 1) + " (missing =)");
      continue;
    }

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      console.warn("Skipping line " + (index + 1) + " (invalid key: " + key + ")");
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!value) {
      console.log("Skipping " + key + " (empty value)");
      continue;
    }

    entries.push([key, value]);
  }

  return entries;
};

const entries = parseEnvLines(readFileSync(envFile, "utf8"));

if (entries.length === 0) {
  console.error("No secrets found in " + relative(coreDir, envFile));
  process.exit(1);
}

console.log("Using env file: " + relative(coreDir, envFile));

const chunkSize = 100;
const chunks = [];

for (let index = 0; index < entries.length; index += chunkSize) {
  chunks.push(entries.slice(index, index + chunkSize));
}

for (const [index, chunk] of chunks.entries()) {
  const secrets = Object.fromEntries(chunk);
  const result = spawnSync("wrangler", ["secret", "bulk"], {
    cwd: coreDir,
    input: JSON.stringify(secrets),
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.status !== 0) {
    console.error("Failed to bulk put secrets");
    process.exit(result.status ?? 1);
  }

  const suffix = chunks.length > 1 ? " (" + (index + 1) + "/" + chunks.length + ")" : "";
  console.log("Updated " + chunk.length + " secrets" + suffix);
}
