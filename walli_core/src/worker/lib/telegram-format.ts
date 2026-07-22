import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

type MarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  checked?: boolean | null;
  children?: MarkdownNode[];
};

const escapeTelegramHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeTelegramHtmlAttribute = (text: string) =>
  escapeTelegramHtml(text).replaceAll('"', "&quot;");

const unwrapMarkdownFence = (markdown: string) => {
  const match = /^```(?:markdown|md)\s*\n(?<content>[\s\S]*?)\n?```\s*$/i.exec(markdown.trim());

  return match?.groups?.content ?? markdown;
};

const renderChildren = (node: MarkdownNode) => (node.children ?? []).map(renderNode).join("");

const renderListItem = (node: MarkdownNode, index: number, ordered: boolean) => {
  const marker = ordered ? `${index + 1}. ` : node.checked === null ? "- " : node.checked ? "- [x] " : "- [ ] ";

  return `${marker}${renderChildren(node).trim()}`;
};

const renderNode = (node: MarkdownNode): string => {
  switch (node.type) {
    case "root":
      return (node.children ?? []).map(renderNode).join("\n\n").trim();
    case "paragraph":
      return renderChildren(node);
    case "text":
      return escapeTelegramHtml(node.value ?? "");
    case "strong":
      return `<b>${renderChildren(node)}</b>`;
    case "emphasis":
      return `<i>${renderChildren(node)}</i>`;
    case "delete":
      return `<s>${renderChildren(node)}</s>`;
    case "inlineCode":
      return `<code>${escapeTelegramHtml(node.value ?? "")}</code>`;
    case "code":
      return `<pre><code>${escapeTelegramHtml(node.value ?? "")}</code></pre>`;
    case "heading":
      return `<b>${renderChildren(node)}</b>`;
    case "blockquote":
      return renderChildren(node)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "link":
      if (!node.url?.startsWith("http://") && !node.url?.startsWith("https://")) {
        return renderChildren(node);
      }

      return `<a href="${escapeTelegramHtmlAttribute(node.url)}">${renderChildren(node)}</a>`;
    case "list": {
      const ordered = Boolean((node as MarkdownNode & { ordered?: boolean }).ordered);

      return (node.children ?? [])
        .map((child, index) => renderListItem(child, index, ordered))
        .join("\n");
    }
    case "listItem":
      return renderChildren(node);
    case "break":
      return "\n";
    case "thematicBreak":
      return "---";
    case "table":
      return (node.children ?? []).map(renderNode).join("\n");
    case "tableRow":
      return (node.children ?? []).map(renderNode).join(" | ");
    case "tableCell":
      return renderChildren(node);
    default:
      return renderChildren(node);
  }
};

export const renderTelegramHtmlFromMarkdown = (markdown: string) => {
  const tree = fromMarkdown(unwrapMarkdownFence(markdown), {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MarkdownNode;

  return renderNode(tree);
};
