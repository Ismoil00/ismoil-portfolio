import { expect, test, type Page } from "@playwright/test";
import { adminApi, i18n } from "../support/admin-api";
import { site } from "../support/env";

// Optional content that is missing is not shown at all — no empty sections, links or rows.

const testimonialsLink = (page: Page) =>
  page.getByRole("banner").getByRole("link", { name: "Testimonials", exact: true });

async function expectTestimonialsHidden(page: Page) {
  await page.goto(site("/en"));
  await expect(page.locator("#testimonials")).toHaveCount(0);
  await expect(testimonialsLink(page)).toHaveCount(0);
  expect((await page.request.get(site("/en/testimonials"))).status()).toBe(404);
  expect(await (await page.request.get(site("/sitemap.xml"))).text()).not.toContain("/testimonials");
}

test.describe("Hidden while empty", () => {
  test("testimonials appear only while at least one exists", async ({ page }) => {
    await expectTestimonialsHidden(page);

    const api = await adminApi();
    try {
      const company = await api.selector("companies", "Smartpay");
      // My role there: a technology here, shown with "development" added.
      const python = await api.selector("tech-stacks", "Python");
      const projects = await api.get<{ id: string }[]>("projects");
      const testimonial = await api.post<{ id: string }>("testimonials", {
        author_name: i18n("Sample Author"),
        author_role: i18n("Team lead"),
        company_id: company.id,
        field_id: null,
        tech_stack_id: python.id,
        given_on: "2025-04-10",
        quote: i18n("Added by the end-to-end tests and removed right after."),
        media_id: null,
        verify_url: "https://example.com/",
        project_ids: [projects[0].id],
      });

      try {
        await page.goto(site("/en"));
        const section = page.locator("#testimonials");
        await expect(section).toBeVisible();
        await expect(section.getByRole("heading", { name: "Sample Author" })).toBeVisible();
        await expect(section.getByText("Python development")).toBeVisible();
        await expect(testimonialsLink(page).first()).toBeAttached();
        expect((await page.request.get(site("/en/testimonials"))).status()).toBe(200);
        expect(await (await page.request.get(site("/sitemap.xml"))).text()).toContain("/en/testimonials");
      } finally {
        await api.delete(`testimonials/${testimonial.id}`);
      }
    } finally {
      await api.dispose();
    }

    await expectTestimonialsHidden(page);
  });

  test("a project without monthly traffic has no traffic row", async ({ page }) => {
    await page.goto(site("/en/projects/gov-platform"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Government services platform");
    await expect(page.getByText("Development period")).toBeVisible();
    await expect(page.getByText("Monthly traffic")).toHaveCount(0);
  });

  test("a project under NDA shows the note instead of links and a gallery", async ({ page }) => {
    await page.goto(site("/en/projects/gov-platform"));
    await expect(page.getByText("Client project under NDA").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Live preview|Source code/ })).toHaveCount(0);
  });
});
