import { Controls, Description, Stories, Subtitle, Title } from "@storybook/addon-docs/blocks";
import { Fragment, createElement } from "react";

export function docsPage() {
  return createElement(
    Fragment,
    null,
    createElement(Title),
    createElement(Subtitle),
    createElement(Description),
    createElement(Controls),
    createElement(Stories, { includePrimary: true }),
  );
}
