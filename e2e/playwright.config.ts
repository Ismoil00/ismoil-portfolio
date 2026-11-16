import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { ADMIN_URL, API_URL, PORTS, REPO_DIR, SITE_URL } from "./support/env";

const python = path.join(
  REPO_DIR,
  "backend",
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);

/** Production build + start, so the tests see what a real visitor gets (and `next dev` keeps running). */
const nextApp = (folder: string, port: number, env: Record<string, string>, readyPath: string) => ({
  name: folder,
  command: `npm run build && npm run start -- -p ${port}`,
  cwd: path.join(REPO_DIR, "frontends", folder),
  url: `http://localhost:${port}${readyPath}`,
  env,
  timeout: 300_000,
  reuseExistingServer: false,
  stdout: "ignore" as const,
  stderr: "pipe" as const,
});

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  // One shared database: tests run one at a time, in file order, and clean up what they add.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  webServer: [
    {
      name: "backend",
      command: `"${python}" scripts/backend.py`,
      url: `${API_URL}/health`,
      env: { E2E_BACKEND_PORT: String(PORTS.backend), E2E_ADMIN_ORIGIN: ADMIN_URL },
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    nextApp("public", PORTS.site, { API_URL, NEXT_PUBLIC_SITE_URL: SITE_URL }, "/en"),
    nextApp("cms-admin", PORTS.admin, { API_URL: API_URL.replace(/\/api\/v1$/, ""), NEXT_PUBLIC_SITE_URL: SITE_URL }, "/login"),
  ],

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Edge"], channel: "msedge" } },
    {
      name: "desktop",
      testIgnore: /(mobile|account)\.spec\.ts/,
      use: { ...devices["Desktop Edge"], channel: "msedge" },
      dependencies: ["setup"],
    },
    {
      name: "phone",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "msedge" },
      dependencies: ["setup"],
    },
    {
      // Last: changing the password signs out the session every other test shares.
      name: "account",
      testMatch: /account\.spec\.ts/,
      use: { ...devices["Desktop Edge"], channel: "msedge" },
      dependencies: ["desktop", "phone"],
    },
  ],
});
