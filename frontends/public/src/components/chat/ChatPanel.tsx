"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LuBot, LuMail, LuRotateCcw, LuSendHorizontal, LuSquare, LuX } from "react-icons/lu";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ChatError,
  MAX_TURNS,
  QUESTION_MAX,
  askAssistant,
  handOffToContact,
  loadHistory,
  saveHistory,
  transcriptFor,
  type ChatErrorCode,
  type ChatMessage,
} from "@/lib/chat";
import { ChatText } from "./ChatText";

type Props = {
  id: string;
  open: boolean;
  /** Phone layout: the panel fills the screen. */
  phone: boolean;
  /** The site owner's first name, for the greeting and suggestions. */
  name: string;
  onClose: () => void;
};

type Problem = { code: ChatErrorCode; retryAfter: number | null };

// Errors where asking the same question again can help.
const RETRY = new Set<ChatErrorCode>(["chat_failed", "network", "chat_busy", "chat_bot"]);

export function ChatPanel({ id, open, phone, name, onClose }: Props) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();

  // The conversation of this tab survives reloads and other pages (lib/chat.ts): the panel starts from it
  // (it's only ever rendered in the browser, after the visitor opens the chat) and saves it whenever an
  // answer is complete.
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const abort = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) saveHistory(messages);
  }, [messages, busy]);
  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (open) field.current?.focus({ preventScroll: true });
  }, [open]);

  // Follow the answer as it's written.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, waiting, problem]);

  const turns = messages.filter((m) => m.role === "user").length;

  const ask = useCallback(
    async (question: string, before: ChatMessage[]) => {
      const text = question.trim().slice(0, QUESTION_MAX);
      if (!text || abort.current) return;
      if (before.filter((m) => m.role === "user").length >= MAX_TURNS) {
        setProblem({ code: "chat_turns", retryAfter: null });
        return;
      }
      const asked: ChatMessage[] = [...before, { role: "user", content: text }];
      setMessages(asked);
      setInput("");
      setProblem(null);
      setBusy(true);
      setWaiting(true);
      const controller = new AbortController();
      abort.current = controller;
      let answer = "";
      try {
        await askAssistant({
          messages: asked,
          locale,
          page: pathname,
          signal: controller.signal,
          onText: (piece) => {
            answer += piece;
            setWaiting(false);
            setMessages([...asked, { role: "assistant", content: answer }]);
          },
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setProblem(
            error instanceof ChatError
              ? { code: error.code, retryAfter: error.retryAfter }
              : { code: "chat_failed", retryAfter: null },
          );
        }
      } finally {
        abort.current = null;
        setBusy(false);
        setWaiting(false);
      }
    },
    [locale, pathname],
  );

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    void ask(input, messages);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  };

  // Asks the last question again (after an error), without its unfinished answer.
  const retry = () => {
    const last = messages.findLastIndex((m) => m.role === "user");
    if (last >= 0) void ask(messages[last].content, messages.slice(0, last));
  };

  const stop = () => abort.current?.abort();

  const newChat = () => {
    stop();
    setMessages([]);
    setProblem(null);
    setInput("");
    field.current?.focus({ preventScroll: true });
  };

  const sendToOwner = () => {
    handOffToContact(
      transcriptFor(messages, {
        heading: t("transcript.heading"),
        question: t("transcript.question"),
        answer: t("transcript.answer"),
        omitted: t("transcript.omitted"),
      }),
    );
    onClose();
    if (pathname === "/") document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
    // The contact form scrolls itself into view once it has the text (ContactForm); the router would
    // otherwise jump to the top of the new page after it.
    else router.push("/#contact", { scroll: false });
  };

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const answered = !busy && messages.some((m) => m.role === "assistant");
  const minutes = Math.max(1, Math.ceil((problem?.retryAfter ?? 60) / 60));
  const iconButton =
    "inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-tint hover:text-fg focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <section
      id={id}
      role="dialog"
      aria-modal={phone || undefined}
      aria-labelledby={titleId}
      hidden={!open}
      className="fixed inset-0 z-50 flex flex-col bg-surface text-fg motion-safe:animate-chat-in sm:inset-auto sm:bottom-24 sm:right-5 sm:z-40 sm:mr-[var(--scrollbar-lock,0px)] sm:h-[min(36rem,calc(100svh-8rem))] sm:w-[min(24rem,calc(100vw-2.5rem))] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-bg">
          <LuBot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-base font-semibold leading-tight">
            {t("title")}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
            {t("status")}
          </p>
        </div>
        <button type="button" onClick={newChat} aria-label={t("newChat")} title={t("newChat")} className={iconButton}>
          <LuRotateCcw className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={onClose} aria-label={t("close")} title={t("close")} className={iconButton}>
          <LuX className="size-4" aria-hidden />
        </button>
      </header>

      <div ref={list} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 text-sm leading-relaxed">
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-bg/60 px-3.5 py-2.5">
          <span className="sr-only">{t("assistant")}: </span>
          {t("greeting", { name })}
        </div>

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md bg-accent/15 px-3.5 py-2.5">
              <span className="sr-only">{t("you")}: </span>
              {m.content}
            </div>
          ) : (
            <div key={i} className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-bg/60 px-3.5 py-2.5">
              <span className="sr-only">{t("assistant")}: </span>
              <ChatText text={m.content} onNavigate={phone ? onClose : undefined} />
            </div>
          ),
        )}

        {waiting && (
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-bg/60 px-4 py-3.5">
            <span className="sr-only">{t("thinking")}</span>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                aria-hidden
                style={{ animationDelay: `${delay}ms` }}
                className="size-1.5 rounded-full bg-muted motion-safe:animate-chat-dot"
              />
            ))}
          </div>
        )}

        {messages.length === 0 && (
          <ul className="space-y-2 pt-2" aria-label={t("title")}>
            {[0, 1, 2].map((i) => {
              const suggestion = t(`suggestions.${i}`, { name });
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void ask(suggestion, messages)}
                    className="w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-left transition-colors hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {suggestion}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {problem && (
          <div role="alert" className="space-y-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-red-300 light:text-red-700">
            <p>{t(`errors.${problem.code}`, { minutes })}</p>
            {problem.code === "chat_turns" ? (
              <button type="button" onClick={newChat} className="font-medium underline underline-offset-2">
                {t("newChat")}
              </button>
            ) : (
              RETRY.has(problem.code) && (
                <button type="button" onClick={retry} className="font-medium underline underline-offset-2">
                  {t("retry")}
                </button>
              )
            )}
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t border-line px-3 pb-3 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-bg/60 p-1.5 pl-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <textarea
            ref={field}
            rows={1}
            value={input}
            maxLength={QUESTION_MAX}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            onChange={(e) => {
              setInput(e.target.value);
              grow(e.target);
            }}
            onKeyDown={onKeyDown}
            disabled={turns >= MAX_TURNS && !busy}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-fg outline-none placeholder:text-faint disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label={t("stop")}
              title={t("stop")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition hover:brightness-110"
            >
              <LuSquare className="size-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label={t("send")}
              title={t("send")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-bg transition hover:brightness-110 disabled:opacity-40"
            >
              <LuSendHorizontal className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-faint">
          <span>{input.length > QUESTION_MAX - 100 ? `${input.length}/${QUESTION_MAX}` : t("disclaimer")}</span>
          {answered && (
            <button type="button" onClick={sendToOwner} className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline">
              <LuMail className="size-3.5" aria-hidden />
              {t("sendToOwner", { name })}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
