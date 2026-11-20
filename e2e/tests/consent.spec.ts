import { expect, test, type Browser, type BrowserContext, type Page } from "../support/fixtures";
import { ADMIN_STATE, admin, site } from "../support/env";

// The cookie banner, with first-time visitors (fresh browsers without the "consent" cookie the other
// tests get), and the visits it lets through reaching the admin panel's Analytics page.

// A regular browser name: the backend leaves out "headless" browsers as bots.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0";

// Reduced motion: the banner floats otherwise, and a moving element can't be clicked reliably.
const newVisitor = (browser: Browser) => browser.newContext({ userAgent: USER_AGENT, reducedMotion: "reduce" });
const cookie = async (context: BrowserContext, name: string) =>
  (await context.cookies(site("/"))).find((c) => c.name === name)?.value;

test("rejecting cookies stores nothing optional, and the choice is remembered", async ({ browser }) => {
  const context = await newVisitor(browser);
  const page = await context.newPage();
  await page.goto(site("/en"));

  const banner = page.getByRole("region", { name: "Cookies on this site" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Reject" }).click();
  await expect(banner).toBeHidden();

  // The theme still switches, but isn't remembered without consent to preferences.
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
  await expect(banner).toBeHidden(); // asked once

  expect(decodeURIComponent((await cookie(context, "consent")) ?? "")).toBe("v1:a0p0");
  expect(await cookie(context, "vid")).toBeUndefined();
  await context.close();
});

test("the settings panel saves a partial choice and reopens from the footer", async ({ browser }) => {
  const context = await newVisitor(browser);
  const page = await context.newPage();
  await page.goto(site("/ru"));

  await page.getByRole("button", { name: "Настроить" }).click();
  const panel = page.getByRole("dialog", { name: "Настройки cookie" });
  await expect(panel.getByRole("switch", { name: "Необходимые" })).toBeChecked();
  await expect(panel.getByRole("switch", { name: "Необходимые" })).toBeDisabled();
  await panel.getByRole("switch", { name: "Аналитика" }).check({ force: true });
  await panel.getByRole("button", { name: "Сохранить выбор" }).click();
  await expect(panel).toBeHidden();
  expect(decodeURIComponent((await cookie(context, "consent")) ?? "")).toBe("v1:a1p0");

  // Analytics allowed: the next page view brings the anonymous visitor id.
  await page.goto(site("/ru/projects"));
  await expect.poll(() => cookie(context, "vid")).toMatch(/^[0-9a-f-]{36}$/);

  // Changing the choice later, straight from the footer.
  await page.getByRole("contentinfo").getByRole("button", { name: "Настройки cookie" }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("switch", { name: "Аналитика" })).toBeChecked();
  await panel.getByRole("button", { name: "Отклонить все" }).click();
  expect(await cookie(context, "vid")).toBeUndefined(); // withdrawing removes the id
  await context.close();
});

test("the settings panel closes with a click outside it, without saving", async ({ page, context }) => {
  await page.goto(site("/en"));
  const open = () => page.getByRole("contentinfo").getByRole("button", { name: "Cookie settings" }).click();
  const panel = page.getByRole("dialog", { name: "Cookie settings" });
  await open();
  await expect(panel).toBeVisible();

  await panel.getByRole("switch", { name: "Analytics" }).uncheck({ force: true });
  await panel.getByText("Choose what the site may store").click(); // a click inside keeps it open
  await expect(panel).toBeVisible();

  await page.mouse.click(8, 8); // the dimmed area around the panel
  await expect(panel).toBeHidden();
  expect(decodeURIComponent((await cookie(context, "consent")) ?? "")).toBe("v1:a1p1"); // nothing saved

  await open();
  await expect(panel.getByRole("switch", { name: "Analytics" })).toBeChecked(); // the saved choice again
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("the footer's cookie policy link opens the page listing what is stored", async ({ page }) => {
  await page.goto(site("/en"));
  await page.getByRole("contentinfo").getByRole("link", { name: "Cookie policy" }).click();
  await expect(page).toHaveURL(site("/en/cookies"));
  await expect(page.getByRole("heading", { name: "Cookie policy", level: 1 })).toBeVisible();
  await expect(page.getByText(/vid — a random anonymous ID/)).toBeVisible();
});

// The footer's height, and the empty space left below it (the page shorter than the window).
const footerBox = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector("footer")!.getBoundingClientRect();
    const below = document.documentElement.scrollHeight - (box.bottom + window.scrollY);
    return { height: Math.round(box.height), below: Math.round(below) };
  });

test("the cookie page's footer is like every other page's: same height, at the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1200 }); // taller than the cookie page itself
  for (const locale of ["en", "ru", "tg"]) {
    await page.goto(site(`/${locale}`));
    const home = await footerBox(page);
    await page.goto(site(`/${locale}/cookies`));
    const cookies = await footerBox(page);
    expect(cookies.height, locale).toBe(home.height);
    expect(cookies.below, `${locale}: space below the footer`).toBe(0);
  }
});

test("visits show on the admin Analytics page", async ({ browser }) => {
  const visitor = await newVisitor(browser);
  const page = await visitor.newPage();
  await page.goto(site("/en"));
  await page.getByRole("region", { name: "Cookies on this site" }).getByRole("button", { name: "Accept all" }).click();
  const path = "/en/certificates";
  await page.goto(site(path));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await visitor.close();

  const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
  const adminPage = await adminContext.newPage();
  // Events are sent in the background: reload until this one has arrived.
  await expect(async () => {
    await adminPage.goto(admin("/analytics?days=7"));
    await expect(adminPage.getByRole("list", { name: "Pages" }).getByText(path, { exact: true })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(adminPage.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await adminContext.close();
});
