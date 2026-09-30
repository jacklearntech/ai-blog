<!-- last-verified: 2026-09-30 -->

# Architecture

## Overview

AI Blog is a statically-generated personal blog built with Next.js (App Router). It renders MDX
articles to pure HTML at build time, requiring zero server-side runtime. The site supports tag-based
navigation, syntax-highlighted code blocks, and an RSS feed with visible subscribe entry points plus
`<link rel="alternate">` autodiscovery.

- **Language**: Chinese (zh-CN) — all UI text and content are in Chinese
- **Author**: Jack
- **Site addresses**: defined in `site.config.json` (single source of truth). Two targets serve the
  same build output — see [Serving the Output](#serving-the-output).

## Tech Stack

| Layer          | Technology                     | Purpose                                |
| -------------- | ------------------------------ | -------------------------------------- |
| Framework      | Next.js 16 (App Router)        | SSG with static export                 |
| Language       | TypeScript                     | Type safety across the stack           |
| Styling        | Tailwind CSS v4                | Utility-first CSS, CSS-first config    |
| Content        | MDX + gray-matter              | Articles with frontmatter metadata     |
| MDX Rendering  | next-mdx-remote/rsc            | Server-component MDX compilation       |
| Code Highlight | rehype-pretty-code + Shiki     | VS Code-quality syntax highlighting    |
| RSS            | rss + custom post-build script | Static XML feed generation             |
| Deployment     | Nginx (primary) + Vercel (mirror) | Two targets, same build output      |

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

Everything runs from `npm run build`, which chains three steps:

1. `next build` — Turbopack compiles every page to static HTML in `out/`
2. `npx tsx scripts/generate-rss.ts` — reads `content/*.mdx`, writes `out/rss.xml`
3. `npx tsx scripts/check-export-paths.ts` — scans `out/` and **fails the build** if any path name
   contains `%` (see ADR-004)

Step 3 is a guard, not a generator: it exists so that a whole class of broken-page bugs can never be
shipped again. It runs on the server *and* on Vercel, because both invoke the same npm script.

All pages are pre-rendered at build time. No server-side rendering occurs at runtime.

There is also a documentation consistency check, `npm run check:docs`, which validates the docs
against the repo (domains, file paths, npm script names). It is deliberately **not** part of this
build chain — see "Why the docs check is not in the build" below.

## Serving the Output

The build output is a plain directory of files. Any host serving it must satisfy one non-obvious
requirement:

> **Extension-less URLs must map to the corresponding `.html` file.**

Every internal link is of the form `/posts/<slug>` or `/tags/<tag>`; no link carries an `.html`
suffix. A host that only serves files by exact path will therefore return 404 for all of them while
still happily serving `/` (which maps to `index.html`).

- **Nginx**: handled by `try_files $uri.html $uri/index.html $uri =404;`
- **Vercel in plain-static mode**: requires `"cleanUrls": true` in `vercel.json`. Without it, the
  homepage works and every other link 404s.

## Key Design Decisions

- **next-mdx-remote over @next/mdx**: Turbopack does not support dynamic imports of MDX files or
  serializable rehype plugin options via `@next/mdx`. `next-mdx-remote/rsc` compiles MDX in React
  Server Components, which is compatible with Turbopack and static export. See ADR-001.
- **Post-build script for RSS**: a Node script writing directly to `out/rss.xml` is more reliable
  under static export than a Route Handler. See ADR-002.
- **Make the feed discoverable, don't assume it will be guessed**: because `/rss.xml` has no route,
  it is surfaced three ways — a subscribe pill on the homepage, a link in the footer, and a
  `<link rel="alternate" type="application/rss+xml">` emitted from `metadata.alternates.types` in
  `src/app/layout.tsx`. All three use the relative path `/rss.xml`, and `metadataBase` is read from
  `site.config.json`, so no domain is duplicated into `src/`.
- **Server as the content source, GitHub as backup**: publish runs commit → build → self-check →
  go live → push, so a broken build can never reach the remote. See
  `.ai/decisions/ADR-003-reverse-sync-publish.md`.
- **Fail the build on bad output paths**: rather than fixing broken routes one by one, the build
  refuses to produce them at all. See `.ai/decisions/ADR-004-output-path-guard.md`.
- **One registry for site facts**: externally-visible addresses live only in `site.config.json`.
  Build and release scripts read from it and **fail rather than fall back** to a guess. See
  `.ai/decisions/ADR-005-single-source-of-site-facts.md`.
- **CSS-first Tailwind v4**: there is no `tailwind.config.ts`. Theme tokens are defined directly in
  `src/app/globals.css` via `@theme`.
- **Custom prose styles**: hand-crafted `.prose` classes in `src/app/globals.css` instead of the
  typography plugin, for full control and zero extra dependencies.
- **Content at project root**: `content/` lives outside `src/`, separating authoring from application code.

## Why the docs check is not in the build

`npm run check:docs` is intentionally kept out of `npm run build`. Coupling them would mean a stale
date in a document could block deploying an urgent code fix. Instead the check runs where changes are
actually introduced: `ops/release.sh` invokes it in `publish` mode, before `git add`, and aborts the
release if it fails.

The trade-off is explicit: a doc problem blocks the commit path, not the deploy path. Changes pushed
directly to GitHub from elsewhere bypass the check — acceptable, since publish is the intended route.
