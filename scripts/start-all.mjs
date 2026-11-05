import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageRoot = path.resolve(root, process.env.STORAGE_DIR ?? "./storage");
const port = process.env.PORT || "3000";

try {
  await mkdir(storageRoot, { recursive: true, mode: 0o700 });
} catch {
  console.error("Unable to create the storage directory.");
  process.exit(1);
}

const children = [
  {
    name: "Next.js",
    process: spawn(
      path.join(root, "node_modules/.bin/next"),
      ["start", "--port", port],
      { cwd: root, env: process.env, stdio: "inherit" },
    ),
  },
  {
    name: "worker",
    process: spawn(
      process.execPath,
      ["--import", "tsx", "src/worker/index.ts"],
      { cwd: root, env: process.env, stdio: "inherit" },
    ),
  },
];

let shuttingDown = false;
let forceTimer;

function stopChildren(signal, exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;

  for (const child of children) {
    if (child.process.exitCode === null) child.process.kill(signal);
  }

  forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.process.exitCode === null) child.process.kill("SIGKILL");
    }
    process.exitCode = 1;
  }, 10_000);
  forceTimer.unref();
}

for (const child of children) {
  child.process.on("error", () => {
    console.error(`Unable to start ${child.name}.`);
    stopChildren("SIGTERM", 1);
  });
  child.process.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(
        `${child.name} exited unexpectedly (${signal ?? code ?? "unknown"}).`,
      );
      stopChildren("SIGTERM", 1);
      return;
    }
    if (children.every(({ process: childProcess }) => childProcess.exitCode !== null)) {
      clearTimeout(forceTimer);
    }
  });
}

process.on("SIGINT", () => stopChildren("SIGINT", 0));
process.on("SIGTERM", () => stopChildren("SIGTERM", 0));
