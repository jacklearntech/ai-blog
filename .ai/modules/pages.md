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
3. For dynamic routes, export `generateStaticParams()`
4. Optionally export `generateMetadata()` for SEO
5. Update `.ai/project_map.md` routes table
