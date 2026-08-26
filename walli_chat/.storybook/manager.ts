import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

addons.setConfig({
  theme: create({
    base: "light",
    brandImage: "/walli-robot-icon.png",
    brandTarget: "_self",
    brandTitle: "Walli Chat",
    brandUrl: "/",
  }),
});

const STORY_PATH_PREFIX = "/story/";

function toDocsAnchorHref(href: string): string | null {
  const url = new URL(href, window.location.href);
  const storyPath = url.searchParams.get("path");

  if (!storyPath?.startsWith(STORY_PATH_PREFIX)) return null;

  const storyId = storyPath.slice(STORY_PATH_PREFIX.length);
  const separator = storyId.lastIndexOf("--");
  if (separator < 0) return null;

  url.searchParams.set("path", `/docs/${storyId.slice(0, separator)}--docs`);
  url.hash = storyId.slice(separator + 2);
  return `${url.pathname}${url.search}${url.hash}`;
}

addons.register("walli/docs-story-anchor-navigation", (api) => {
  const rewriteSidebarLinks = () => {
    document
      .querySelectorAll<HTMLAnchorElement>('nav[aria-label="Stories"] a[href*="path=/story/"]')
      .forEach((link) => {
        const docsHref = toDocsAnchorHref(link.href);
        if (!docsHref) return;
        link.dataset.walliDocsHref = docsHref;
        link.href = docsHref;
      });
  };

  new MutationObserver(rewriteSidebarLinks).observe(document.body, {
    childList: true,
    subtree: true,
  });
  rewriteSidebarLinks();

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>(
        'nav[aria-label="Stories"] a[data-walli-docs-href], nav[aria-label="Stories"] a[href*="path=/story/"]',
      );
      const docsHref = link ? (link.dataset.walliDocsHref ?? toDocsAnchorHref(link.href)) : null;
      if (!docsHref) return;

      event.preventDefault();
      api.navigateUrl(docsHref, {});
    },
    true,
  );
});
