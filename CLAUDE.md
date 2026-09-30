<!-- last-verified: 2026-09-30 -->

# CLAUDE.md

## Project Overview

AI Blog — a statically-generated personal tech blog built with Next.js 16 (App Router),
Tailwind CSS v4, and MDX. Exports pure static HTML via `output: 'export'`.

- **Language**: Chinese (zh-CN) — all site content and UI text
- **Author**: Jack
- **Site addresses**: defined in `site.config.json`. **This is the single source of truth — do not
  restate the domains here.** Currently: a self-hosted server with Nginx (primary, serves the build
  output directly) and Vercel (mirror, auto-deploys on push to `main`).

### Documentation language convention

- `README.md` — user-facing, written in **Chinese**
- `CLAUDE.md` and `.ai/**` — AI-facing working docs, written in **English**

## Keeping Docs in Sync With Code (rewritten 2026-09-30)

The original rule was: *update `.ai/` docs first → then update code → verify with `npm run build`.*

That rule had a fatal flaw: **`npm run build` only checks that the code compiles. It checks nothing
about the docs.** The single step in the rule that had any enforcement power was unrelated to
documentation, so the doc requirement sat in a "zero cost to violate" state. A 2026-09-30 audit found
that this file and `.ai/architecture.md` were still advertising a **retired domain that returns 404
site-wide** — and that the same stale value had been copy-pasted into `scripts/generate-rss.ts` as a
fallback, silently producing a feed full of dead links.

Current rules:

1. **Change first, document after.** Get the code right and verify it, then write the docs back.
   Demanding final docs *before* the work is impractical — most changes only take their final shape
   while you are debugging them.
2. **Run `npm run check:docs` before committing.** It validates domains, file paths and npm script
   names in the docs against the actual repo. `ops/release.sh` runs it automatically in publish mode,
   **before staging**, and aborts the release on failure (`--force` skips it; that escape hatch exists
   for the case where the checker itself is wrong, not as a normal path).
3. **Reference the single source, don't restate it.** Domains live in `site.config.json`. Never write
   a second copy of a fact.
4. **Stamp every current-state doc** with `<!-- last-verified: YYYY-MM-DD -->` on line 1, and refresh
   it whenever you touch the doc. `check:docs` warns about docs that have gone 90 days without review.
5. **Decisions go into ADRs, and ADRs are never rewritten.** An ADR is a historical record: once
   written it is only superseded by a new one. This is exactly why ADRs do not drift while
   "current state" docs always do — so push as much as you can into ADRs.
   ADRs therefore carry no `last-verified` marker; a verification date is meaningless for history.
6. **When a fact changes, change the source first.** Update `site.config.json`, then fix the references.
7. **Historical mentions of a retired domain are allowed, and must be marked.** `check:docs` fails on
   any retired host unless the same line carries a retirement word (`已退役`, `已废弃`, `retired`, …).
   That exemption is what lets ADRs — and this file — describe history instead of pretending it never
   happened. Mentions inside `content/` are downgraded to warnings: articles are narrative, and an
   article written before the change naming the address of its day is *accurate*, not stale.

## .ai Documentation Structure

```
.ai/
├── architecture.md          # System architecture, tech stack, data flow
├── project_map.md           # Directory structure, module responsibilities, routes
├── modules/                 # Per-module deep documentation
│   ├── content-pipeline.md  # MDX reading/parsing (src/lib/posts.ts)
│   ├── pages.md             # App Router pages, SSG strategy, route naming rules
│   └── styling.md           # Tailwind CSS v4 + prose typography
└── decisions/               # Architecture Decision Records (append-only)
    ├── ADR-001-next-mdx-remote.md    # Why next-mdx-remote over @next/mdx
    ├── ADR-002-post-build-rss.md     # Why a post-build script for RSS
    ├── ADR-003-reverse-sync-publish.md  # Server as content source, GitHub as backup
    ├── ADR-004-output-path-guard.md     # Failing the build instead of shipping bad paths
    └── ADR-005-single-source-of-site-facts.md  # One registry for addresses + the check that enforces it
```

### When to Update Each File

| Change Type                | Update These .ai Files                                |
| -------------------------- | ----------------------------------------------------- |
| New feature                | `.ai/architecture.md`, `.ai/project_map.md`, new module doc |
| Modify existing module     | The relevant file under `.ai/modules/`                |
| Add/remove route           | `.ai/project_map.md` routes table                     |
| Change dependency          | `.ai/architecture.md` tech stack table                |
| Architectural decision     | New `.ai/decisions/ADR-NNN-*.md` (never edit an old one) |
| Add frontmatter field      | `.ai/modules/content-pipeline.md`                     |
| Styling change             | `.ai/modules/styling.md`                              |
| **Change a site address**  | `site.config.json` **first**, then run `npm run check:docs` |
| **Add a script**           | `package.json` + this file's Commands block           |

## Commands

```bash
npm run dev           # Dev server at http://localhost:3000
npm run build         # Static export + RSS generation + build-output path guard
npm run check:docs    # Validate docs against the repo (domains, paths, npm scripts)
npm start             # Preview the production build (npx serve out)
npm run lint          # ESLint
```

## Key Technical Details

- **Static export**: `output: 'export'` in `next.config.ts`. All pages pre-rendered; no runtime SSR.
- **Two deployment targets, two different URL→file mapping rules.** Any host serving the build output
  must map extension-less URLs to `.html` files. Nginx does this via `try_files`; Vercel in
  plain-static mode requires `"cleanUrls": true` in `vercel.json`. Miss it and the homepage still
  works while **every** internal link 404s — see ADR for the full story in `README.md`.
- **Route param naming — hard rules.** Static export derives output file names **directly from the
  values returned by `generateStaticParams()`**. Never percent-encode them there:
  - `generateStaticParams()` must return **raw** values — `{ tag }`, not `{ tag: encodeURIComponent(tag) }`
  - Article slugs (file names under `content/`) must be **pure ASCII**
  - Tag values should be **ASCII single tokens** (avoid spaces)
  - `encodeURIComponent` belongs in `href` attributes only — that is the URL layer's job
  - `scripts/check-export-paths.ts` fails the build if any output path name contains `%` (ADR-004)
- **MDX compilation**: uses `next-mdx-remote/rsc`, NOT `@next/mdx`, due to Turbopack incompatibility (ADR-001).
- **Content location**: `content/*.mdx` at project root, outside `src/`.
- **RSS**: generated by `scripts/generate-rss.ts` after the build. Absolute URLs come from the
  `SITE_URL` environment variable if set, otherwise from `canonicalOrigin` in `site.config.json`.
  If neither resolves, the **build fails** — there is deliberately no hard-coded default (ADR-002, ADR-005).
- **RSS entry points — `/rss.xml` is not a route.** It only exists in `out/`, so the feed is linked
  explicitly: a subscribe pill in `src/app/page.tsx`, a link in `src/components/Footer.tsx`, and a
  `<link rel="alternate" type="application/rss+xml">` from `metadata.alternates.types` in
  `src/app/layout.tsx` (autodiscovery for feed readers). All of them use the **relative** path
  `/rss.xml`, and `metadataBase` is read from `site.config.json` — **never hardcode a domain in
  `src/`**; a second copy of an address is exactly what ADR-005 exists to prevent.
- **Metadata routes, not a `public` directory.** Machine-facing files live in `src/app/` as metadata
  routes — `/robots.txt` is generated by `src/app/robots.ts` at build time. There is no `public/`
  directory in this repo, and `public` is **not** in the commit whitelist of `ops/release.sh`, so a
  file placed there would serve on the server but never reach GitHub. Metadata routes additionally
  require `export const dynamic = "force-static"` under `output: 'export'`, otherwise the build fails.
- **Styling**: Tailwind CSS v4, CSS-first config in `src/app/globals.css`. There is no `tailwind.config.ts`.
- **Dark mode**: system preference only (`prefers-color-scheme`), no manual toggle.
- **Params**: Next.js 15+ requires `await params` in dynamic routes.
- **Deployment**: `ops/release.sh` has two modes — `deploy` (pull from GitHub → build → go live; run by
  cron) and `publish` (commit → build → self-check → go live → push to GitHub; used for new articles).
  The push happens **only after** the build and self-check succeed (ADR-003).

## Writing Articles

Create an `.mdx` file in `content/`. **The file name is the URL slug, so keep it pure ASCII.**

```yaml
---
title: "Article Title"
date: "2026-08-17"
summary: "Short description shown in listings"
tags: ["tag1", "tag2"]
---
```

> **`draft` does not work.** `scripts/generate-rss.ts` skips `draft: true` entries, but
> `src/lib/posts.ts` never reads the field — so a draft still appears on the homepage and still
> gets its own post page. To keep something unpublished, keep the file out of `content/`.
