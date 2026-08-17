# ADR-002: Post-Build Script for RSS Generation

## Status

Accepted

## Context

The blog needs an RSS feed at `/rss.xml`. With `output: 'export'` (static export), there are limited options for generating additional non-page files:

1. **App Router Route Handler** (`app/rss.xml/route.ts`) — Works in dev but unreliable with static export; may not produce a file in `out/`
2. **Post-build Node script** — Runs after `next build`, writes directly to `out/rss.xml`
3. **Custom webpack plugin** — Complex, tightly coupled to build internals

## Decision

Use a post-build TypeScript script (`scripts/generate-rss.ts`) executed via `tsx`, chained after `next build` in the npm build script.

```json
"build": "next build && npx tsx scripts/generate-rss.ts"
```

## Rationale

- **Reliability**: Directly writes to `out/rss.xml` — guaranteed to exist after build
- **Simplicity**: Plain Node.js script using the same `gray-matter` parsing as the app
- **Decoupled**: Doesn't depend on Next.js internals or Route Handler behavior
- **Type-safe**: Written in TypeScript, executed via `tsx` (already a devDependency)
- **Portable**: Works identically across Vercel, GitHub Actions, local builds

## Trade-offs

- Requires `tsx` as a devDependency
- RSS generation is a separate step (not integrated into Next.js build graph)
- Must manually keep RSS fields in sync with frontmatter schema

## Consequences

- `scripts/generate-rss.ts` reads `content/*.mdx` independently
- `SITE_URL` environment variable controls absolute URLs in feed
- Feed language set to `zh-CN`
- Draft posts (frontmatter `draft: true`) are excluded from feed
