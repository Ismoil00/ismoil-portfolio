import { expect, test as setup } from "../support/fixtures";
import { ADMIN_STATE, admin, adminCredentials } from "../support/env";

// Signs in once through the real login page and saves the session for the tests that need it.
setup("sign in as the E2E admin", async ({ page }) => {
  const { username, password } = adminCredentials();
  await page.goto(admin("/login"));
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: ADMIN_STATE });
});
