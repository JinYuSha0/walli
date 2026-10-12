import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useTranslation } from "react-i18next";
import { PasteMarkdown } from "./markdown-paste";
import { cn } from "@/lib/utils";

const commands = [
  { key: "paragraph", run: (editor: Editor) => editor.chain().focus().setParagraph().run() },
  ...([1, 2, 3] as const).map((level) => ({
    key: `heading${level}`, level,
    run: (editor: Editor) => editor.chain().focus().setHeading({ level }).run(),
  })),
  { key: "list", run: (editor: Editor) => editor.chain().focus().toggleBulletList().run() },
  { key: "orderedList", run: (editor: Editor) => editor.chain().focus().toggleOrderedList().run() },
  { key: "quote", run: (editor: Editor) => editor.chain().focus().toggleBlockquote().run() },
  { key: "code", run: (editor: Editor) => editor.chain().focus().setCodeBlock().run() },
  { key: "divider", run: (editor: Editor) => editor.chain().focus().setHorizontalRule().run() },
];

export function SlashMarkdownEditor({ value, onChange, onBlur, id, invalid, disabled = false }: {
  value: string; onChange: (value: string) => void; onBlur?: () => void;
  id: string; invalid?: boolean; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      Image.configure({ HTMLAttributes: { class: "my-3 h-auto max-w-full rounded-lg" } }), PasteMarkdown],
    content: value, contentType: "markdown", immediatelyRender: false, editable: !disabled,
    editorProps: {
      attributes: {
        id, role: "textbox", "aria-multiline": "true", "aria-labelledby": `${id}-label`, "aria-describedby": `${id}-hint`,
        class: "min-h-80 p-4 outline-none [&_p]:my-2 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_a]:underline",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); onBlur?.(); },
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== value)
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  const state = useEditorState({ editor, selector: ({ editor }) => {
    if (!editor) return null;
    const { empty, from, $from } = editor.state.selection;
    const text = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc");
    const match = empty && $from.parent.type.name === "paragraph" ? /^\/([^/\s]*)$/.exec(text) : null;
    const coordinates = match ? editor.view.coordsAtPos(from) : null;
    const bounds = match ? editor.view.dom.closest('[data-slot="slash-markdown-editor"]')?.getBoundingClientRect() : null;
    return { position: coordinates && bounds ? { top: coordinates.bottom - bounds.top, left: Math.max(0, Math.min(coordinates.left - bounds.left, bounds.width - 224)) } : null, characters: editor.getText().length,
      slash: match ? { from: $from.start(), to: from, query: match[1], identity: `${from}:${text}` } : null };
  } });
  const slash = state?.slash;
  const items = commands.map((command) => ({ ...command,
    label: "level" in command ? t("datasets.headingLevel", { level: command.level })
      : command.key === "paragraph" ? t("datasets.paragraph") : t(`datasets.format.${command.key}`),
  })).filter((command) => !slash?.query || `${command.key} ${command.label}`.toLocaleLowerCase().includes(slash.query.toLocaleLowerCase()));
  const open = !!slash && slash.identity !== dismissed && !disabled && focused;
  const selected = highlighted % Math.max(items.length, 1);
  const choose = (index: number) => {
    if (!editor || !slash || !items[index]) return;
    editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
    items[index].run(editor); setHighlighted(0);
  };
  return (
    <div data-slot="slash-markdown-editor" className={cn("relative rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/30", invalid && "border-destructive")}
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "/") { setDismissed(null); setHighlighted(0); }
        if (!open) return;
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(slash.identity); }
        else if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) && items.length) {
          event.preventDefault(); event.stopPropagation();
          if (event.key === "Enter") choose(selected);
          else setHighlighted((selected + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
        }
      }}>
      <EditorContent editor={editor} />
      {open && state?.position && (
        <div role="menu" aria-label={t("datasets.formatting")}
          className="absolute z-50 grid max-h-64 w-56 max-w-full gap-1 overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          style={state.position}>
          {items.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">{t("markdownNoCommands")}</p>}
          {items.map((item, index) => (
            <button key={item.key} type="button" role="menuitem"
              className={cn("rounded-md px-3 py-2 text-left text-sm", index === selected && "bg-accent text-accent-foreground")}
              onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(index)}
              ref={(element) => { if (index === selected) element?.scrollIntoView({ block: "nearest" }); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span id={`${id}-hint`}>{t("markdownSlashHint")}</span>
        <span>{t("datasets.characterCount", { count: state?.characters ?? 0 })}</span>
      </div>
    </div>
  );
}
