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

## RSS Entry Points

`/rss.xml` is **not a route**. It is written into `out/` after `next build` by
`scripts/generate-rss.ts` (ADR-002), so there is no page component to hang a link off. The feed is
surfaced from three places instead:

| Entry point              | Location                                          | Purpose                                                        |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------- |
| Homepage subscribe pill  | `src/app/page.tsx`                                | The visible button a reader actually clicks                     |
| Footer link              | `src/components/Footer.tsx`                        | Reachable from article and tag pages as well                    |
| Head autodiscovery       | `src/app/layout.tsx` → `metadata.alternates.types` | Lets a feed reader find the feed from the site URL alone        |

The glyph is `src/components/RssIcon.tsx` — a hand-written inline SVG, so no icon-library dependency
enters the client bundle.

Two deliberate choices here, both easy to "fix" into a bug:

- **Every entry point uses the relative path `/rss.xml`.** Relative hrefs resolve against whichever
  host serves the page, which is exactly what is needed when the same build output is published to
  two different origins (see `site.config.json`). It also keeps domains out of `src/` completely.
- **`metadataBase` in `src/app/layout.tsx` comes from `site.config.json`.** That is what turns the relative
  `alternates` value into an absolute URL in the emitted `<link>` tag. Hardcoding a domain next to it
  would re-create the duplicate-fact problem that ADR-005 exists to prevent — except this duplicate
  would sit in `src/`, where nothing checks it.

## Metadata Routes (machine-facing files)

Some files in `out/` are not pages and are not produced by a post-build script either — they come
from a **metadata route** in `src/app/`. This is the mechanism to use for any machine-facing file:

| Output         | Source                | Purpose                                                      |
| -------------- | --------------------- | ------------------------------------------------------------ |
| `/robots.txt`  | `src/app/robots.ts`   | Crawler policy                                               |
| `/sitemap.xml` | `src/app/sitemap.ts`  | URL inventory — home, tag index, every post, every tag page   |

Two rules apply to all of them:

1. **They must declare `export const dynamic = "force-static"`.** Under `output: 'export'` Next
   otherwise treats a metadata route as a possibly-dynamic handler and **fails the build outright**
   with *`export const dynamic = "force-static"/export const revalidate not configured`*. The first
   attempt at `src/app/robots.ts` died exactly this way — worth remembering before writing the next
   one.
2. **Never restate a fact inside them.** Both metadata routes need the site address, and both read it
   from `site.config.json` instead of typing the domain in. That is the pattern to copy for the next
   one. See ADR-005.

### Why there is no public/ directory

Machine-facing files could also be dropped into a public folder, but that door is deliberately closed
here, for two reasons. First, no such directory exists in this repo. Second — and this is the one that
actually bites — the name `public` is **not** in the commit whitelist of `ops/release.sh`, so anything
placed there would serve correctly on the server and never reach GitHub. A file that is live but absent
from the backup is the worst failure mode available, so metadata routes are the only route.

Note the deliberate formatting: backticks in these docs mean "this is a real repository path", so a
path that does not exist is written plain rather than quoted. `npm run check:docs` enforces the same
rule mechanically, and the correct response to it flagging a non-existent path is to stop presenting
that path as real — not to relax the check.

### Why `robots.txt` says nothing but "allow everything"

`robots.txt` is a **request to well-behaved crawlers, not access control**. Everything this site
actually wants to keep out — scanners, probe paths, empty user agents — is already answered with
`444` at the nginx layer. Copying those rules here would publish the blocklist to precisely the
people it is aimed at, and would not stop anyone who ignores `robots.txt` anyway. "Allow everything"
is also the honest description of a public blog with no admin area, no API and no private paths.

The one directive beyond the rules is the `Sitemap:` line, and it is safe to include only because
`/sitemap.xml` is produced by a sibling metadata route in the same build — see below. An earlier
version of this file deliberately omitted that line while the sitemap did not exist yet, on the
grounds that pointing crawlers at a 404 is worse than saying nothing.

### What `/sitemap.xml` lists, and why not "every `.html` in the output"

The sitemap is built from the same `content/` reading functions the site itself uses
(`getAllPosts()` / `getAllTags()`), so it lists exactly four kinds of URL: the home page, the tag
index, every post, and every tag page — 11 entries at the time of writing.

Globbing the output directory instead would be the obvious shortcut and is wrong: `out/` also
contains `404.html` and `_not-found.html`, plus a pile of RSC prefetch payloads under `out/tags/`
(`__next._full.txt`, `__next._tree.txt`, one `<tag>.txt` per tag). Those are build artefacts, not
pages; the sitemap should describe the set a reader can actually navigate to by clicking.

Two properties worth preserving if this file is ever edited:

- **Absolute URLs, always from `canonicalOrigin`, even on the mirror.** Same rule as the RSS feed:
  one body of content served from two domains can only have one canonical address, so the mirror's
  own copy of the sitemap also points at the primary. Making the mirror self-canonical would be a
  change to `site.config.json`, never a conditional inside the route.
- **`lastmod` on the static pages is the newest post's date, not `new Date()`.** A build timestamp
  changes on every deploy and would claim the whole site was modified today; once crawlers learn the
  signal is noise, the entire `lastmod` column stops being read. Home and tag index genuinely only
  change when a post is added, so the post date is both truthful and more useful.

Tag URLs here are **percent-encoded** (`/tags/Claude%20Code`), while `generateStaticParams()` returns
the raw tag. That is not an inconsistency — it is the same rule as everywhere else, and getting it
backwards is what caused the original tag-page 404s. See the hard rules below.

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
