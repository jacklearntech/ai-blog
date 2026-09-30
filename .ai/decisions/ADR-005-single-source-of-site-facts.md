# ADR-005: One Registry for Site Addresses, and a Check That Enforces It

## Status

Accepted (2026-09-30)

## Context

A 2026-09-30 audit of the project's own documentation turned up a single stale fact in three places
at once. The blog had originally been served from a Vercel subdomain that was later retired; the
address `ai-blog-vercel.jacklearn.tech`（已退役，整站 404）was still present in:

1. `CLAUDE.md` — stated as the project's domain
2. `.ai/architecture.md` — stated as the project's domain
3. `scripts/generate-rss.ts` — hard-coded as the **fallback** for `SITE_URL`

The third one was not a documentation problem at all. Vercel's build environment does not set
`SITE_URL`, so the fallback was what actually ran there, and every link in the feed published at
`out/rss.xml` on the Vercel mirror pointed at a domain that returns 404 for the entire site. The
primary site's feed was fine, because the server's release script passed a real `SITE_URL`. So the
defect existed on exactly one of the two hosts, in a file almost nobody reads, with no visible
symptom — the mirror looked healthy.

Meanwhile the root cause of the *documentation* half was structural, not careless. The project's rule
was: update `.ai/` docs first → then change code → verify with `npm run build`. But `npm run build`
validates that the code compiles; it says nothing about documentation. The only step in the rule with
any enforcement power was unrelated to docs, so the documentation requirement sat in a
zero-cost-to-violate state. It was followed while convenient and ignored otherwise, and nothing
detected the difference.

## Decision

1. **Create `site.config.json` as the single registry of externally-visible site facts** — the apex
   domain, the canonical origin, each host with its role and platform, aliases, and a `retired` list
   with retirement dates.
2. **Documentation references the registry instead of restating it.** Docs may say "addresses are
   defined in `site.config.json`"; they may not carry their own copy of a host.
3. **Consumers read from the registry, with no hard-coded fallback.**
   - `scripts/generate-rss.ts` resolves the site origin from `SITE_URL` if set, else from
     `canonicalOrigin` in the registry, else **fails the build**.
   - `ops/release.sh` no longer defines its own site URL; it reads `canonicalOrigin` out of the
     registry and aborts if it cannot.
4. **Add `scripts/check-docs.ts`, run as `npm run check:docs`**, which turns those assertions into
   machine-checkable facts: any `*.jacklearn.tech` mention anywhere in the repository must be
   registered in the config, and naming a retired host is a failure.
5. **Change the doc rule from "docs first" to "change first, document after, then verify"** — with the
   verification being an actual command that fails.

## Rationale

**Why a registry rather than "be careful".** The failure was not that someone forgot to update a
document. It was that *one fact had four copies* and no way to know they agreed. Adding a fifth
instruction to "check all of them" does not scale; collapsing them to one does.

**Why the code must fail rather than fall back.** The hard-coded fallback is what turned a
documentation staleness into a production defect. A default value that is always present is
indistinguishable from a correct value. Making the missing value fatal converts "silently wrong" into
"loudly broken", which is the trade this whole ADR is built on.

**Why the check is a separate command and not part of the build.** Coupling them would mean a stale
date in a document could block deploying an urgent code fix. The check runs where changes are
introduced — `ops/release.sh publish` invokes it before staging, and aborts the release on failure.
The trade-off is explicit: a doc problem blocks the commit path, not the deploy path.

**Why the check has two kinds of exemption.** A check that cannot express "this mention is
historical" gets disabled the first time someone writes an ADR about a retired domain. So:

- A line carrying a retirement marker (`已退役`, `已废弃`, `retired`, ...) is treated as historical
  narrative and allowed — this ADR relies on that exemption itself.
- Mentions inside `content/` are downgraded to warnings. Articles are narrative, not specification. An
  article written in 2026-08 that names the domain of the day is *accurate*; forcing it to be
  rewritten would corrupt the archive to satisfy a linter.

**Why path and npm-script checks ride along.** The same audit found `.ai/project_map.md` describing a
`public/` directory that has never existed, and `CLAUDE.md` advertising `npm run check:docs` before
that script existed. Both are the same shape of error — a claim about the repository that nothing
verified. They cost three lines each to check.

## Trade-offs

- `scripts/check-docs.ts` is heuristic. It skips backticked tokens that look like prose rather than paths
  (relative paths, globs, package names, anything with punctuation), and it skips tokens in a negation
  window. False negatives are accepted; **false positives are not**, because a checker that cries wolf
  gets ignored, which returns the project to the status quo.
- The check must list files including untracked ones, otherwise it misses exactly the newly written
  documents it exists to validate. It therefore uses `git ls-files --cached --others
  --exclude-standard`.
- `--force` still bypasses the check. This is an intentional escape hatch for the case where the
  checker itself is wrong; it is not the normal path, and the failure message says so.
- **A defect that only the negative tests found.** The first version of the path check rejected any
  token containing an empty path segment, which silently excluded every directory-style reference —
  including the one case the check had been written specifically to catch. Running it against the
  clean repository passed happily; only deliberately writing a *wrong* claim about that same
  directory exposed the hole. That is this ADR's own lesson in miniature: a check that has only ever
  been run against correct input has not been tested. The suite is now eleven cases, and it runs
  against the real repository — ten mutations that must be caught or downgraded, plus a correctness
  baseline.
- The negation heuristics are the fragile part, and prose sometimes has to accommodate them: a
  sentence that asserts a directory is absent will be skipped only if the absence is actually stated
  nearby in a recognised form. When a legitimate sentence trips the check, the fix is to phrase the
  claim precisely — not to widen the exemption, which is how a checker loses its teeth.
- Changing a site address is now a two-step operation: edit the registry, then run
  `npm run check:docs` to find the stragglers. That is the point, but it is slower than editing one
  string.

## Consequences

- The retired host can no longer be reintroduced by copying an old document.
- The mirror's RSS feed now carries the same links as the primary one, because both builds resolve the
  same value from the same registry.
- Documentation has a `<!-- last-verified: YYYY-MM-DD -->` stamp, checked for staleness at 90 days.
  ADRs deliberately do **not** carry a stamp: they are a historical record, never rewritten, only
  superseded — which is precisely why they do not drift.
- The honest summary: this ADR does not make documentation accurate. It makes *one class of
  inaccuracy* — claiming a wrong fact about the site itself — impossible to ship. Everything else in a
  document can still be wrong, and only a reader will catch it.
