<!-- last-verified: 2026-09-30 -->

# Content Pipeline Module

## Overview

The content pipeline reads MDX files from the `content/` directory, parses YAML frontmatter metadata, and provides sorted/filtered post data to page components.

## Files

- **`src/lib/posts.ts`** — Core module exporting all content query functions
- **`scripts/generate-rss.ts`** — Independent reader of the same `content/` directory (see ADR-002)

Two readers, one source of truth for the *files*; keep them in step when the frontmatter schema changes.

## Key Types

```typescript
interface PostMeta {
  slug: string;      // Filename without .mdx extension — also the URL slug
  title: string;     // From frontmatter, falls back to slug
  date: string;      // Normalized toISOString()
  summary?: string;  // Short description for listings
  tags?: string[];   // Categorization labels
}
```

## Exported Functions

| Function            | Returns          | Description                                    |
| ------------------- | ---------------- | ---------------------------------------------- |
| `getAllPosts()`     | `PostMeta[]`     | All posts sorted by date descending            |
| `getPostBySlug()`   | `PostMeta \| null` | Single post lookup by slug                   |
| `getAllTags()`      | `{tag, count}[]` | Aggregated tags sorted by frequency            |
| `getPostsByTag()`   | `PostMeta[]`     | Posts matching a tag (case-insensitive)        |

## How It Works

1. Reads all `.mdx` files from `content/` via `fs.readdirSync`
2. Parses each file's YAML frontmatter with `gray-matter`
3. Constructs `PostMeta` objects from parsed data
4. Sorts by date (newest first) for listing pages

## Frontmatter Fields That Do Not Behave As Expected

### `draft` is not a real draft switch

`scripts/generate-rss.ts` skips entries with `draft: true`, but **`src/lib/posts.ts` never reads the
field**. A "draft" therefore still appears on the homepage and still gets its own `/posts/<slug>`
page — it only disappears from `out/rss.xml`.

To actually keep something unpublished, keep the file out of `content/`. This is documented here
because the field *looks* supported: it is read by one of the two readers, which is worse than not
existing at all. Either implement it in `src/lib/posts.ts` or remove it from the RSS script — leaving
it half-wired is the trap.

### File name === URL slug

`slug` is derived from the filename, and `generateStaticParams()` in
`src/app/posts/[slug]/page.tsx` feeds it straight into the output file name. Slugs must therefore be
**pure ASCII**. See `.ai/modules/pages.md` for the full naming rules.

## Adding New Fields

To add a new frontmatter field (e.g., `author`):

1. Add the field to `PostMeta` interface in `src/lib/posts.ts`
2. Map it in the `matter()` extraction block
3. Update `scripts/generate-rss.ts` if the field affects RSS output
4. Update this file, and `README.md`'s frontmatter table if authors will use the field
5. Run `npm run check:docs` before committing

Step 4 is the one that historically got skipped — which is exactly why step 5 exists.
