import type { Token, Tokens } from "marked";
import { buildCodeBlock } from "./code-block";
import type { ParseContext } from "../type";
import { fallbackTextForToken } from "../helper";

export function buildTableBlock(token: Tokens.Table, ctx: ParseContext) {
  return buildCodeBlock(formatTable(token as Tokens.Table), ctx);
}

function formatTable(token: Tokens.Table): string {
  const header = token.header.map((cell) => inlineTokensToPlainText(cell.tokens)).join(" | ");
  const divider = token.header.map(() => "---").join(" | ");
  const rows = token.rows.map((row) =>
    row.map((cell) => inlineTokensToPlainText(cell.tokens)).join(" | "),
  );
  return [header, divider, ...rows].join("\n");
}

function inlineTokensToPlainText(tokens: readonly Token[]): string {
  let text = "";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    switch (token.type) {
      case "strong":
      case "em":
      case "del":
      case "link":
        text += inlineTokensToPlainText(token.tokens ?? []);
        break;
      case "codespan":
      case "escape":
      case "text":
      case "html":
        text += token.text;
        break;
      case "br":
        text += "\n";
        break;
      case "image":
        text += token.text;
        break;
      default:
        text += fallbackTextForToken(token);
    }
  }
  return text;
}
