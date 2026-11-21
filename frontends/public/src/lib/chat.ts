/**
 * The AI assistant in the browser: asking (the answer arrives in pieces as it's written), keeping the
 * conversation while the tab is open, and handing a conversation over to the contact form ("Send this
 * chat to …").
 */

/** Fired on `window` with `detail: true | false` when the chat panel opens or closes (the cookie banner
 * steps aside while it's open). */
export const CHAT_PANEL = "chat-panel";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export const QUESTION_MAX = 500;
export const MAX_TURNS = 12; // questions in one conversation (the backend's limit too)

/** Codes the backend and the site's /api/chat route answer with, plus "network" for no answer at all. */
export type ChatErrorCode =
  | "chat_off"
  | "chat_limit"
  | "chat_busy"
  | "chat_turns"
  | "chat_failed"
  | "chat_bot"
  | "invalid"
  | "network";

const CODES = new Set<ChatErrorCode>(["chat_off", "chat_limit", "chat_busy", "chat_turns", "chat_failed", "chat_bot", "invalid"]);

export class ChatError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    readonly retryAfter: number | null = null,
  ) {
    super(code);
  }
}

function errorCode(value: unknown, status: number): ChatErrorCode {
  if (typeof value === "string" && CODES.has(value as ChatErrorCode)) return value as ChatErrorCode;
  return status === 422 ? "invalid" : "chat_failed";
}

/**
 * Asks the assistant. `onText` gets each piece of the answer as it's written. Throws ChatError when the
 * question is refused or the answer can't be finished; an AbortError when `signal` stops it.
 */
export async function askAssistant(options: {
  messages: ChatMessage[];
  locale: string;
  page: string;
  signal: AbortSignal;
  onText: (piece: string) => void;
}): Promise<void> {
  const { messages, locale, page, signal, onText } = options;
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, locale, page }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ChatError("network");
  }

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    const retry = Number(response.headers.get("retry-after"));
    throw new ChatError(errorCode(data?.code, response.status), Number.isFinite(retry) && retry > 0 ? retry : null);
  }

  // One JSON object per line: {"type":"text","text":…}…, then {"type":"done"} or {"type":"error","code":…}.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: { type?: string; text?: string; code?: string };
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === "text" && typeof event.text === "string") onText(event.text);
      else if (event.type === "error") throw new ChatError(errorCode(event.code, 500));
      else if (event.type === "done") return;
    }
    if (done) throw new ChatError("chat_failed"); // ended without "done": cut off
  }
}

// --- the conversation in the open tab ---------------------------------------------------------------

const HISTORY_KEY = "chat-history";

/**
 * The conversation is kept in this tab (sessionStorage), so a reload or another page doesn't lose it; the
 * browser deletes it when the tab is closed. It's part of the chat the visitor started, so, like a
 * shopping cart, it needs no cookie consent (it's listed as "necessary" on the cookie page).
 */
export function loadHistory(): ChatMessage[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]) {
  try {
    if (messages.length) sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    else sessionStorage.removeItem(HISTORY_KEY);
  } catch {
    // Storage blocked: the conversation lasts until the page is left.
  }
}

// --- "Send this chat to …" ----------------------------------------------------------------------

export const CONTACT_DRAFT = "contact-draft";
const ANSWER_CHARS = 200;
// The contact form's message holds 2,000 characters; some room is left for the visitor's own words.
const TRANSCRIPT_MAX = 1_700;

/** Markdown as plain text: "[text](address)" → "text (address)", no ** marks. */
function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => (label === href ? href : `${label} (${href})`))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}

/**
 * The conversation as the contact form's message: questions in full, answers shortened, the newest
 * exchanges kept when it doesn't all fit.
 */
export function transcriptFor(
  messages: ChatMessage[],
  labels: { heading: string; question: string; answer: string; omitted: string },
): string {
  const exchanges: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    let block = `${labels.question}: ${messages[i].content.trim()}`;
    const reply = messages[i + 1]?.role === "assistant" ? plainText(messages[i + 1].content) : "";
    if (reply) {
      const short = reply.length > ANSWER_CHARS ? `${reply.slice(0, ANSWER_CHARS - 1).trimEnd()}…` : reply;
      block += `\n${labels.answer}: ${short}`;
    }
    exchanges.push(block);
  }
  const kept: string[] = [];
  let length = labels.heading.length;
  for (const block of [...exchanges].reverse()) {
    if (length + block.length + 2 > TRANSCRIPT_MAX && kept.length) break;
    kept.unshift(block.slice(0, TRANSCRIPT_MAX - labels.heading.length - 2));
    length += block.length + 2;
  }
  const omitted = kept.length < exchanges.length ? `\n${labels.omitted}` : "";
  return `${labels.heading}${omitted}\n\n${kept.join("\n\n")}`;
}

/** Leaves the text for the contact form (even if it's on another page) and tells a form already shown. */
export function handOffToContact(text: string) {
  try {
    sessionStorage.setItem(CONTACT_DRAFT, text);
  } catch {
    // Storage blocked: only a form already on the page gets it, through the event.
  }
  window.dispatchEvent(new CustomEvent(CONTACT_DRAFT, { detail: text }));
}

/** The text left by handOffToContact, once. */
export function takeContactDraft(): string | null {
  try {
    const text = sessionStorage.getItem(CONTACT_DRAFT);
    sessionStorage.removeItem(CONTACT_DRAFT);
    return text;
  } catch {
    return null;
  }
}
