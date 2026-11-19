// Runs Playwright with everything it writes kept inside e2e/.tmp: browser profiles and other temp
// files (TEMP/TMP), and no browser downloads — the tests drive the Microsoft Edge already installed.
// Usage: npm test [-- <playwright test options>] · npm run report

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = path.join(root, ".tmp");
const osTemp = path.join(tmp, "os-temp");

rmSync(osTemp, { recursive: true, force: true });
mkdirSync(osTemp, { recursive: true });

// Only on Windows (your machine). On Linux (the pipeline) Edge puts a socket file in the temp folder, and a
// socket path deep inside the repository is longer than Linux allows, so the system temp folder is kept.
const tempFolders = process.platform === "win32" ? { TEMP: osTemp, TMP: osTemp, TMPDIR: osTemp } : {};

const env = {
  ...process.env,
  ...tempFolders,
  PLAYWRIGHT_BROWSERS_PATH: path.join(tmp, "browsers"),
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
};

const args = process.argv.slice(2);
const command = args[0] === "show-report" ? args : ["test", ...args];
const cli = path.join(root, "node_modules", "@playwright", "test", "cli.js");

const child = spawn(process.execPath, [cli, ...command], { cwd: root, env, stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
