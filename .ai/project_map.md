# Project Map

## Directory Structure

```
ai-blog/
├── .ai/                          # AI-assisted development docs
│   ├── architecture.md           # System architecture overview
│   ├── project_map.md            # This file — project structure map
│   ├── modules/                  # Per-module documentation
│   │   ├── content-pipeline.md   # MDX reading, parsing, sorting
│   │   ├── pages.md              # App Router page components
│   │   └── styling.md            # Tailwind CSS + prose typography
│   └── decisions/                # Architecture Decision Records
│       └── ADR-001-next-mdx-remote.md
│
├── content/                      # MDX article source files
│   └── hello-world.mdx           # First post (Chinese)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (Header + Footer wrapper)
│   │   ├── page.tsx              # Homepage — post list
│   │   ├── globals.css           # Tailwind entry + prose styles
│   │   ├── posts/[slug]/
│   │   │   └── page.tsx          # Individual post detail page
│   │   └── tags/
│   │       ├── page.tsx          # Tag index / cloud
│   │       └── [tag]/page.tsx    # Posts filtered by tag
│   │
│   ├── components/
│   │   ├── Header.tsx            # Site navigation bar
│   │   ├── Footer.tsx            # Site footer
│   │   ├── PostCard.tsx          # Post summary card (list view)
│   │   └── TagList.tsx           # Tag badge list component
│   │
│   └── lib/
│       ├── posts.ts              # Core: read/parse/sort/filter MDX files
│       └── mdx.ts                # MDX component overrides (extensible)
│
├── scripts/
│   └── generate-rss.ts           # Post-build RSS XML generator
│
├── public/                       # Static assets (favicon, images)
├── out/                          # Build output (gitignored)
├── next.config.ts                # Next.js config (static export)
├── package.json                  # Dependencies + build scripts
├── tsconfig.json                 # TypeScript configuration
├── postcss.config.mjs            # PostCSS → Tailwind CSS v4
├── .gitignore                    # Git ignore rules
└── README.md                     # User-facing documentation
```

## Module Responsibilities

| Module               | Entry Point              | Responsibility                                    |
| -------------------- | ------------------------ | ------------------------------------------------- |
| Content Pipeline     | `src/lib/posts.ts`       | Read, parse frontmatter, sort, filter MDX files   |
| Pages                | `src/app/**/page.tsx`    | Route handlers, SSG params, metadata generation   |
| Components           | `src/components/*.tsx`   | Reusable UI primitives                            |
| Styling              | `src/app/globals.css`    | Theme tokens, prose typography, dark mode         |
| RSS Generation       | `scripts/generate-rss.ts`| Post-build XML feed creation                      |
| MDX Compilation      | `next-mdx-remote/rsc`    | Server-side MDX → React with rehype plugins       |

## Routes

| Route              | Type  | Source                          | Description              |
| ------------------ | ----- | ------------------------------- | ------------------------ |
| `/`                | SSG   | `src/app/page.tsx`              | Post list (newest first) |
| `/posts/[slug]`    | SSG   | `src/app/posts/[slug]/page.tsx` | Individual article       |
| `/tags`            | SSG   | `src/app/tags/page.tsx`         | All tags with counts     |
| `/tags/[tag]`      | SSG   | `src/app/tags/[tag]/page.tsx`   | Posts filtered by tag    |
