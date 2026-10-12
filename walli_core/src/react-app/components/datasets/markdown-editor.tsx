import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Minus,
  Undo2,
  Redo2,
  Link2,
  Unlink,
  RemoveFormatting,
} from "lucide-react";

const PasteMarkdown = Markdown.extend({
  // Run before StarterKit's code block paste handler for editor clipboard data.
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const clipboard = event.clipboardData;
            const text = clipboard?.getData("text/plain");
            const sourceMetadata = clipboard?.getData("vscode-editor-data");
            if (sourceMetadata) {
              try {
                const { mode } = JSON.parse(sourceMetadata);
                if (mode && mode !== "markdown" && mode !== "plaintext") return false;
              } catch {
                // Ignore malformed optional metadata and inspect the content.
              }
            }
            const html = clipboard?.getData("text/html");
            const hasMarkdownBlocks = /^ {0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|`{3}|~{3})/m.test(text ?? "");
            // Source editors can attach HTML to raw Markdown. Prefer Markdown
            // when block syntax is present, but preserve ordinary rich text.
            if (
              !text ||
              (html && !hasMarkdownBlocks) ||
              view.state.selection.$from.parent.type.spec.code ||
              !this.editor.markdown
            )
              return false;
            try {
              const document = view.state.schema.nodeFromJSON(this.editor.markdown.parse(text));
              view.dispatch(
                view.state.tr
                  .replaceSelection(Slice.maxOpen(document.content))
                  .setMeta("paste", true)
                  .setMeta("uiEvent", "paste")
                  .scrollIntoView(),
              );
              return true;
            } catch {
              return false;
            }
          },
        },
      }),
    ];
  },
});

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  id,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      Image.configure({
        HTMLAttributes: {
          class: "my-3 h-auto max-w-full rounded-lg",
          loading: "lazy",
        },
      }),
      PasteMarkdown,
    ],
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": `${id}-label`,
        class:
          "min-h-80 p-4 outline-none [&_p]:my-2 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_pre]:bg-muted [&_pre]:p-3 [&_a]:underline",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onBlur: () => onBlur?.(),
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== value)
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold"),
      italic: editor?.isActive("italic"),
      strike: editor?.isActive("strike"),
      inlineCode: editor?.isActive("code"),
      list: editor?.isActive("bulletList"),
      orderedList: editor?.isActive("orderedList"),
      quote: editor?.isActive("blockquote"),
      code: editor?.isActive("codeBlock"),
      link: editor?.isActive("link"),
      heading: editor?.isActive("heading") ? String(editor.getAttributes("heading").level) : "0",
      undo: editor?.can().undo(),
      redo: editor?.can().redo(),
      characters: editor?.getText().length ?? 0,
    }),
  });
  const applyLink = () => {
    if (!editor) return;
    const href = linkUrl.trim();
    try {
      if (!["https:", "http:", "mailto:"].includes(new URL(href).protocol))
        throw new Error("Invalid protocol");
    } catch {
      setLinkError(true);
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
    setLinkError(false);
  };
  const groups = editor
    ? [
        [
          {
            key: "undo",
            Icon: Undo2,
            disabled: !state?.undo,
            active: false,
            run: () => editor.chain().focus().undo().run(),
          },
          {
            key: "redo",
            Icon: Redo2,
            disabled: !state?.redo,
            active: false,
            run: () => editor.chain().focus().redo().run(),
          },
        ],
        [
          {
            key: "bold",
            Icon: Bold,
            active: state?.bold,
            run: () => editor.chain().focus().toggleBold().run(),
          },
          {
            key: "italic",
            Icon: Italic,
            active: state?.italic,
            run: () => editor.chain().focus().toggleItalic().run(),
          },
          {
            key: "strike",
            Icon: Strikethrough,
            active: state?.strike,
            run: () => editor.chain().focus().toggleStrike().run(),
          },
          {
            key: "inlineCode",
            Icon: Code,
            active: state?.inlineCode,
            run: () => editor.chain().focus().toggleCode().run(),
          },
        ],
        [
          {
            key: "list",
            Icon: List,
            active: state?.list,
            run: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            key: "orderedList",
            Icon: ListOrdered,
            active: state?.orderedList,
            run: () => editor.chain().focus().toggleOrderedList().run(),
          },
          {
            key: "quote",
            Icon: Quote,
            active: state?.quote,
            run: () => editor.chain().focus().toggleBlockquote().run(),
          },
          {
            key: "code",
            Icon: SquareCode,
            active: state?.code,
            run: () => editor.chain().focus().toggleCodeBlock().run(),
          },
          {
            key: "divider",
            Icon: Minus,
            active: false,
            run: () => editor.chain().focus().setHorizontalRule().run(),
          },
        ],
        [
          {
            key: "link",
            Icon: Link2,
            active: state?.link || linkOpen,
            run: () => {
              setLinkUrl(String(editor.getAttributes("link").href ?? ""));
              setLinkError(false);
              setLinkOpen(!linkOpen);
            },
          },
          {
            key: "unlink",
            Icon: Unlink,
            active: false,
            disabled: !state?.link,
            run: () => editor.chain().focus().extendMarkRange("link").unsetLink().run(),
          },
          {
            key: "clear",
            Icon: RemoveFormatting,
            active: false,
            run: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
          },
        ],
      ]
    : [];
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/30 ${invalid ? "border-destructive" : ""}`}
    >
      <div
        className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2"
        role="toolbar"
        aria-label={t("datasets.formatting")}
      >
        <div className="w-32 shrink-0">
          <Select
            aria-label={t("datasets.blockType")}
            disabled={!editor}
            value={state?.heading ?? "0"}
            onChange={(event) => {
              const level = Number(event.target.value);
              if (level === 0) editor?.chain().focus().setParagraph().run();
              else
                editor
                  ?.chain()
                  .focus()
                  .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
                  .run();
            }}
          >
            <option value="0">{t("datasets.paragraph")}</option>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={level}>
                {t("datasets.headingLevel", { level })}
              </option>
            ))}
          </Select>
        </div>
        {groups.map((group, index) => (
          <div
            key={index}
            className="flex items-center gap-0.5 border-l px-1"
            role="group"
            aria-label={t(`datasets.toolbarGroup.${index}`)}
          >
            {group.map((action) => (
              <Button
                key={action.key}
                type="button"
                size="icon"
                className="size-8"
                variant={action.active ? "secondary" : "ghost"}
                aria-label={t(`datasets.format.${action.key}`)}
                title={t(`datasets.format.${action.key}`)}
                aria-pressed={!!action.active}
                disabled={"disabled" in action && action.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={action.run}
              >
                <action.Icon className="size-4" />
              </Button>
            ))}
          </div>
        ))}
      </div>
      {linkOpen && (
        <div className="space-y-2 border-b p-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-40 flex-1"
              aria-label={t("datasets.linkUrl")}
              placeholder="https://"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setLinkOpen(false);
                  editor?.commands.focus();
                }
              }}
            />
            <Button type="button" size="sm" onClick={applyLink}>
              {t("datasets.applyLink")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
              {t("datasets.cancel")}
            </Button>
          </div>
          {linkError && (
            <p role="alert" className="text-sm text-destructive">
              {t("datasets.invalidLink")}
            </p>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="flex justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Markdown</span>
        <span>{t("datasets.characterCount", { count: state?.characters ?? 0 })}</span>
      </div>
    </div>
  );
}
