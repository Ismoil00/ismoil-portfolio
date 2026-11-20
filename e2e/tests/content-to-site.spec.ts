import { expect, test, type Page } from "../support/fixtures";
import { ADMIN_STATE, admin, site } from "../support/env";

// Edits made in the admin panel show on the public site straight away, in the right language only.
test.use({ storageState: ADMIN_STATE });

const saveChanges = (page: Page) => page.getByRole("button", { name: "Save changes" }).click();
/** The English input of a 3-language field (the EN tab is open by default). */
const englishField = (page: Page, label: string) => page.getByRole("textbox", { name: label, exact: true });

test.describe("Admin edits reach the public site", () => {
  test("the About title edited in English shows on the English site only", async ({ page }) => {
    await page.goto(site("/ru"));
    const russianTitle = await page.locator("#about h2").first().innerText();

    await page.goto(admin("/about"));
    const title = englishField(page, "Title");
    await expect(title).not.toHaveValue(""); // the form has loaded its saved values
    const original = await title.inputValue();
    const edited = "Engineer checked end to end";

    await title.fill(edited);
    await saveChanges(page);
    await expect(page.getByText("About saved.")).toBeVisible();

    try {
      await page.goto(site("/en"));
      await expect(page.locator("#about").getByRole("heading", { name: edited })).toBeVisible();
      await page.goto(site("/ru"));
      await expect(page.locator("#about h2").first()).toHaveText(russianTitle);
    } finally {
      await page.goto(admin("/about"));
      // Wait until the form shows the saved value: typing earlier is undone when the form finishes loading
      // (seen on the slower pipeline machines), and Save then has nothing to save.
      await expect(englishField(page, "Title")).toHaveValue(edited);
      await englishField(page, "Title").fill(original);
      await saveChanges(page);
      await expect(page.getByText("About saved.")).toBeVisible();
    }
  });

  test("the job-search status chosen in Hero changes the badge on the site", async ({ page }) => {
    await page.goto(admin("/hero"));
    await page.getByText("Open to good offers", { exact: true }).click();
    await saveChanges(page);
    await expect(page.getByText("Hero saved.")).toBeVisible();

    try {
      await page.goto(site("/en"));
      await expect(page.getByText("Open to new career opportunities")).toBeVisible();
    } finally {
      await page.goto(admin("/hero"));
      await page.getByText("Actively looking", { exact: true }).click();
      await saveChanges(page);
      await expect(page.getByText("Hero saved.")).toBeVisible();
    }
    await page.goto(site("/en"));
    await expect(page.getByText("Actively seeking new career opportunities")).toBeVisible();
  });

  test("the admin lists flag data that is still missing", async ({ page }) => {
    await page.goto(admin("/projects"));
    // The seeded projects have no monthly traffic yet (never invented).
    await expect(page.getByText("Missing: monthly traffic").first()).toBeVisible();
  });
});
