import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, admin } from "../support/env";

// The Selectors page: search by name (any language), sort by name, and rows without usage chips
// (what uses an item is told by the delete button's tooltip).
test.use({ storageState: ADMIN_STATE });

/** The names of the rows on screen, top to bottom (from their Edit buttons). */
async function rowNames(page: Page) {
  const labels = await page.getByRole("button", { name: /^Edit / }).evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label") ?? ""));
  return labels.map((label) => label.replace(/^Edit /, ""));
}

test.describe("Selectors page", () => {
  test("search finds items by any of their names", async ({ page }) => {
    await page.goto(admin("/selectors?kind=tech-stacks"));
    const search = page.getByRole("searchbox", { name: "Search tech stacks" });
    await search.fill("kot");
    expect(await rowNames(page)).toEqual(["Kotlin"]);
    await expect(page.getByRole("button", { name: "Drag to reorder" })).toHaveCount(0); // no dragging while filtered

    await search.fill("nothing like this");
    await expect(page.getByText("No tech stacks match “nothing like this”.")).toBeVisible();
    await page.getByRole("button", { name: "Clear the search" }).click();
    expect((await rowNames(page)).length).toBeGreaterThan(40);

    await page.goto(admin("/selectors?kind=development-fields"));
    await page.getByRole("searchbox", { name: "Search development fields" }).fill("бэкенд"); // Russian names
    expect(await rowNames(page)).toEqual(["Backend", "Backend performance"]); // Бэкенд, Производительность бэкенда
  });

  test("the sorter orders by name and back to your own order", async ({ page }) => {
    await page.goto(admin("/selectors?kind=tech-stacks"));
    const own = await rowNames(page);
    const byName = [...own].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true }));

    await page.getByRole("button", { name: "A–Z" }).click();
    expect(await rowNames(page)).toEqual(byName);
    await page.getByRole("button", { name: "Z–A" }).click();
    expect(await rowNames(page)).toEqual([...byName].reverse());
    await page.getByRole("button", { name: "Your order" }).click();
    expect(await rowNames(page)).toEqual(own);
    await expect(page.getByRole("button", { name: "Drag to reorder" }).first()).toBeVisible();
  });

  test("rows don't list what uses an item; the delete button's tooltip does", async ({ page }) => {
    await page.goto(admin("/selectors?kind=development-fields"));
    await expect(page.getByText(/^\d+ technolog/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Can't delete Frontend: in use" })).toBeVisible();
  });

  test("“Game development” saves under its own name (it was in the data twice)", async ({ page }) => {
    await page.goto(admin("/selectors?kind=development-fields"));
    await page.getByRole("searchbox", { name: "Search development fields" }).fill("game development");
    expect((await rowNames(page)).filter((name) => name === "Game development")).toHaveLength(1);
    await page.getByRole("button", { name: "Edit Game development" }).click();
    await page.getByRole("dialog", { name: "Edit development field" }).getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });
});
