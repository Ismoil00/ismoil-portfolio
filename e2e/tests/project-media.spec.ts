import { expect, test, type Page } from "@playwright/test";
import { adminApi, i18n } from "../support/admin-api";
import { ADMIN_STATE, admin, site } from "../support/env";

// Projects: a video or an image can be the cover. On a card only its play / expand button opens it
// full size; anywhere else (the rest of the cover too) opens the project page. The admin shows
// every uploaded file full size, and the description is rich text.
test.use({ storageState: ADMIN_STATE });

// The start of an MP4 file: enough for the upload checks (the tests never need it to play).
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from("ftypisom"),
  Buffer.from([0, 0, 2, 0]),
  Buffer.from("isomiso2avc1mp41"),
  Buffer.alloc(200),
]);

const TITLE = "Video cover check";

/** Clicks the card's cover near its bottom-left corner: away from the number and the buttons. */
async function clickCoverEdge(page: Page) {
  const card = page.locator("article").filter({ has: page.getByRole("link", { name: `Open project: ${TITLE}` }) });
  const cover = card.locator("div.relative").first();
  await cover.scrollIntoViewIfNeeded();
  const box = (await cover.boundingBox())!;
  await page.mouse.click(box.x + 24, box.y + box.height - 16);
}

test("cover buttons open the media; the rest of the card opens the project page", async ({ page }) => {
  // Real image files: screenshots of the site.
  await page.goto(site("/en"));
  const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 320, height: 180 } });
  const jpeg = await page.screenshot({ type: "jpeg", clip: { x: 0, y: 0, width: 320, height: 180 } });

  const api = await adminApi();
  try {
    const web = await api.selector("product-types", "Web");
    const python = await api.selector("tech-stacks", "Python");
    const image = await api.upload("project_image", { name: "shot.png", mimeType: "image/png", buffer: png });
    const video = await api.upload("project_video", { name: "demo.mp4", mimeType: "video/mp4", buffer: MP4 }, { poster: jpeg, width: 1280, height: 720 });
    const body = {
      title: i18n(TITLE),
      slug: null,
      description: i18n("<p>Rich <strong>text</strong> works.</p><ul><li>One point</li></ul>"),
      start: "2025-01",
      end: "2025-02",
      client_kind: "self",
      company_id: null,
      traffic: "under100",
      live_url: "https://example.com/",
      repo_url: null,
      is_private: false,
      type_ids: [web.id],
      tech_ids: [python.id],
      media_ids: [image.id, video.id],
      cover_id: video.id,
    };
    const project = await api.post<{ id: string; slug: string }>("projects", body);

    try {
      // Video cover: the play button plays it on the list page…
      await page.goto(site("/en/projects"));
      await page.getByRole("button", { name: `Play the video of ${TITLE}` }).click();
      const viewer = page.getByRole("dialog", { name: TITLE });
      await expect(viewer.locator("video")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(viewer).toHaveCount(0);
      await expect(page).toHaveURL(/\/en\/projects$/);
      // …while the rest of the video opens the project page.
      await clickCoverEdge(page);
      await expect(page).toHaveURL(new RegExp(`/en/projects/${project.slug}$`));

      // The description keeps its formatting.
      await expect(page.locator(".rich-text strong", { hasText: "text" })).toBeVisible();
      await expect(page.locator(".rich-text li", { hasText: "One point" })).toBeVisible();

      // Admin list: the video cover shows its first frame (the poster), not a broken image.
      await page.goto(admin("/projects"));
      const thumb = page.getByRole("link", { name: new RegExp(TITLE) }).locator("img");
      await expect(thumb).toHaveAttribute("src", /\/media\/poster\//);
      expect(await thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

      // Admin editor: rich text, the star on the video, and every file opens full size.
      await page.goto(admin(`/projects/${project.id}`));
      await expect(page.getByRole("toolbar", { name: "Formatting" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Use demo.mp4 as cover" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Open shot.png full size" }).click();
      await expect(page.getByRole("dialog", { name: "shot.png" }).getByRole("img", { name: "shot.png" })).toBeVisible();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("dialog", { name: "demo.mp4" }).locator("video")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Image cover: the expand button opens the image; the rest of the image opens the page.
      await api.put(`projects/${project.id}`, { ...body, cover_id: image.id });
      await page.goto(site("/en/projects"));
      await page.getByRole("button", { name: `Open the image of ${TITLE} full size` }).click();
      await expect(page.getByRole("dialog", { name: TITLE }).locator("img")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/en\/projects$/);
      await clickCoverEdge(page);
      await expect(page).toHaveURL(new RegExp(`/en/projects/${project.slug}$`));
    } finally {
      await api.delete(`projects/${project.id}`);
    }
  } finally {
    await api.dispose();
  }
});
