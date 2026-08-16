# Walli Chat Development Guidelines

- Use English for all built-in user-facing and accessibility text in reusable components. This includes `aria-label`, `aria-description`, `title`, alt text, status announcements, errors, empty states, and button labels.
- Do not introduce locale-specific strings directly in reusable components. If localized copy is required, expose it through component configuration or the project's localization mechanism rather than hard-coding it.
