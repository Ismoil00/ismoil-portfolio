import { expect, test, type Page } from "@playwright/test";
import { adminApi, i18n } from "../support/admin-api";
import { ADMIN_STATE, admin, site } from "../support/env";

// One date field everywhere (admin forms and the public filters): type the date or pick it in the
// calendar, where a click on the year opens a grid of years.
test.use({ storageState: ADMIN_STATE });

// Required fields end with "*" in their label, so the admin fields are found by id.
const calendar = (page: Page, name = "Calendar") => page.getByRole("dialog", { name });

test.describe("Date fields", () => {
  test("admin: a month can be typed in several formats; wrong text is put back", async ({ page }) => {
    await page.goto(admin("/projects/new"));
    const from = page.locator("#project-start");

    await from.fill("03.2024");
    await from.press("Enter");
    await expect(from).toHaveValue("Mar 2024");

    await from.fill("nov 2023");
    await from.press("Tab");
    await expect(from).toHaveValue("Nov 2023");

    await from.fill("13.2024"); // no 13th month
    await expect(from).toHaveAttribute("aria-invalid", "true");
    await from.press("Tab");
    await expect(from).toHaveValue("Nov 2023");
  });

  test("admin: the calendar zooms out to years for a fast jump", async ({ page }) => {
    await page.goto(admin("/projects/new"));
    await page.locator("#project-start").click();
    const panel = calendar(page);
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: /^Choose a year/ }).click();
    await panel.getByRole("button", { name: "Previous 12 years" }).click();
    await panel.getByRole("button", { name: "2014", exact: true }).click();
    await panel.getByRole("button", { name: "Feb", exact: true }).click();
    await expect(page.locator("#project-start")).toHaveValue("Feb 2014");
    await expect(panel).toHaveCount(0);
  });

  test("admin: the testimonial date has days, typed or picked; no future dates", async ({ page }) => {
    await page.goto(admin("/testimonials/new"));
    const date = page.locator("#t-date");

    await date.fill("15.03.2025");
    await date.press("Enter");
    await expect(date).toHaveValue("15 Mar 2025");

    await date.click();
    const panel = calendar(page);
    await expect(panel.getByRole("button", { name: /^Choose a month: Mar 2025/ })).toBeVisible();
    await panel.getByRole("button", { name: "20 Mar 2025" }).click();
    await expect(date).toHaveValue("20 Mar 2025");

    await date.fill("01.01.2100");
    await expect(date).toHaveAttribute("aria-invalid", "true");
  });

  test("site: the period filter takes a typed month (in Russian too)", async ({ page }) => {
    await page.goto(site("/en/experience"));
    const from = page.getByLabel("Period · From");
    await from.fill("01.2024");
    await from.press("Enter");
    await expect(page).toHaveURL(/from=2024-01/);
    await expect(from).toHaveValue("Jan 2024");

    await page.goto(site("/ru/experience"));
    const fromRu = page.getByLabel("Период · С");
    await fromRu.fill("мар. 2024");
    await fromRu.press("Enter");
    await expect(page).toHaveURL(/from=2024-03/);

    await fromRu.click();
    await calendar(page, "Календарь").getByRole("button", { name: /^Выбрать год/ }).click();
    await expect(calendar(page, "Календарь").getByRole("button", { name: "2024", exact: true })).toBeVisible();
  });
});

test.describe("Experience: only one current job", () => {
  test("the blocked “I work here now” explains itself on hover", async ({ page }) => {
    const api = await adminApi();
    try {
      const company = await api.selector("companies", "Smartpay");
      const python = await api.selector("tech-stacks", "Python");
      const current = await api.post<{ id: string }>("experiences", {
        title: i18n("Current role (E2E)"),
        company_id: company.id,
        start: "2026-01",
        end: null,
        is_current: true,
        description: i18n("<p>Added by the end-to-end tests and removed right after.</p>"),
        tech_ids: [python.id],
        field_ids: [],
        project_ids: [],
        testimonial_ids: [],
      });
      try {
        const other = (await api.get<{ id: string; is_current: boolean }[]>("experiences")).find((e) => !e.is_current)!;
        await page.goto(admin(`/experience/${other.id}`));
        const box = page.getByRole("checkbox", { name: /I work here now/ });
        await expect(box).toBeDisabled();
        await expect(page.getByText("Shown as “Present”.")).toHaveCount(0);

        const reason = /only one position can be marked as current, and “Current role \(E2E\)” already is/;
        // The bubble is drawn on hover (screen readers get the same text with the checkbox).
        const bubble = page.locator("span[aria-hidden]").filter({ hasText: reason });
        await expect(bubble).toHaveCSS("opacity", "0");
        await page.getByText("I work here now", { exact: true }).hover();
        await expect(bubble).toHaveCSS("opacity", "1");
      } finally {
        await api.delete(`experiences/${current.id}`);
      }
    } finally {
      await api.dispose();
    }
  });
});
