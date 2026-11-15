"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { IconType } from "react-icons";
import {
  LuBold,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
  LuRedo2,
  LuRemoveFormatting,
  LuStrikethrough,
  LuUnderline,
  LuUndo2,
} from "react-icons/lu";

/**
 * Rich-text editor for job descriptions: bold, italic, underline, strike-through, bullet and
 * numbered lists, links. Saves HTML; the backend keeps only these tags (allow-list).
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  invalid,
  placeholder = "Describe what you did…",
}: {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: { attributes: { id: id ?? "", class: "rich-text px-3.5 py-3 text-sm leading-relaxed" } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Text set from outside (loading a record, the Translate button) replaces the editor's content.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      aria-invalid={invalid || undefined}
      className="overflow-hidden rounded-xl border border-line bg-tint/[0.03] transition-[border-color,box-shadow] duration-200 focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20 hover:border-line-strong aria-[invalid=true]:border-danger/70"
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const input = window.prompt("Link address (https://… or mailto:…). Leave empty to remove the link.", previous ?? "https://");
    if (input === null) return;
    const href = input.trim();
    if (!href || href === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/[^\s]+\.[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(href)) {
      window.alert("Use a full link starting with https:// (or mailto: for an email).");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  const buttons: { label: string; icon: IconType; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { label: "Bold", icon: LuBold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: LuItalic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", icon: LuUnderline, active: state.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Strike-through", icon: LuStrikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { label: "Bullet list", icon: LuList, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: LuListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Link", icon: LuLink, active: state.link, run: setLink },
    { label: "Clear formatting", icon: LuRemoveFormatting, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
    { label: "Undo", icon: LuUndo2, disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
    { label: "Redo", icon: LuRedo2, disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-0.5 border-b border-line px-1.5 py-1">
      {buttons.map(({ label, icon: Icon, active, disabled, run }, i) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()} // keep the text selection
          onClick={run}
          className={`grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-30 ${
            active ? "bg-accent/15 text-accent" : "text-muted hover:bg-tint/[0.06] hover:text-fg"
          } ${i === 4 || i === 6 || i === 8 ? "ml-1.5" : ""}`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
