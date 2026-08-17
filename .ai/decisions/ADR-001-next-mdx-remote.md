# ADR-001: Use next-mdx-remote Instead of @next/mdx

## Status

Accepted

## Context

The blog needs to compile MDX files with `rehype-pretty-code` for syntax highlighting. Two primary approaches exist in the Next.js ecosystem:

1. **`@next/mdx`** — Webpack/Turbopack loader that compiles `.mdx` files as importable modules
2. **`next-mdx-remote/rsc`** — Server Component library that compiles MDX source strings at render time

## Decision

Use `next-mdx-remote/rsc` with `compileMDX()` in React Server Components.

## Rationale

### Why Not @next/mdx

- **Turbopack incompatibility**: Next.js 16 defaults to Turbopack, which does not support dynamic imports of arbitrary `.mdx` files (`import(\`../content/${slug}.mdx\`)` fails at build time).
- **Serialization error**: Passing rehype plugin instances (like `rehypePrettyCode`) as options to `@next/mdx` causes "does not have serializable options" errors under Turbopack. String-based plugin references also fail.
- These issues are documented and unresolved as of Next.js 16.x + Turbopack.

### Why next-mdx-remote

- Compiles MDX source strings in RSC — no file imports needed
- Rehype plugins passed as direct object references (no serialization)
- Fully compatible with `output: 'export'` static generation
- Well-maintained by HashiCorp/Next.js ecosystem
- Build-time compilation via `generateStaticParams` ensures all pages are pre-rendered

## Trade-offs

- Slightly slower build per page (compiles MDX at SSG time vs. webpack loader caching)
- Cannot use MDX files as direct page routes (must read source + compile manually)
- Adds `next-mdx-remote` as a dependency

## Consequences

- Post pages use `compileMDX({ source, options })` pattern
- `next.config.ts` remains simple (no MDX loader config needed)
- `@next/mdx`, `@mdx-js/loader` remain installed but unused (can be removed)
