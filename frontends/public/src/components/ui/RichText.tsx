import { Fragment } from "react";

/**
 * Renders plain text where **double-asterisk** parts are emphasized (bolder + underlined).
 * Keeps content as simple strings, so it works the same for static data, all 3 languages,
 * and text that will later be edited in the admin panel.
 */
export function RichText({ text, emphasisClassName = "" }: { text: string; emphasisClassName?: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g); // odd indexes are the emphasized parts

  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <strong
            key={i}
            className={`font-medium text-fg underline decoration-accent/70 decoration-2 underline-offset-[5px] ${emphasisClassName}`}
          >
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
