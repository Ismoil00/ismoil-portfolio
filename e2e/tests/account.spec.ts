import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, admin, adminCredentials } from "../support/env";

// Runs last (its own project in playwright.config.ts): a password change signs out every other browser,
// including the session the other tests share.

const NEW_PASSWORD = "e2e-changed-passphrase-2026";

async function signIn(page: Page, password: string) {
  await page.goto(admin("/login"));
  await page.locator("#email").fill(adminCredentials().email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const currentField = (page: Page) => page.locator("#current-password");
const newField = (page: Page) => page.locator("#new-password");
const repeatField = (page: Page) => page.locator("#repeat-password");

async function changePassword(page: Page, current: string, next: string) {
  await page.goto(admin("/settings"));
  await currentField(page).fill(current);
  await newField(page).fill(next);
  await repeatField(page).fill(next);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed. Other browsers were signed out.")).toBeVisible();
}

test("the admin password changes in Settings: other browsers are signed out, the new one signs in", async ({ page, browser }) => {
  const { password } = adminCredentials();
  await signIn(page, password);
  await expect(page).toHaveURL(admin("/hero"));

  // Mistakes are caught before anything is sent.
  await page.goto(admin("/settings"));
  await currentField(page).fill(password);
  await newField(page).fill(NEW_PASSWORD);
  await repeatField(page).fill("something-else-entirely");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("The two new passwords don't match")).toBeVisible();

  await changePassword(page, password, NEW_PASSWORD);
  try {
    // This browser is still signed in…
    await page.goto(admin("/about"));
    await expect(page.getByRole("heading", { name: "About me" })).toBeVisible();
    // …the shared one from the other tests is not.
    const other = await browser.newContext({ storageState: ADMIN_STATE });
    const otherPage = await other.newPage();
    await otherPage.goto(admin("/hero"));
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();

    // The old password no longer works, the new one does.
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await signIn(page, password);
    await expect(page.getByRole("alert")).toBeVisible();
    await signIn(page, NEW_PASSWORD);
    await expect(page).toHaveURL(admin("/hero"));
  } finally {
    await changePassword(page, NEW_PASSWORD, password);
  }
});
