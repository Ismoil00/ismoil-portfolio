// Every test starts as a visitor who already answered the cookie banner (accepted all), so the banner
// never covers what a test clicks. tests/consent.spec.ts tests the banner itself with fresh browsers.

import { test as base } from "@playwright/test";
import { SITE_URL } from "./env";

export * from "@playwright/test";

export const CONSENT_ALL = "v1:a1p1";

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addCookies([{ name: "consent", value: encodeURIComponent(CONSENT_ALL), url: SITE_URL }]);
    await use(context);
  },
});
