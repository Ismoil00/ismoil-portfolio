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
        // The form previews the role exactly as the site will show it, in every language.
        const preview = page.locator("div", { has: page.getByText("Shown on the site as") }).last();
        await expect(preview).toContainText("Backend development");
        await expect(preview).toContainText("Бэкенд Разработчик");

        await techPicker(page).click();
        await page.getByRole("option", { name: "Python", exact: true }).click();
        await expect(techPicker(page)).toHaveText("Python");
        await expect(fieldPicker(page)).toHaveText("Pick a field"); // only one role at a time
        await expect(preview).toContainText("Python development");
        await expect(preview).toContainText("Python Разработчик");
        await expect(preview).toContainText("Python Барномасоз");

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

  test("the quote is rich text and the photo opens full size", async ({ page }) => {
    await page.goto(site("/en"));
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 320, height: 180 } });
    const api = await adminApi();
    try {
      const company = await api.selector("companies", "Smartpay");
      const python = await api.selector("tech-stacks", "Python");
      const photo = await api.upload("testimonial_image", { name: "face.png", mimeType: "image/png", buffer: png });
      const testimonial = await api.post<{ id: string }>("testimonials", {
        author_name: i18n("Quote Check"),
        author_role: i18n("Team lead"),
        company_id: company.id,
        field_id: null,
        tech_stack_id: python.id,
        given_on: "2025-04-10",
        quote: i18n("<p>Shipped <strong>on time</strong>.</p><ul><li>Clear code</li></ul>"),
        media_id: photo.id,
        verify_url: "https://example.com/",
        project_ids: [],
      });

      try {
        await page.goto(admin(`/testimonials/${testimonial.id}`));
        await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
        await page.getByRole("button", { name: "Open face.png full size" }).click();
        await expect(page.getByRole("dialog", { name: "face.png" }).getByRole("img", { name: "face.png" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);

        await page.goto(site("/en/testimonials"));
        const quote = page.locator("blockquote .rich-text");
        await expect(quote.locator("strong", { hasText: "on time" })).toBeVisible();
        await expect(quote.locator("li", { hasText: "Clear code" })).toBeAttached();
      } finally {
        await api.delete(`testimonials/${testimonial.id}`);
      }
    } finally {
      await api.dispose();
    }
  });
});
