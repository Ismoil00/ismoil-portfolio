/**
 * Google Translate's free website, opened in a new tab with the English text filled in. The admin panel
 * never calls Google itself: you read the translation there and paste it back.
 */

/** The website translates at most this many characters at a time. */
export const GOOGLE_TRANSLATE_MAX = 5000;

export function googleTranslateUrl(target: "ru" | "tg", text?: string): string {
  const params = new URLSearchParams({ sl: "en", tl: target, op: "translate" });
  if (text) params.set("text", text);
  return `https://translate.google.com/?${params}`;
}

/**
 * Rich text (HTML) as plain text, keeping paragraphs and list bullets, for pasting into Google Translate.
 * DOMParser builds an inert document: nothing in the HTML runs or loads.
 */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("li").forEach((li) => li.prepend("• "));
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, li, h1, h2, h3, h4, blockquote").forEach((block) => block.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
