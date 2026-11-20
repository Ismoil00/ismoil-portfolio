import { expect, test, type Page } from "../support/fixtures";
import { ADMIN_STATE, LOCALES, admin, site } from "../support/env";

const PAGES = ["", "/experience", "/projects", "/projects/gov-platform", "/certificates"];

/** Collects uncaught page errors and console errors while a page is used. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.describe("Every public page in all three languages", () => {
  for (const locale of LOCALES) {
    for (const pathname of PAGES) {
      test(`/${locale}${pathname} renders without errors`, async ({ page }) => {
        const errors = watchErrors(page);
        const response = await page.goto(site(`/${locale}${pathname}`));
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe("Language switcher", () => {
  test("switches the page between English, Russian and Tajik", async ({ page }) => {
    await page.goto(site("/en/projects"));
    const switcher = page.getByRole("group", { name: "Language" }).first();

    await switcher.getByRole("button", { name: "RU" }).click();
    await expect(page).toHaveURL(site("/ru/projects"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Все проекты");

    await page.getByRole("group", { name: "Язык" }).first().getByRole("button", { name: "TJ" }).click();
    await expect(page).toHaveURL(site("/tg/projects"));
    await expect(page.locator("html")).toHaveAttribute("lang", "tg");
  });
});

test.describe("Themes", () => {
  test("the public site switches to light, remembers it after a reload, and switches back", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(site("/en"));
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(html).not.toHaveAttribute("data-theme", "light");
    expect(errors).toEqual([]);
  });

  test.describe("admin panel", () => {
    test.use({ storageState: ADMIN_STATE });

    test("switches to light and back", async ({ page }) => {
      await page.goto(admin("/hero"));
      const html = page.locator("html");
      const toLight = page.getByRole("button", { name: "Switch to light theme" }).first();
      const startsDark = await toLight.isVisible();
      if (!startsDark) await page.getByRole("button", { name: "Switch to dark theme" }).first().click();

      await page.getByRole("button", { name: "Switch to light theme" }).first().click();
      await expect(html).toHaveAttribute("data-theme", "light");
      await page.reload();
      await expect(html).toHaveAttribute("data-theme", "light");
      await page.getByRole("button", { name: "Switch to dark theme" }).first().click();
      await expect(html).not.toHaveAttribute("data-theme", "light");
    });
  });
});
