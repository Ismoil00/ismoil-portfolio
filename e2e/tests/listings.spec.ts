import { expect, test } from "../support/fixtures";
import { adminApi, i18n, type AdminApi } from "../support/admin-api";
import { site } from "../support/env";

test.describe("List pages: filters", () => {
  test("projects filtered by a technology, kept in the URL across a reload, then cleared", async ({ page }) => {
    await page.goto(site("/en/projects"));
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();

    await page.getByRole("button", { name: /^Technologies/ }).click();
    await page.getByRole("option", { name: "Elasticsearch" }).click();
    await page.keyboard.press("Escape");

    await expect(page.getByText("Showing 1 of 1")).toBeVisible();
    await expect(page).toHaveURL(/[?&]stack=/);
    await expect(page.getByRole("heading", { name: "Search-heavy national portal" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Showing 1 of 1")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();
  });

  test("experience filtered by company", async ({ page }) => {
    await page.goto(site("/en/experience"));
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();
    await page.getByRole("button", { name: /^Company/ }).click();
    await page.getByRole("option", { name: "Vatan ICT" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });
});

test.describe("List pages: Show more", () => {
  let api: AdminApi;
  const created: string[] = [];

  test.beforeAll(async () => {
    // 11 extra (private, older) projects: 14 in all, more than one page of 10.
    api = await adminApi();
    const web = await api.selector("product-types", "Web");
    const python = await api.selector("tech-stacks", "Python");
    for (let n = 1; n <= 11; n++) {
      const project = await api.post<{ id: string }>("projects", {
        title: i18n(`E2E sample project ${String(n).padStart(2, "0")}`),
        description: i18n("Added by the end-to-end tests and removed right after."),
        start: "2020-01",
        end: "2020-02",
        client_kind: "self",
        company_id: null,
        traffic: "under100",
        live_url: null,
        repo_url: null,
        is_private: true,
        type_ids: [web.id],
        tech_ids: [python.id],
        media_ids: [],
        cover_id: null,
      });
      created.push(project.id);
    }
  });

  test.afterAll(async () => {
    for (const id of created) await api.delete(`projects/${id}`);
    await api.dispose();
  });

  test("the first 10 projects load, Show more adds the rest", async ({ page }) => {
    await page.goto(site("/en/projects"));
    await expect(page.getByText("Showing 10 of 14")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(10);

    await page.getByRole("button", { name: "Show 4 more" }).click();
    await expect(page.getByText("Showing 14 of 14")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(14);
    await expect(page.getByRole("button", { name: /^Show \d+ more$/ })).toHaveCount(0);
  });
});
