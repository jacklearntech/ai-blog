# Architecture

## Overview

AI Blog is a statically-generated personal blog built with Next.js (App Router). It renders MDX articles to pure HTML at build time, requiring zero server-side runtime. The site supports tag-based navigation, syntax-highlighted code blocks, and RSS feed generation.

- **Language**: Chinese (zh-CN) — all UI text and content are in Chinese
- **Domain**: `ai-blog-vercel.jacklearn.tech`
- **Author**: Jack

## Tech Stack

| Layer        | Technology                          | Purpose                                |
| ------------ | ----------------------------------- | -------------------------------------- |
| Framework    | Next.js 16 (App Router)             | SSG with `output: 'export'`            |
| Language     | TypeScript                          | Type safety across the stack           |
| Styling      | Tailwind CSS v4                     | Utility-first CSS, CSS-first config    |
| Content      | MDX + gray-matter                   | Articles with frontmatter metadata     |
| MDX Rendering| next-mdx-remote/rsc                 | Server-component MDX compilation       |
| Code Highlight| rehype-pretty-code + Shiki         | VS Code-quality syntax highlighting    |
| RSS          | rss + custom post-build script      | Static XML feed generation             |
| Deployment   | Vercel (static export)              | Auto-deploy on push                    |

## Data Flow

```
content/*.mdx
      │
      ▼
gray-matter (frontmatter parsing)
      │
      ├──► src/lib/posts.ts ──► getAllPosts(), getPostBySlug(), getAllTags()
      │                              │
      │                              ▼
      │                        Page Components (SSG at build time)
      │                              │
      │                              ▼
      │                        Static HTML in out/
      │
      └──► next-mdx-remote/rsc ──► compileMDX() with rehype-pretty-code
                                         │
                                         ▼
                                   Rendered MDX content (inline in HTML)
```

## Build Pipeline

1. `next build` — Turbopack compiles all pages to static HTML
2. `tsx scripts/generate-rss.ts` — Reads `content/*.mdx`, generates `out/rss.xml`

All pages are pre-rendered at build time. No server-side rendering occurs at runtime.

## Key Design Decisions

- **next-mdx-remote over @next/mdx**: Turbopack does not support dynamic imports of MDX files or serializable rehype plugin options via `@next/mdx`. `next-mdx-remote/rsc` compiles MDX in React Server Components, compatible with Turbopack and static export.
- **CSS-first Tailwind v4**: No `tailwind.config.ts`. Theme tokens defined directly in `globals.css` via `@theme`.
- **Custom prose styles**: Hand-crafted `.prose` classes in `globals.css` instead of `@tailwindcss/typography` plugin for full control and zero extra dependencies.
- **Content at project root**: `content/` lives outside `src/` to separate authoring from application code.
