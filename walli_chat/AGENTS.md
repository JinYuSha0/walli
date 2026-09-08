# Walli Chat Development Guidelines

- Use Tailwind-compatible utility classes from the existing UnoCSS setup for component styling. Compose class groups and conditional styles with `clsx`; avoid handwritten CSS blocks when utilities can express the styles. Use inline styles only for dynamic measurements and positioning, and reuse `getSpace` / `getResponsiveValue` for calculated spacing.

- Use English for all built-in user-facing and accessibility text in reusable components. This includes `aria-label`, `aria-description`, `title`, alt text, status announcements, errors, empty states, and button labels.
- Do not introduce locale-specific strings directly in reusable components. If localized copy is required, expose it through component configuration or the project's localization mechanism rather than hard-coding it.
