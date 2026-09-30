<!-- last-verified: 2026-09-30 -->

# Pages Module

## Overview

All routes use Next.js App Router with static site generation (SSG). Every page is pre-rendered to HTML at build time — no server-side rendering at runtime.

## Files

| File                              | Route           | Purpose                          |
| --------------------------------- | --------------- | -------------------------------- |
| `src/app/layout.tsx`              | (root)          | HTML shell, Header + Footer      |
| `src/app/page.tsx`                | `/`             | Homepage post list               |
| `src/app/posts/[slug]/page.tsx`   | `/posts/:slug`  | Individual article with MDX      |
| `src/app/tags/page.tsx`           | `/tags`         | Tag index with counts            |
| `src/app/tags/[tag]/page.tsx`     | `/tags/:tag`    | Posts filtered by single tag     |

## SSG Strategy

- **`generateStaticParams()`**: Each dynamic route (`[slug]`, `[tag]`) exports this function to enumerate all valid paths at build time.
- **`generateMetadata()`**: Dynamic `<title>` and `<meta description>` per page.
- **No ISR or SSR**: `output: 'export'` enforces pure static generation.

## Route Params Become File Names — hard rules

This is the single most error-prone thing in the project, because **it fails silently on ASCII and
loudly only on everything else**.

Under `output: 'export'`, the values returned by `generateStaticParams()` are used **directly as
output file names**. So `{ tag: "Claude Code" }` produces the literal file
`out/tags/Claude Code.html`.

Meanwhile a browser requesting `/tags/Claude%20Code` causes the host to **decode the URL first** and
then look for `/tags/Claude Code` — which happens to match, so things work. But if the code had
returned `encodeURIComponent(tag)` from `generateStaticParams()`, the disk would hold the literal
`out/tags/Claude%20Code.html` while the host still looks for the decoded path, and the page 404s.
Pure-ASCII routes are unaffected (encoding is the identity there), which is how this bug survived a
month of "everything looks green" checks.

Rules that follow:

1. **`generateStaticParams()` must return raw values.** `{ tag }`, never `{ tag: encodeURIComponent(tag) }`.
2. **`encodeURIComponent` belongs in `href` attributes only** — see
   `src/components/TagList.tsx`, `src/components/PostCard.tsx` and
   `src/app/posts/[slug]/page.tsx`. That is the URL layer, and it must keep encoding. The two rules
   are not in conflict: one produces a *file name*, the other produces a *link*.
3. **Article slugs (file names under `content/`) must be pure ASCII**, hyphen-separated.
4. **Tag values should be ASCII single tokens.** Spaces still work, but they make the URL ugly, and a
   future refactor is much more likely to get them wrong.
5. Params may arrive already decoded or still encoded depending on the call path, so
   `normalizeTagParam()` wraps `decodeURIComponent` in a `try/catch` — an unbalanced `%` in a tag
   would otherwise throw `URIError`.
6. **`scripts/check-export-paths.ts` enforces rule 1 mechanically**: it runs at the end of
   `npm run build` and fails the build if any output path name contains `%`. See ADR-004.

Rule 6 exists because rules 1–5 are exactly the kind of thing a human reviews and approves. The
guard is what actually holds.

## Post Page MDX Compilation

The post detail page uses `next-mdx-remote/rsc`'s `compileMDX()`:

1. Read raw MDX source from `content/{slug}.mdx`
2. Strip frontmatter with `gray-matter`
3. Compile markdown body via `compileMDX()` with `rehype-pretty-code`
4. Render compiled React elements inside `<div className="prose">`

## Params Pattern (Next.js 15+)

Dynamic route params are typed as `Promise<{ slug: string }>` and must be awaited:

```typescript
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // ...
}
```

## Adding a New Page

1. Create folder under `src/app/` following App Router conventions
2. Export default component (async if fetching data)
3. For dynamic routes, export `generateStaticParams()` — returning **raw** values (see the hard rules above)
4. Optionally export `generateMetadata()` for SEO
5. Update `.ai/project_map.md` routes table
6. Run `npm run check:docs`, then confirm the built page is actually reachable under its
   browser-encoded URL — not just the on-disk name
