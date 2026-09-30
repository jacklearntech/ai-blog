# ADR-004: Fail the Build on Escaped Output Paths

## Status

Accepted (2026-09-29)

## Context

Under `output: 'export'`, Next.js uses the values returned by `generateStaticParams()` **directly as
output file names**.

`src/app/tags/[tag]/page.tsx` returned `{ tag: encodeURIComponent(tag) }`. For a tag like
`Claude Code` the build therefore wrote a file literally named:

```
out/tags/Claude%20Code.html
```

Every host serving that output decodes the incoming URL before mapping it to a file. A browser
requesting `/tags/Claude%20Code` becomes `/tags/Claude Code` at the host, which does not match
`Claude%20Code.html`. Result: 404 on every tag containing a space or non-ASCII character.

The tag index page (`/tags`) kept working, because it only enumerated the links; the links themselves
were what broke. And for pure-ASCII tags, encoding is the identity function — so the bug was
invisible in the most obvious test cases. The site passed every check that was run against it for
about a month.

## Decision

Fix the route (return raw values), and add a build-time guard that makes the whole class of bug
unshippable: `scripts/check-export-paths.ts`.

It runs as the last step of `npm run build`, scans the output directory, and:

- **fails the build** if any path name contains `%`, printing the likely source and the correct pattern;
- **lists but does not fail on** path names containing spaces or non-ASCII characters, as a reminder
  that those URLs must be tested in their browser-encoded form after deploy.

## Rationale

The bug had three properties that made review-based prevention unreliable:

1. **It failed silently for the common case.** ASCII tags worked; nothing looked wrong.
2. **The broken artefact was a file name**, which nobody reads. Reviewing the diff of
   `src/app/tags/[tag]/page.tsx` showed a plausible-looking `encodeURIComponent` call — the kind of
   line that looks *more* careful than the correct one.
3. **The symptom appeared one layer away** from the cause — in the host's URL decoding, not in the
   React code.

Given that, the useful question is not "how do we review this better" but "what would have to be
true for this to be impossible to ship". A post-build scan of the actual artefact answers that
directly, and it costs one line in `package.json`.

`gzip` and the deploy self-checks were considered as the enforcement point and rejected: they run
conditionally, they live outside the build, and they only cover the paths someone remembered to list.
The npm build chain runs everywhere the code is built — including the Vercel build, which has no
access to the deploy script at all. The guard is therefore on both hosts by construction.

## Trade-offs

- The check is a **post-build** scan, so a failure wastes a full build. Accepted: it is a
  once-per-regression cost, not a per-build one.
- It is deliberately **not** part of the docs checker (`npm run check:docs`). Code correctness and doc
  correctness fail for different reasons and should be able to fail independently — see
  `.ai/architecture.md`.
- It only detects paths that are already wrong. It cannot detect a *missing* page (e.g. a route that
  should have been generated and was not). That is what the deploy self-checks cover.

## Consequences

- The correct pattern is now unambiguous and written down in `.ai/modules/pages.md`:
  `generateStaticParams()` returns raw values; `encodeURIComponent` stays in `href` attributes.
- Adding any dynamic route with non-ASCII parameters is now safe by default: either the parameters
  are encoded on disk (build fails, you fix it) or they are not (build passes, host matches).
- The guard prints the remediation pattern on failure, so the fix is available without reading this
  ADR.
