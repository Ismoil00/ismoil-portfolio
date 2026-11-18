import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, admin, adminCredentials } from "../support/env";

// Runs last (its own project in playwright.config.ts): a username or password change signs out every
// other browser, including the session the other tests share.

const NEW_PASSWORD = "e2e-changed-passphrase-2026";
const NEW_USERNAME = "e2e-owner";

async function signIn(page: Page, password: string, username = adminCredentials().username) {
  await page.goto(admin("/login"));
  await page.locator("#username").fill(username);
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

async function changeUsername(page: Page, password: string, next: string) {
  await page.goto(admin("/settings"));
  await page.locator("#new-username").fill(next);
  await page.locator("#username-password").fill(password);
  await page.getByRole("button", { name: "Change username" }).click();
  await expect(page.getByText("Username changed. Other browsers were signed out.")).toBeVisible();
}

test("the admin username changes in Settings: other browsers are signed out, only the new one signs in", async ({ page, browser }) => {
  const { username, password } = adminCredentials();
  await signIn(page, password);
  await expect(page).toHaveURL(admin("/hero"));
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, password);
  await expect(otherPage).toHaveURL(admin("/hero"));

  // Mistakes are caught before anything is sent.
  await page.goto(admin("/settings"));
  await expect(page.getByText(`Current username: ${username}`)).toBeVisible();
  await page.locator("#new-username").fill("-bad name");
  await page.locator("#username-password").fill(password);
  await page.getByRole("button", { name: "Change username" }).click();
  await expect(page.getByText("Use 3–32 Latin letters, digits, dots, hyphens or underscores")).toBeVisible();
  await page.locator("#new-username").fill(username.toUpperCase());
  await page.getByRole("button", { name: "Change username" }).click();
  await expect(page.getByText("Pick a username different from the current one")).toBeVisible();

  await changeUsername(page, password, NEW_USERNAME.toUpperCase()); // kept in lowercase
  try {
    await expect(page.getByText(`Current username: ${NEW_USERNAME}`)).toBeVisible();
    await expect(page.getByTitle(NEW_USERNAME, { exact: true })).not.toHaveCount(0); // "Signed in as" in the sidebar

    // The browser signed in before the change is signed out; this one isn't.
    await otherPage.goto(admin("/hero"));
    await expect(otherPage).toHaveURL(/\/login/);
    await page.goto(admin("/about"));
    await expect(page.getByRole("heading", { name: "About me" })).toBeVisible();

    // The old username no longer signs in, the new one does (in any letter case).
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await signIn(page, password, username);
    await expect(page.getByText("Wrong username or password")).toBeVisible();
    await signIn(page, password, NEW_USERNAME.toUpperCase());
    await expect(page).toHaveURL(admin("/hero"));
  } finally {
    // Put the E2E admin's username back (signing in again first if the test stopped while signed out).
    if (/\/login/.test(page.url())) {
      await signIn(page, password, NEW_USERNAME);
      await expect(page).not.toHaveURL(/\/login/);
    }
    await changeUsername(page, password, username);
    await other.close();
  }
});
