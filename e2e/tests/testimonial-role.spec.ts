import { expect, test, type Page } from "@playwright/test";
import { adminApi, i18n } from "../support/admin-api";
import { ADMIN_STATE, admin, site } from "../support/env";

// "My role" on a testimonial is a development field or a technology (one of them), and the site
// shows it with "development" added: "Python development" · "Python Разработчик" · "Python Барномасоз".
test.use({ storageState: ADMIN_STATE });

const fieldPicker = (page: Page) => page.getByLabel("Development field", { exact: true });
const techPicker = (page: Page) => page.getByLabel("Technology", { exact: true });

test.describe("Testimonials: my role", () => {
  test("a testimonial can't be saved without a field or a technology", async ({ page }) => {
    await page.goto(admin("/testimonials/new"));
    await page.getByRole("button", { name: "Add testimonial" }).click();
    await expect(page.getByText("Pick a development field or a technology")).toBeVisible();
  });

  test("picking a technology replaces the field, and the site adds “development”", async ({ page }) => {
    const api = await adminApi();
    try {
      const company = await api.selector("companies", "Smartpay");
      const backend = await api.selector("development-fields", "Backend");
      const testimonial = await api.post<{ id: string }>("testimonials", {
        author_name: i18n("Role Check"),
        author_role: i18n("Team lead"),
        company_id: company.id,
        field_id: backend.id,
        tech_stack_id: null,
        given_on: "2025-04-10",
        quote: i18n("Added by the end-to-end tests and removed right after."),
        media_id: null,
        verify_url: "https://example.com/",
        project_ids: [],
      });

      try {
        await page.goto(admin(`/testimonials/${testimonial.id}`));
        await expect(fieldPicker(page)).toHaveText("Backend");
        await expect(techPicker(page)).toHaveText("Pick a technology");

        await techPicker(page).click();
        await page.getByRole("option", { name: "Python", exact: true }).click();
        await expect(techPicker(page)).toHaveText("Python");
        await expect(fieldPicker(page)).toHaveText("Pick a field"); // only one role at a time

        await page.getByRole("button", { name: "Save changes" }).click();
        await expect(page.getByText("Testimonial saved.")).toBeVisible();
        await expect(page.getByText("My role: Python development")).toBeVisible();

        for (const [lang, role] of [
          ["en", "Python development"],
          ["ru", "Python Разработчик"],
          ["tg", "Python Барномасоз"],
        ]) {
          await page.goto(site(`/${lang}/testimonials`));
          await expect(page.getByText(role, { exact: true })).toBeVisible();
        }
      } finally {
        await api.delete(`testimonials/${testimonial.id}`);
      }
    } finally {
      await api.dispose();
    }
  });
});
