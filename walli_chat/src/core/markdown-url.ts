export function parseMarkdownHref(href: string | null | undefined): string | null {
  if (href === undefined || href === null) return null;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
