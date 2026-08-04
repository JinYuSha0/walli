import type { Tokens } from "marked";
import { computed } from "@preact/signals-core";
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
  walkRichInlineLineRanges,
} from "@chenglou/pretext/rich-inline";
import { customElement } from "lit/decorators.js";
import { html, type TemplateResult } from "lit";
import clsx from "clsx";
import type {
  BlockLayout,
  InlineFragmentLayout,
  InlinePiece,
  ParseContext,
  PreparedTableBlock,
  PreparedTableCell,
  TableCellLayout,
} from "../type";
import { createBlockBase } from "../helper";
import { getFont } from "../styles";
import { getLineHeight, getSpace } from "../styles/config";
import { collectInlinePieceLines } from "./inline-block";
import { BlockShellElement } from "./block-shell";

const tableTextClass =
  "inline-block whitespace-pre font-sans text-sm leading-none text-foreground align-baseline";

const TableBlockStyle = computed(() => ({
  paddingBottom: getSpace(6),
  lineHeight: getLineHeight("text-sm"),
  paddingTop: getSpace(2),
  paddingInlineEnd: getSpace(3),
  paddingInlineStart: getSpace(2),
  cellPaddingY: getSpace(2.5),
}));

export function getTableBlockStyle(key: keyof (typeof TableBlockStyle)["value"]) {
  return TableBlockStyle.value[key];
}

export function buildTableBlock(token: Tokens.Table, ctx: ParseContext): PreparedTableBlock {
  return {
    ...createBlockBase(ctx),
    kind: "table",
    lineHeight: getTableBlockStyle("lineHeight"),
    header: token.header.map((cell, index) =>
      buildTableCell(cell, token.align[index] ?? null, true),
    ),
    rows: token.rows.map((row) =>
      row.map((cell, index) => buildTableCell(cell, token.align[index] ?? null, false)),
    ),
  };
}

export type TableMetrics = {
  columnWidths: number[];
  height: number;
  rowHeights: number[];
  shouldWrap: boolean;
  width: number;
};

export function measureTableBlock(block: PreparedTableBlock, availableWidth: number): TableMetrics {
  const rows = [block.header, ...block.rows];
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const naturalColumnWidths = measureNaturalColumnWidths(rows, columnCount);

  const naturalWidth = naturalColumnWidths.reduce((sum, width) => sum + width, 0);
  const shouldWrap = naturalWidth > availableWidth;
  const columnWidths = shouldWrap
    ? distributeEvenly(availableWidth, columnCount)
    : distributeSlack(naturalColumnWidths, availableWidth - naturalWidth);
  const rowHeights = rows.map((row) => measureTableRowHeight(row, columnWidths, columnCount));
  const contentHeight = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);

  return {
    columnWidths,
    height: getTableBlockStyle("paddingTop") + contentHeight + getTableBlockStyle("paddingBottom"),
    rowHeights,
    shouldWrap,
    width: availableWidth,
  };
}

export function materializeTableCells(
  block: PreparedTableBlock,
  metrics: TableMetrics,
): TableCellLayout[] {
  const rows = [block.header, ...block.rows];
  const cells: TableCellLayout[] = [];
  let y = getTableBlockStyle("paddingTop");

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    let x = 0;
    for (let columnIndex = 0; columnIndex < metrics.columnWidths.length; columnIndex++) {
      const width = metrics.columnWidths[columnIndex]!;
      const cell = row[columnIndex];
      if (cell !== undefined) {
        cells.push(materializeTableCell(cell, metrics, rowIndex, columnIndex, width, x, y));
      }
      x += width;
    }
    y += metrics.rowHeights[rowIndex]!;
  }

  return cells;
}

function measureNaturalColumnWidths(rows: PreparedTableCell[][], columnCount: number): number[] {
  const widths = new Array<number>(columnCount).fill(0);

  for (const row of rows) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const cell = row[columnIndex];
      if (cell === undefined) continue;
      const width =
        measureRichInlineStats(cell.flow, Number.MAX_SAFE_INTEGER).maxLineWidth +
        getTableCellPaddingStart(columnIndex) +
        getTableCellPaddingEnd(columnIndex, columnCount);
      widths[columnIndex] = Math.max(widths[columnIndex]!, width);
    }
  }

  return widths;
}

function distributeEvenly(width: number, columnCount: number): number[] {
  if (columnCount === 0) return [];

  const baseWidth = Math.floor(width / columnCount);
  let remainder = Math.max(0, Math.round(width - baseWidth * columnCount));
  return Array.from({ length: columnCount }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return Math.max(1, baseWidth + extra);
  });
}

function distributeSlack(naturalColumnWidths: number[], slack: number): number[] {
  if (naturalColumnWidths.length === 0) return [];
  if (slack <= 0) return naturalColumnWidths.map((width) => Math.max(1, Math.round(width)));

  const baseExtra = Math.floor(slack / naturalColumnWidths.length);
  let remainder = Math.max(0, Math.round(slack - baseExtra * naturalColumnWidths.length));
  return naturalColumnWidths.map((width) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return Math.max(1, Math.round(width + baseExtra + extra));
  });
}

function measureTableRowHeight(
  row: PreparedTableCell[],
  columnWidths: number[],
  columnCount: number,
): number {
  let height = getTableBlockStyle("lineHeight") + getTableBlockStyle("cellPaddingY") * 2;
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const cell = row[columnIndex];
    if (cell === undefined) continue;
    const lineWidth = getTableCellContentWidth(
      columnWidths[columnIndex]!,
      columnIndex,
      columnCount,
    );
    const { lineCount } = measureRichInlineStats(cell.flow, lineWidth);
    height = Math.max(
      height,
      lineCount * getTableBlockStyle("lineHeight") + getTableBlockStyle("cellPaddingY") * 2,
    );
  }
  return height;
}

function materializeTableCell(
  cell: PreparedTableCell,
  metrics: TableMetrics,
  rowIndex: number,
  columnIndex: number,
  width: number,
  x: number,
  y: number,
): TableCellLayout {
  const paddingStart = getTableCellPaddingStart(columnIndex);
  const paddingEnd = getTableCellPaddingEnd(columnIndex, metrics.columnWidths.length);
  const lineWidth = metrics.shouldWrap
    ? Math.max(1, width - paddingStart - paddingEnd)
    : Number.MAX_SAFE_INTEGER;

  return {
    align: cell.align,
    height: metrics.rowHeights[rowIndex]!,
    lines: materializeTableCellLines(cell, lineWidth),
    paddingInlineEnd: paddingEnd,
    paddingInlineStart: paddingStart,
    width,
    x,
    y,
  };
}

function materializeTableCellLines(
  cell: PreparedTableCell,
  lineWidth: number,
): Array<{ fragments: InlineFragmentLayout[]; width: number }> {
  const lines: Array<{ fragments: InlineFragmentLayout[]; width: number }> = [];
  walkRichInlineLineRanges(cell.flow, lineWidth, (range) => {
    const line = materializeRichInlineLineRange(cell.flow, range);
    lines.push({
      fragments: line.fragments.map((fragment) => ({
        alt: cell.imageAlts[fragment.itemIndex] ?? null,
        className: cell.classNames[fragment.itemIndex]!,
        href: cell.hrefs[fragment.itemIndex] ?? null,
        kind: cell.imageSrcs[fragment.itemIndex] === null ? "text" : "image",
        leadingGap: fragment.gapBefore,
        src: cell.imageSrcs[fragment.itemIndex] ?? null,
        text: fragment.text,
      })),
      width: line.width,
    });
  });
  return lines;
}

function getTableCellContentWidth(width: number, columnIndex: number, columnCount: number): number {
  return Math.max(
    1,
    width -
      getTableCellPaddingStart(columnIndex) -
      getTableCellPaddingEnd(columnIndex, columnCount),
  );
}

function getTableCellPaddingStart(columnIndex: number): number {
  return columnIndex === 0 ? 0 : getTableBlockStyle("paddingInlineStart");
}

function getTableCellPaddingEnd(columnIndex: number, columnCount: number): number {
  return columnIndex === columnCount - 1 ? 0 : getTableBlockStyle("paddingInlineEnd");
}

function buildTableCell(
  cell: Tokens.TableCell,
  align: "left" | "center" | "right" | null,
  isHeader: boolean,
): PreparedTableCell {
  const pieces = collectInlinePieceLines(cell.tokens ?? [], "body")
    .flat()
    .map((piece) => createTablePiece(piece, isHeader));

  return {
    align,
    classNames: pieces.map((piece) => piece.className),
    flow: prepareRichInline(
      pieces.map((piece) => ({
        break: piece.breakMode,
        extraWidth: piece.extraWidth,
        font: piece.font,
        text: piece.text,
      })),
    ),
    hrefs: pieces.map((piece) => piece.href ?? null),
    imageAlts: pieces.map((piece) => piece.imageAlt ?? null),
    imageSrcs: pieces.map((piece) => piece.imageSrc ?? null),
  };
}

function createTablePiece(piece: InlinePiece, isHeader: boolean): InlinePiece {
  if (piece.imageSrc !== undefined) return piece;

  const isBold = piece.className.includes("font-bold");
  const isItalic = piece.className.includes("italic");
  const isStrike = piece.className.includes("line-through");
  const weight = isBold ? 700 : isHeader ? 600 : piece.href ? 500 : 400;
  const marks = {
    bold: isBold,
    href: piece.href,
    italic: isItalic,
    strike: isStrike,
  };

  return {
    ...piece,
    className: clsx(
      tableTextClass,
      isHeader && !isBold ? "font-semibold" : null,
      isBold ? "font-bold" : null,
      isItalic ? "italic" : null,
      isStrike ? "line-through decoration-1" : null,
      piece.href ? "underline" : null,
    ),
    font: getFont("body", marks, "text-sm", "font-sans", weight),
  };
}

type TableBlockLayout = Extract<BlockLayout, { kind: "table" }>;

@customElement("walli-table-block")
export class WalliTableBlockElement extends BlockShellElement<TableBlockLayout> {
  protected override renderContent(block: TableBlockLayout, contentInsetX: number): TemplateResult {
    return html`<div
      class="absolute top-0 overflow-hidden rounded-[6px] bg-background ring-1 ring-border"
      style=${`left:${contentInsetX + block.contentLeft}px; width:${block.width}px; height:${block.height}px;`}
    >
      ${block.cells.map((cell) => renderTableCell(cell))} ${renderTableSeparators(block)}
    </div>`;
  }
}

function renderTableCell(cell: TableBlockLayout["cells"][number]): TemplateResult {
  return html`<div
    class="absolute box-border bg-background"
    style=${`left:${cell.x}px; top:${cell.y}px; width:${cell.width}px; height:${cell.height}px;`}
  >
    ${cell.lines.map(
      (line, lineIndex) =>
        html`<div
          class="absolute flex gap-0"
          style=${`left:${getLineLeft(cell, line.width)}px; top:${getTableBlockStyle("cellPaddingY") + lineIndex * getTableBlockStyle("lineHeight")}px; width:max-content; height:${getTableBlockStyle("lineHeight")}px; align-items:center;`}
        >
          ${line.fragments.map(renderTableFragment)}
        </div>`,
    )}
  </div>`;
}

function renderTableSeparators(block: TableBlockLayout): TemplateResult[] {
  const headerBottom = getTableHeaderBottom(block);
  return [
    headerBottom === null ? null : renderTableHeadSeparator(headerBottom),
    ...renderTableRowSeparators(block, headerBottom),
  ].filter((line): line is TemplateResult => line !== null);
}

function getTableHeaderBottom(block: TableBlockLayout): number | null {
  const headerCell = block.cells[0];
  if (headerCell === undefined) return null;
  const bottom = headerCell.y + headerCell.height;
  return bottom < block.height ? bottom : null;
}

function renderTableHeadSeparator(bottom: number): TemplateResult {
  return html`<div
    class="absolute left-0 right-0 z-1 h-px bg-muted-foreground opacity-35"
    style=${`top:${Math.max(0, bottom - 1)}px;`}
  ></div>`;
}

function renderTableRowSeparators(
  block: TableBlockLayout,
  headerBottom: number | null,
): TemplateResult[] {
  const bottoms = new Set<number>();
  const lastRowBottom = Math.max(0, ...block.cells.map((cell) => cell.y + cell.height));
  for (const cell of block.cells) {
    const bottom = cell.y + cell.height;
    if (bottom < lastRowBottom && bottom !== headerBottom) {
      bottoms.add(bottom);
    }
  }

  return [...bottoms].map(
    (bottom) =>
      html`<div
        class="absolute left-0 right-0 z-1 h-px bg-border"
        style=${`top:${Math.max(0, bottom - 1)}px;`}
      ></div>`,
  );
}

function getLineLeft(cell: TableBlockLayout["cells"][number], lineWidth: number): number {
  const contentWidth = Math.max(1, cell.width - cell.paddingInlineStart - cell.paddingInlineEnd);
  if (cell.align === "right") {
    return cell.paddingInlineStart + Math.max(0, contentWidth - lineWidth);
  }
  if (cell.align === "center") {
    return cell.paddingInlineStart + Math.max(0, (contentWidth - lineWidth) / 2);
  }
  return cell.paddingInlineStart;
}

function renderTableFragment(fragment: InlineFragmentLayout): TemplateResult {
  const gapStyle = fragment.leadingGap > 0 ? `margin-left:${fragment.leadingGap}px;` : "";

  if (fragment.kind === "image" && fragment.src !== null) {
    return html`<img
      class=${fragment.className}
      src=${fragment.src}
      alt=${fragment.alt ?? ""}
      loading="lazy"
      decoding="async"
      style=${gapStyle}
    />`;
  }

  if (fragment.href !== null) {
    return html`<a
      class=${fragment.className}
      href=${fragment.href}
      target="_blank"
      rel="noreferrer"
      style=${gapStyle}
      .textContent=${fragment.text}
    ></a>`;
  }

  return html`<span
    class=${fragment.className}
    style=${gapStyle}
    .textContent=${fragment.text}
  ></span>`;
}
