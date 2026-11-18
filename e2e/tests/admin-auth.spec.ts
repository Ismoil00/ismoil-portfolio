import { expect, test } from "@playwright/test";
import { admin, adminCredentials } from "../support/env";

test.describe("Admin sign-in", () => {
  test("a signed-out visitor is sent to the login page", async ({ page }) => {
    await page.goto(admin("/about"));
    await expect(page).toHaveURL(/\/login\?next=%2Fabout$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password is refused", async ({ page }) => {
    await page.goto(admin("/login"));
    await page.locator("#username").fill(adminCredentials().username);
    await page.locator("#password").fill("not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signing in opens the requested page, the session survives a reload, signing out ends it", async ({ page }) => {
    const { username, password } = adminCredentials();
    await page.goto(admin("/about"));
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(admin("/about"));
    await expect(page.getByRole("heading", { name: "About me" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "About me" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto(admin("/hero"));
    await expect(page).toHaveURL(/\/login\?next=%2Fhero$/);
  });
});
