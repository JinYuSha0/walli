import Prism from "prismjs";
import { useMemo, type ReactNode } from "react";

const tokenColors: Record<string, string> = {
  keyword: "text-purple-700 dark:text-purple-300",
  string: "text-green-700 dark:text-green-300",
  "literal-property": "text-sky-700 dark:text-sky-300",
  "string-property": "text-sky-700 dark:text-sky-300",
  function: "text-blue-700 dark:text-blue-300",
  number: "text-orange-700 dark:text-orange-300",
  boolean: "text-orange-700 dark:text-orange-300",
  operator: "text-cyan-700 dark:text-cyan-300",
  "class-name": "text-amber-700 dark:text-amber-300",
  comment: "text-muted-foreground",
  punctuation: "text-muted-foreground",
};

function renderToken(token: string | Prism.Token, index: number): ReactNode {
  if (typeof token === "string") return token;

  return (
    <span key={index} className={tokenColors[token.type]}>
      {Array.isArray(token.content)
        ? token.content.map(renderToken)
        : renderToken(token.content, 0)}
    </span>
  );
}

export function JavaScriptCode({ code }: { code: string }) {
  const tokens = useMemo(
    () => Prism.tokenize(code, Prism.languages.javascript),
    [code],
  );

  return <code className="language-javascript">{tokens.map(renderToken)}</code>;
}
