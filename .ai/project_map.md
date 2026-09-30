<!-- last-verified: 2026-09-30 -->

# Project Map

## Directory Structure

```
ai-blog/
├── .ai/                              # AI-assisted development docs (current state + ADRs)
│   ├── architecture.md               # System architecture, build pipeline, serving requirements
│   ├── project_map.md                # This file — directory map, modules, routes
│   ├── modules/                      # Per-module documentation
│   │   ├── content-pipeline.md       # MDX reading, parsing, sorting
│   │   ├── pages.md                  # App Router pages + route naming rules
│   │   └── styling.md                # Tailwind CSS + prose typography
│   └── decisions/                    # Architecture Decision Records — append-only, never edited
│       ├── ADR-001-next-mdx-remote.md
│       ├── ADR-002-post-build-rss.md
│       ├── ADR-003-reverse-sync-publish.md
│       ├── ADR-004-output-path-guard.md
│       └── ADR-005-single-source-of-site-facts.md
│
├── content/                          # MDX article sources. File name === URL slug (ASCII only)
│   ├── hello-world.mdx
│   └── workbuddy-server-ops.mdx
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (Header + Footer wrapper)
│   │   ├── page.tsx                  # Homepage — post list
│   │   ├── globals.css               # Tailwind entry + theme tokens + prose styles
│   │   ├── favicon.ico               # Site icon (lives here, NOT in a public/ dir)
│   │   ├── robots.ts                 # Metadata route → out/robots.txt at build time
│   │   ├── sitemap.ts                # Metadata route → out/sitemap.xml at build time
│   │   ├── posts/[slug]/page.tsx     # Individual post detail page
│   │   └── tags/
│   │       ├── page.tsx              # Tag index / cloud
│   │       └── [tag]/page.tsx        # Posts filtered by tag
│   │
│   ├── components/
│   │   ├── Header.tsx                # Navigation bar + RSS subscribe pill (top-right, all pages)
│   │   ├── Footer.tsx                # Site footer (ICP + 公安备案)
│   │   ├── PostCard.tsx              # Post summary card (list view)
│   │   ├── TagList.tsx               # Tag badge list component
│   │   └── RssIcon.tsx               # Inline RSS glyph (header pill + footer link)
│   │
│   └── lib/
│       ├── posts.ts                  # Core: read/parse/sort/filter MDX files
│       └── mdx.ts                    # MDX component overrides (extensible)
│
├── scripts/
│   ├── generate-rss.ts               # Post-build RSS XML generator
│   ├── check-export-paths.ts         # Build guard: fail if any output path contains "%"
│   └── check-docs.ts                 # Doc/repo consistency check (domains, paths, npm scripts)
│
├── ops/
│   └── release.sh                    # Server-side release script (deploy + publish modes)
│
├── site.config.json                  # SINGLE SOURCE OF TRUTH for site addresses
├── out/                              # Build output (gitignored, produced by npm run build)
├── next.config.ts                    # Next.js config (static export)
├── vercel.json                       # Vercel project config (buildCommand, cleanUrls)
├── package.json                      # Dependencies + build/check scripts
├── tsconfig.json                     # TypeScript configuration
├── postcss.config.mjs                # PostCSS → Tailwind CSS v4
├── eslint.config.mjs                 # ESLint flat config
├── .gitignore                        # Git ignore rules
├── CLAUDE.md                         # AI-facing working rules (English)
└── README.md                         # User-facing documentation (Chinese)
```

### Not in this tree

- **`public/` does not exist.** There is no static-assets directory; the favicon lives at
  `src/app/favicon.ico` and is picked up by the App Router convention. An earlier version of this
  file documented a `public/` directory, which never existed — an example of the doc drift that
  `npm run check:docs` now catches.
  Creating one would not help either: `public` is **not** in the commit whitelist of
  `ops/release.sh`, so a file placed there would serve correctly on the server and yet never be
  pushed to GitHub. Machine-facing files therefore go in as **metadata routes** under `src/app/`
  — see `.ai/modules/pages.md`.
- `.htaccess` and `.well-known/` exist only on the server and are gitignored — they are deployment
  artifacts, not repository content.

## Module Responsibilities

| Module            | Entry Point                    | Responsibility                                     |
| ----------------- | ------------------------------ | -------------------------------------------------- |
| Content Pipeline  | `src/lib/posts.ts`             | Read, parse frontmatter, sort, filter MDX files    |
| Pages             | `src/app/**/page.tsx`          | Route handlers, SSG params, metadata generation     |
| Components        | `src/components/**`            | Reusable UI primitives                             |
| Styling           | `src/app/globals.css`          | Theme tokens, prose typography, dark mode          |
| RSS Generation    | `scripts/generate-rss.ts`      | Post-build XML feed creation                       |
| RSS Discovery     | `src/app/layout.tsx`           | Autodiscovery `<link>` + metadataBase from `site.config.json` |
| Sitemap           | `src/app/sitemap.ts`           | Build-time URL inventory derived from `content/`   |
| Crawler Policy    | `src/app/robots.ts`            | `/robots.txt` rules + the `Sitemap:` pointer       |
| Output Path Guard | `scripts/check-export-paths.ts`| Fail the build if any output path name is escaped   |
| Docs Check        | `scripts/check-docs.ts`        | Keep docs honest about domains, paths, npm scripts |
| Release           | `ops/release.sh`               | Build, self-check, go live, back up to GitHub      |
| Site Facts        | `site.config.json`             | Canonical addresses consumed by build and checks   |
| MDX Compilation   | `next-mdx-remote/rsc`          | Server-side MDX → React with rehype plugins        |

## Routes

| Route           | Type | Source                          | Description              |
| --------------- | ---- | ------------------------------- | ------------------------ |
| `/`             | SSG  | `src/app/page.tsx`              | Post list (newest first) |
| `/posts/[slug]` | SSG  | `src/app/posts/[slug]/page.tsx` | Individual article       |
| `/tags`         | SSG  | `src/app/tags/page.tsx`         | All tags with counts     |
| `/tags/[tag]`   | SSG  | `src/app/tags/[tag]/page.tsx`   | Posts filtered by tag    |
| `/rss.xml`      | File | `scripts/generate-rss.ts`       | RSS 2.0 feed             |
| `/robots.txt`   | File | `src/app/robots.ts`             | Crawler policy + `Sitemap:` pointer (build-time metadata route) |
| `/sitemap.xml`  | File | `src/app/sitemap.ts`            | URL inventory — home, tag index, posts, tag pages |

Route params become **file names** in the build output. See `.ai/modules/pages.md` for the naming
rules that follow from this.
