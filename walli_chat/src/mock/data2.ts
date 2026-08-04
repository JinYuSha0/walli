export type MarkdownChatSeed = {
  role: "assistant" | "user";
  markdown: string;
};

function message(role: "assistant" | "user", ...lines: string[]): MarkdownChatSeed {
  return {
    role,
    markdown: lines.join("\n"),
  };
}

export const TOTAL_LENGTH = 2;

export const BASE_MESSAGE_SPECS2: MarkdownChatSeed[] = [
  message("user", "Add one deliberately complex nested markdown sample to the test loop."),
  message(
    "assistant",
    "# Nested markdown stress sample",
    "",
    "This message intentionally mixes **bold**, *italic*, ***nested emphasis***, ~~deleted text~~, `inline code`, [a safe link](https://example.com/spec), CJK 字符, العربية, and emoji ✅ to exercise inline flow inside richer block structure.",
    "",
    "> Outer quote with regular prose and `inline code`.",
    ">",
    "> - quoted bullet one",
    "> - quoted bullet two with a nested list",
    ">   1. quoted ordered child",
    ">   2. quoted ordered child with **strong text**",
    ">",
    "> > - 1",
    "> > - 2",
    ">",
    "> > 1. 1",
    "> > 2. 2",
    ">",
    "> > Nested quote level two should keep its rail and indentation stable.",
    "",
    "## Checklist with children",
    "",
    "- [x] Parse top-level task item",
    "- [ ] Keep nested task spacing predictable",
    "  - [x] nested task one",
    "  - [ ] nested task two with a long sentence that should wrap without colliding with the marker gutter or quote rails",
    "- [ ] Render normal children below task items",
    "  1. ordered child inside unordered item",
    "  2. second ordered child",
    "     - third-level bullet",
    "     - another third-level bullet with `code` and [link](https://example.com/deep)",
    "",
    "---",
    "",
    "| Area | Expected behavior | Risk |",
    "| --- | --- | --- |",
    "| inline | marks, links, code spans | width drift |",
    "| blocks | quote, list, table, hr | vertical overlap |",
    "| scripts | English, 日本語, العربية | line breaking |",
    "| media | [docs link](https://example.com/docs) and ![chart](https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/120px-Fronalpstock_big.jpg) | atomic sizing |",
    "",
    "```ts",
    "type NestedCase = {",
    "  id: string;",
    "  depth: number;",
    "  done: boolean;",
    "};",
    "",
    'const sample: NestedCase = { id: "markdown-stress", depth: 3, done: false };',
    "```",
    "",
    "Final paragraph after code should return to normal body rhythm.",
  ),
];
