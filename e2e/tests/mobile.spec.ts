import { expect, test } from "../support/fixtures";
import { LOCALES, site } from "../support/env";

// Runs in the "phone" project (Pixel 7 screen, touch).

test.describe("On a phone", () => {
  for (const locale of LOCALES) {
    test(`/${locale} has no sideways scrolling`, async ({ page }) => {
      await page.goto(site(`/${locale}`));
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the menu opens and takes you to a section", async ({ page }) => {
    await page.goto(site("/en"));
    await page.getByRole("button", { name: "Open menu" }).click();
    const projects = page.getByRole("link", { name: "Projects" }).filter({ visible: true }).first();
    await expect(projects).toBeVisible();
    await projects.click();
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator("#projects")).toBeInViewport();
  });
});
