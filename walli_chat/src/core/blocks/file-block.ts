import type { Token } from "marked";
import { createBlockBase, parseMarkdownImageSrc } from "../helper";
import type { ParseContext, PreparedAssetsGroupBlock } from "../type";

export function buildFileBlock(
  tokens: readonly Token[] | undefined,
  ctx: ParseContext,
): PreparedAssetsGroupBlock | null {
  if (tokens?.length !== 1) return null;
  const token = tokens[0]!;
  if (token.type !== "link") return null;

  const src = parseMarkdownImageSrc(token.href);
  const name = token.text.trim();
  if (src === undefined || !isFileName(name)) return null;

  return {
    ...createBlockBase(ctx),
    assets: [{ name, src, type: "file" }],
    kind: "assetsGroup",
  };
}

function isFileName(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase();
  return (
    extension !== undefined &&
    [
      "7z",
      "aac",
      "avi",
      "css",
      "csv",
      "doc",
      "docx",
      "gz",
      "html",
      "java",
      "js",
      "json",
      "key",
      "odf",
      "odp",
      "ods",
      "odt",
      "ogg",
      "m4a",
      "mkv",
      "mov",
      "mp3",
      "mp4",
      "pdf",
      "ppt",
      "pptx",
      "rar",
      "rtf",
      "py",
      "rs",
      "tar",
      "txt",
      "ts",
      "tsx",
      "wav",
      "webm",
      "xls",
      "xlsx",
      "zip",
    ].includes(extension)
  );
}
