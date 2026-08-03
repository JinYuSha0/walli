import { buildPreparedInlineBlocks, createTextPiece, EMPTY_MARK_STATE } from "./inline-block";
import type { InlineVariant, ParseContext, PreparedBlock } from "../type";

export function buildPlainTextBlocks(
  text: string,
  variant: InlineVariant,
  ctx: ParseContext,
): PreparedBlock[] {
  const piece = createTextPiece(text, EMPTY_MARK_STATE, variant);
  if (piece === null) return [];
  return buildPreparedInlineBlocks([[piece]], variant, ctx);
}
