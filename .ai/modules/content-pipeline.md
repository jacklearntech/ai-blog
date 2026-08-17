# Content Pipeline Module

## Overview

The content pipeline reads MDX files from the `content/` directory, parses YAML frontmatter metadata, and provides sorted/filtered post data to page components.

## Files

- **`src/lib/posts.ts`** — Core module exporting all content query functions

## Key Types

```typescript
interface PostMeta {
  slug: string;      // Filename without .mdx extension
  title: string;     // From frontmatter
  date: string;      // ISO date string
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

## Adding New Fields

To add a new frontmatter field (e.g., `author`):

1. Add the field to `PostMeta` interface in `src/lib/posts.ts`
2. Map it in the `matter()` extraction block
3. Update `scripts/generate-rss.ts` if the field affects RSS output
4. Update `.ai/modules/content-pipeline.md` (this file)
