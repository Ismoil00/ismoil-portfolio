import { Fragment, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * The assistant's answer as safe React elements (never HTML): paragraphs, "- " lists, **bold** and links.
 * Links work only to the site's own pages ("/projects/…", through the locale-aware Link) and to https://
 * or mailto: addresses (in a new tab); anything else stays plain text.
 */

// [text](address), **bold**, a bare https:// address, or a bare page of this site ("/projects/shop").
const INLINE =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|(https:\/\/[^\s)<>"]+[^\s)<>".,;:!?])|(?<=^|[\s(])(\/(?:projects|experience|certificates|testimonials)(?:\/[\w-]+)?|\/#contact)(?=$|[\s).,;:!?])/g;
const SITE_PAGE = /^\/(?:projects|experience|certificates|testimonials)(?:\/[\w-]+)?$|^\/#contact$/;

function link(text: string, href: string, key: number, onNavigate?: () => void): ReactNode {
  const className = "font-medium text-accent underline underline-offset-2 hover:brightness-110";
  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link key={key} href={href} className={className} onClick={onNavigate}>
        {text}
      </Link>
    );
  }
  if (href.startsWith("https://") || href.startsWith("mailto:")) {
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        {text}
      </a>
    );
  }
  return <Fragment key={key}>{text}</Fragment>;
}

function inline(text: string, onNavigate?: () => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const [whole, label, href, bold, url, page] = match;
    if (label && href) parts.push(link(label, href, key++, onNavigate));
    else if (bold && SITE_PAGE.test(bold.trim())) parts.push(link(bold.trim(), bold.trim(), key++, onNavigate));
    else if (bold) parts.push(<strong key={key++} className="font-semibold text-fg">{bold}</strong>);
    else if (url) parts.push(link(url, url, key++, onNavigate));
    else if (page) parts.push(link(page, page, key++, onNavigate));
    else parts.push(whole);
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

type Group = { list: boolean; lines: string[] };

/** Lines grouped into paragraphs and lists: a run of list lines is a list, other lines a paragraph; a
 * blank line always starts a new group. */
function groups(text: string): Group[] {
  const result: Group[] = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    let current: Group | null = null;
    for (const line of block.split("\n").filter((l) => l.trim())) {
      const list = ITEM.test(line);
      if (current && current.list === list) current.lines.push(line);
      else result.push((current = { list, lines: [line] }));
    }
  }
  return result;
}

export function ChatText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-2">
      {groups(text).map((group, i) =>
        group.list ? (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-accent">
            {group.lines.map((line, j) => (
              <li key={j}>{inline(line.replace(ITEM, ""), onNavigate)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {inline(group.lines.join("\n"), onNavigate)}
          </p>
        ),
      )}
    </div>
  );
}
