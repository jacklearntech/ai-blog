# Styling Module

## Overview

Styling uses Tailwind CSS v4 with CSS-first configuration. No `tailwind.config.ts` file exists — all theme tokens are defined directly in CSS. Custom `.prose` classes provide article typography without the `@tailwindcss/typography` plugin.

## Files

- **`src/app/globals.css`** — Tailwind entry point, theme tokens, prose styles
- **`postcss.config.mjs`** — PostCSS config pointing to `@tailwindcss/postcss`

## Theme Tokens

Defined via `@theme inline` in `globals.css`:

| Token              | Value                    | Usage                     |
| ------------------ | ------------------------ | ------------------------- |
| `--background`     | `#ffffff` / `#0a0a0a`   | Page background           |
| `--foreground`     | `#171717` / `#ededed`   | Primary text color        |
| `--font-sans`      | Geist (via next/font)    | Body text                 |
| `--font-mono`      | Geist Mono (via next/font)| Code blocks              |

Dark mode uses `@media (prefers-color-scheme: dark)` — system-preference driven, no toggle.

## Prose Typography

Hand-crafted `.prose` classes style MDX content. Covers: headings, paragraphs, links, lists, blockquotes, inline code, code blocks, images, tables, and horizontal rules.

### Why Not @tailwindcss/typography?

- Full control over every typographic rule
- Zero extra dependency
- Avoids v4 compatibility quirks with the typography plugin
- Easy to customize for blog-specific needs

## Dark Mode

Prose styles use CSS custom properties (`var(--foreground)`) that automatically adapt to the active color scheme. Code blocks retain their Shiki theme backgrounds regardless of light/dark mode.

## Adding New Styles

- **Global utilities**: Add to `globals.css` using Tailwind classes or `@theme`
- **Component-scoped**: Use Tailwind utility classes directly in JSX
- **New prose elements**: Add rules under `.prose` selector in `globals.css`
