import { expect, test } from "../support/fixtures";
import { LOCALES, site } from "../support/env";

// Any address the site doesn't have shows the site's own 404 page: inside the usual header and
// footer, in the visitor's language and theme, with a real 404 status for search engines.

const TITLE = { en: "Page not found", ru: "Страница не найдена", tg: "Саҳифа ёфт нашуд" };
const HOME = { en: "Back to home", ru: "На главную", tg: "Ба саҳифаи асосӣ" };

for (const locale of LOCALES) {
  test(`an unknown address shows the site's 404 page (${locale})`, async ({ page }) => {
    const response = await page.goto(site(`/${locale}/no-such-page/at-all`));
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(new RegExp(TITLE[locale]));
    await expect(page.getByRole("heading", { level: 1, name: TITLE[locale] })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible(); // the site's header…
    await expect(page.getByRole("contentinfo")).toBeVisible(); // …and footer around it

    await page.getByRole("main").getByRole("link", { name: HOME[locale] }).click();
    await expect(page).toHaveURL(site(`/${locale}`));
  });
}

test("addresses without a language, and unknown projects, show the same page", async ({ page }) => {
  for (const path of ["/no-such-page", "/en/projects/no-such-project"]) {
    const response = await page.goto(site(path));
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: TITLE.en }), path).toBeVisible();
  }
});

test("the 404 page follows the theme and links to the main sections", async ({ page }) => {
  await page.goto(site("/en/no-such-page"));
  const home = page.getByRole("main").getByRole("link", { name: HOME.en });
  const background = () => home.evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect.poll(background).toBe("rgb(164, 196, 255)"); // the dark theme's accent
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect.poll(background).toBe("rgb(37, 99, 235)"); // the light theme's accent

  const sections = page.getByRole("navigation", { name: "Site sections" });
  await expect(sections.getByRole("link")).toHaveText(["Projects", "Experience", "Certificates", "Contact"]);
  await sections.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(site("/en/projects"));
});
