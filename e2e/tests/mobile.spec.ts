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

  test("the AI assistant fills the screen and closes again", async ({ page }) => {
    await page.goto(site("/en"));
    await page.getByRole("button", { name: "Open the AI assistant" }).click();
    const panel = page.getByRole("dialog", { name: "AI assistant" });
    await expect(panel).toBeVisible();
    // It covers the whole window (measured against what the page can show, without a scrollbar), once
    // its short opening animation is over.
    await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = await panel.boundingBox();
    const view = await page.evaluate(() => [document.documentElement.clientWidth, window.innerHeight]);
    expect([Math.round(box?.x ?? -1), Math.round(box?.y ?? -1)]).toEqual([0, 0]);
    expect([Math.round(box?.width ?? 0), Math.round(box?.height ?? 0)]).toEqual(view);

    await panel.getByRole("button", { name: "What has Ismoil built?" }).click();
    await expect(panel.getByRole("link", { name: "Banking and public-sector backend" })).toBeVisible();
    await panel.getByRole("button", { name: "Close the assistant" }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: "Open the AI assistant" })).toBeVisible();
  });
});
