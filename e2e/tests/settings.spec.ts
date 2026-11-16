import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, admin } from "../support/env";

// The Settings page decides what helps fill Russian and Tajik next to every EN / RU / TG field.
test.use({ storageState: ADMIN_STATE });

const titleField = (page: Page) => page.getByRole("textbox", { name: "Title", exact: true });

async function chooseTranslator(page: Page, label: string) {
  await page.goto(admin("/settings"));
  // Click the card, like a person would (the radio itself is visually hidden inside it).
  const radio = page.getByRole("radio", { name: new RegExp(`^${label}`) });
  await page.locator("label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
  await expect(page.getByText("Translator saved.")).toBeVisible();
}

test.describe("Settings: translator", () => {
  test("Manual is the default: no helper next to the language tabs", async ({ page }) => {
    await page.goto(admin("/settings"));
    await expect(page.getByRole("radio", { name: /Manual/ })).toBeChecked();
    await page.goto(admin("/about"));
    await expect(titleField(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Translate", exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Google Translate" })).toHaveCount(0);
  });

  test("Claude can't be picked until its API key is set (no paid call in tests)", async ({ page }) => {
    await page.goto(admin("/settings"));
    await expect(page.getByRole("radio", { name: /Claude/ })).toBeDisabled();
    await expect(page.getByText("Not set up")).toBeVisible();
    await expect(page.getByText(/add ANTHROPIC_API_KEY/)).toBeVisible();
  });

  test("Google Translate opens the website with the English text, nothing else changes", async ({ page, context }) => {
    // Never reach Google from the tests: answer its address locally and only check what was asked for.
    await context.route("https://translate.google.com/**", (route) => route.fulfill({ status: 200, body: "stub" }));
    await chooseTranslator(page, "Google Translate");
    try {
      await page.goto(admin("/about"));
      const english = await titleField(page).inputValue();
      const google = page.getByRole("group", { name: "Google Translate" }).first();
      await expect(page.getByRole("button", { name: "Translate", exact: true })).toHaveCount(0); // no Claude button

      const [tab] = await Promise.all([
        context.waitForEvent("page"),
        google.getByRole("button", { name: "Google Translate to Russian" }).click(),
      ]);
      const url = new URL(tab.url());
      expect(url.hostname).toBe("translate.google.com");
      expect(url.searchParams.get("sl")).toBe("en");
      expect(url.searchParams.get("tl")).toBe("ru");
      expect(url.searchParams.get("text")).toBe(english);
      await tab.close();

      await expect(page.getByText(/Google Translate opened in a new tab/)).toBeVisible();
      await expect(page.getByText("Everything is saved.")).toBeVisible(); // only a tab was opened
    } finally {
      await chooseTranslator(page, "Manual");
    }
  });
});
