import { expect, test, type Locator, type Page } from "../support/fixtures";
import { ADMIN_STATE, SITE_URL, admin, site } from "../support/env";

// The AI assistant on the public site, used like a visitor would. The E2E backend answers with a stand-in
// for Groq (e2e/scripts/fake_chat_model.py): a short answer linking a seeded project, slowly when asked to.

const OPEN = { en: "Open the AI assistant", ru: "Открыть ИИ-ассистента", tg: "Кушодани ёрдамчии AI" };
const TITLE = { en: "AI assistant", ru: "ИИ-ассистент", tg: "Ёрдамчии AI" };
const FIRST_SUGGESTION = { en: "What has Ismoil built?", ru: "Что создал Исмоил?", tg: "Исмоил чӣ сохтааст?" };
const PROJECT = "Banking and public-sector backend"; // linked in the stand-in's answer

async function openChat(page: Page, locale: keyof typeof OPEN = "en"): Promise<Locator> {
  await page.getByRole("button", { name: OPEN[locale] }).click();
  const panel = page.getByRole("dialog", { name: TITLE[locale] });
  await expect(panel).toBeVisible();
  return panel;
}

const askBox = (panel: Locator) => panel.getByRole("textbox", { name: "Ask about projects, skills…" });

const LAUNCHER = { en: "Ask AI", ru: "Спросить ИИ", tg: "Пурсед аз AI" };

for (const locale of ["en", "ru", "tg"] as const) {
  test(`the assistant greets and suggests three questions (${locale})`, async ({ page }) => {
    await page.goto(site(`/${locale}`));
    // The launcher says what it is, not just a chat bubble.
    await expect(page.getByRole("button", { name: OPEN[locale] })).toContainText(LAUNCHER[locale]);
    const panel = await openChat(page, locale);
    await expect(panel.getByRole("button", { name: FIRST_SUGGESTION[locale] })).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(3);
  });
}

test("a suggested question gets an answer, written as it comes, with a link to the project", async ({ page }) => {
  await page.goto(site("/en"));
  const panel = await openChat(page);
  await panel.getByRole("button", { name: FIRST_SUGGESTION.en }).click();

  const log = panel.getByRole("log");
  await expect(log).toContainText("What has Ismoil built?");
  await expect(log.getByRole("listitem").filter({ hasText: "Government services platform" })).toBeVisible();
  await expect(panel.getByRole("listitem").filter({ hasText: FIRST_SUGGESTION.en })).toHaveCount(0); // suggestions gone

  await log.getByRole("link", { name: PROJECT }).click();
  await expect(page).toHaveURL(site("/en/projects/bank-backend"));
  await expect(panel).toBeVisible(); // on a large screen the chat stays open while browsing
});

test("Ask AI is there before the cookie choice, never under the banner, and the banner steps aside while chatting", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" }); // a first visit: no cookie choice yet
  const page = await context.newPage();
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
  try {
    for (const size of [
      { width: 1440, height: 900 }, // side by side
      { width: 1024, height: 768 }, // the button moves up above the banner
      { width: 390, height: 844 }, // a phone: the same
    ]) {
      await page.setViewportSize(size);
      await page.goto(site("/en"));
      const banner = page.getByRole("region", { name: "Cookies on this site" });
      const launcher = page.getByRole("button", { name: OPEN.en });
      await expect(banner).toBeVisible();
      await expect(launcher).toBeVisible();
      await expect.poll(async () => apart(await box(launcher), await box(banner)), { message: `${size.width}px` }).toBe(true);
    }

    const panel = await openChat(page);
    await expect(page.getByRole("region", { name: "Cookies on this site" })).toBeHidden();
    await panel.getByRole("button", { name: "Close the assistant" }).click();
    await expect(page.getByRole("region", { name: "Cookies on this site" })).toBeVisible(); // still no choice made
  } finally {
    await context.close();
  }
});

test("the conversation stays after a reload and on other pages, without any cookie consent", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([{ name: "consent", value: encodeURIComponent("v1:a0p0"), url: SITE_URL }]);
  const page = await context.newPage();
  try {
    await page.goto(site("/en"));
    let panel = await openChat(page);
    await panel.getByRole("button", { name: FIRST_SUGGESTION.en }).click();
    await expect(panel.getByRole("link", { name: PROJECT })).toBeVisible();

    await page.reload();
    panel = await openChat(page);
    await expect(panel.getByRole("log")).toContainText(FIRST_SUGGESTION.en);
    await expect(panel.getByRole("link", { name: PROJECT })).toBeVisible();

    await page.goto(site("/en/certificates"));
    panel = await openChat(page);
    await expect(panel.getByRole("link", { name: PROJECT })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("Enter sends; Stop keeps what was written; New chat starts over", async ({ page }) => {
  await page.goto(site("/en"));
  const panel = await openChat(page);
  await askBox(panel).fill("Tell me slowly about the projects");
  await askBox(panel).press("Enter");

  await expect(panel.getByRole("log")).toContainText("Ismoil built");
  await panel.getByRole("button", { name: "Stop" }).click();
  await expect(panel.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: PROJECT })).toHaveCount(0); // it stopped before the link
  await expect(panel.getByRole("log")).toContainText("Ismoil built");

  await panel.getByRole("button", { name: "New chat" }).click();
  await expect(panel.getByRole("log")).not.toContainText("Tell me slowly");
  await expect(panel.getByRole("button", { name: FIRST_SUGGESTION.en })).toBeVisible();
});

test("Escape and a click outside close the panel", async ({ page }) => {
  await page.goto(site("/en"));
  let panel = await openChat(page);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  panel = await openChat(page);
  await panel.getByRole("heading", { name: "AI assistant" }).click(); // a click inside keeps it open
  await expect(panel).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(panel).toBeHidden();
});

test("a visitor over the limit is told when to come back", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "300" },
      body: JSON.stringify({ code: "chat_limit" }),
    }),
  );
  await page.goto(site("/en"));
  const panel = await openChat(page);
  await panel.getByRole("button", { name: FIRST_SUGGESTION.en }).click();
  await expect(panel.getByRole("alert")).toHaveText(/You've asked a lot in a short time\. Try again in 5 min\./);
});

test("a failed answer can be asked again", async ({ page }) => {
  let refuse = true;
  await page.route("**/api/chat", async (route) => {
    if (!refuse) return route.continue();
    refuse = false;
    await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ code: "chat_failed" }) });
  });
  await page.goto(site("/en"));
  const panel = await openChat(page);
  await panel.getByRole("button", { name: FIRST_SUGGESTION.en }).click();
  await expect(panel.getByRole("alert")).toContainText("Something went wrong.");
  await panel.getByRole("button", { name: "Try again" }).click();
  await expect(panel.getByRole("link", { name: PROJECT })).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});

test("'Send this chat to Ismoil' fills the contact form, and the admin sees it marked as a chat", async ({
  page,
  browser,
}) => {
  const name = `Chat Visitor ${Date.now().toString(36)}`;
  await page.goto(site("/en/projects"));
  const panel = await openChat(page);
  await panel.getByRole("button", { name: FIRST_SUGGESTION.en }).click();
  await expect(panel.getByRole("link", { name: PROJECT })).toBeVisible();
  await panel.getByRole("button", { name: "Send this chat to Ismoil" }).click();

  await expect(page).toHaveURL(/\/en#contact$/);
  await expect(panel).toBeHidden();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send message" }) });
  const message = form.getByLabel("Your message");
  await expect(message).toHaveValue(/^Conversation with the site's AI assistant:\n\nQuestion: What has Ismoil built\?\nAnswer: Ismoil built three projects/);
  await expect(form.getByText("Your chat with the assistant is in the message.")).toBeVisible();
  await expect(form.getByLabel("Your name")).toBeFocused();

  await form.getByLabel("Your name").fill(name);
  await form.getByLabel("Your email or WhatsApp").fill("chat.visitor@example.com");
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByText("Message sent. I'll get back to you soon.")).toBeVisible();

  const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
  const adminPage = await adminContext.newPage();
  try {
    await adminPage.goto(admin("/contacts"));
    const row = adminPage.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("From chat");
    await expect(row).toContainText("Question: What has Ismoil built?");
  } finally {
    await adminContext.close();
  }
});

test("questions reach the admin's Top questions only from visitors who allowed analytics", async ({ page, browser }) => {
  const id = Date.now().toString(36);
  const shared = `Does Ismoil know Kubernetes? ${id}`;
  const private_ = `Private question ${id}`;

  await page.goto(site("/en"));
  const panel = await openChat(page);
  await askBox(panel).fill(shared);
  await askBox(panel).press("Enter");
  await expect(panel.getByRole("link", { name: PROJECT })).toBeVisible();

  // Someone who refused analytics cookies.
  const refused = await browser.newContext();
  await refused.addCookies([{ name: "consent", value: encodeURIComponent("v1:a0p0"), url: SITE_URL }]);
  const other = await refused.newPage();
  await other.goto(site("/en"));
  const otherPanel = await openChat(other);
  await askBox(otherPanel).fill(private_);
  await askBox(otherPanel).press("Enter");
  await expect(otherPanel.getByRole("link", { name: PROJECT })).toBeVisible();
  await refused.close();

  const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
  const adminPage = await adminContext.newPage();
  try {
    await adminPage.goto(admin("/analytics?days=7"));
    const list = adminPage.getByRole("list", { name: "Top questions" });
    await expect(list.getByText(shared, { exact: true })).toBeVisible();
    await expect(list.getByText(private_, { exact: true })).toHaveCount(0);

    // The free quota those questions used, with what's left, per model.
    await expect(adminPage.getByRole("heading", { name: "AI assistant: Groq free quota" })).toBeVisible();
    const requests = adminPage.getByRole("meter", { name: "openai/gpt-oss-120b: Requests, last 24 hours" });
    await expect(requests).toHaveAttribute("aria-valuenow", /^[1-9]\d*$/);
    await expect(requests).toHaveAttribute("aria-valuemax", "100000"); // the E2E backend's share (scripts/backend.py)
    await expect(adminPage.getByRole("meter", { name: "openai/gpt-oss-20b: Tokens, last minute" })).toBeVisible();
  } finally {
    await adminContext.close();
  }
});
