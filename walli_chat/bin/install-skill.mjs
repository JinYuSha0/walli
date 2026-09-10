#!/usr/bin/env node
import { lstat, mkdir, readlink, realpath, symlink } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const automatic = process.argv[2] === "--postinstall";
const bundled = fileURLToPath(new URL("../skills/walli-chat", import.meta.url));

async function findProject() {
  if (!automatic) return process.cwd();
  if (process.env.npm_config_global === "true") return null;
  // Lifecycle cwd is the package directory, including pnpm's virtual store.
  // Prefer the invoking workspace, then walk the installed package's ancestors.
  for (const start of [process.env.INIT_CWD, bundled].filter(Boolean)) {
    for (let directory = resolve(start); ; directory = dirname(directory)) {
      if (!directory.split(sep).includes("node_modules")) {
        const source = resolve(directory, "node_modules/@wallilabs/chat/skills/walli-chat");
        try {
          if ((await realpath(source)) === (await realpath(bundled))) return directory;
        } catch (error) {
          if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        }
      }
      if (dirname(directory) === directory) break;
    }
  }
  return null;
}

async function install() {
  if (process.argv.length > (automatic ? 3 : 2)) {
    throw new Error("Usage: walli-chat-skill (run in the consuming project directory)");
  }
  const project = await findProject();
  // Source-repo and global installs have no consuming project to modify.
  if (!project) return;
  const source = resolve(project, "node_modules/@wallilabs/chat/skills/walli-chat");
  const destination = resolve(project, ".agents/skills/walli-chat");
  if ((await realpath(source)) !== (await realpath(bundled))) {
    throw new Error("Run from the project where this @wallilabs/chat package is installed.");
  }
  await mkdir(dirname(destination), { recursive: true });
  const existing = await lstat(destination).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (
      !existing.isSymbolicLink() ||
      resolve(dirname(destination), await readlink(destination)) !== source
    ) {
      throw new Error(`Refusing to overwrite existing skill: ${destination}`);
    }
  } else {
    // Stable package path follows upgrades, including pnpm version changes.
    await symlink(
      process.platform === "win32" ? source : relative(dirname(destination), source),
      destination,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  console.log(`Walli Chat skill ready: ${destination}`);
}

install().catch((error) => {
  console.warn(`Cannot install Walli Chat skill: ${error.message}`);
  // Optional agent documentation must never break installation of the UI library.
  if (!automatic) process.exitCode = 1;
});
