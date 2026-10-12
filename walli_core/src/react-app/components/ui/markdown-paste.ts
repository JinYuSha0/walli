import { Markdown } from "@tiptap/markdown";
import { Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";

export const PasteMarkdown = Markdown.extend({
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
            const hasMarkdownSyntax = /^ {0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|`{3}|~{3})/m.test(text ?? "") || /(?:\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\))/.test(text ?? "");
            // Source editors can attach HTML to raw Markdown. Prefer Markdown
            // when Markdown syntax is present, but preserve ordinary rich text.
            if (
              !text ||
              (html && !hasMarkdownSyntax) ||
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

