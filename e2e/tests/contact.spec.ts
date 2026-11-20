import { expect, test } from "../support/fixtures";
import { ADMIN_STATE, admin, site } from "../support/env";

test.describe("Contact form", () => {
  test("an incomplete form is refused, a complete one arrives in the admin panel and can be deleted", async ({
    page,
    browser,
  }) => {
    const name = "Visitor From E2E";

    await page.goto(site("/en#contact"));
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send message" }) });
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByText("Fill in every field with a valid email or WhatsApp number.")).toBeVisible();

    await form.getByLabel("Your name").fill(name);
    await form.getByLabel("Your email or WhatsApp").fill("visitor@example.com");
    await form.getByLabel("Your message").fill("Hello from the end-to-end tests.");
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByText("Message sent. I'll get back to you soon.")).toBeVisible();
    // The form is cleared for the next message.
    await expect(form.getByLabel("Your name")).toHaveValue("");

    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto(admin("/contacts"));
      const row = adminPage.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row).toContainText("visitor@example.com");

      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: `Delete the message from ${name}` }).click();
      await expect(adminPage.getByText("Message deleted.")).toBeVisible();
      await expect(row).toHaveCount(0);
    } finally {
      await adminContext.close();
    }
  });
});
