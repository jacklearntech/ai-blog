# ADR-003: Server as the Content Source, GitHub as the Backup

## Status

Accepted (2026-09-29)

## Context

The blog is published to a self-hosted server and mirrored to Vercel, both fed from the same GitHub
repository. The original flow was pull-based: edit locally → push to `main` → the server pulls on a
schedule and rebuilds.

Two problems showed up in practice:

1. **GitHub became a test bench.** A broken revision was pushed *first* and built *second*. When the
   build failed, the broken source was already sitting in the remote, and cleaning it up was manual.
2. **A revision could sit undeployed indefinitely.** A footer change (ICP + 公安备案 numbers) stayed
   undeployed for 29 days, because nothing forced the pipeline to run nor reported that the live site
   no longer matched the repository.

## Decision

Make the server the source of truth for content, and the repository a backup. `ops/release.sh` has
two modes:

```
ops/release.sh deploy                # pull GitHub → build → go live           (cron, every 10 min)
ops/release.sh publish "message"     # commit → build → self-check → go live → push to GitHub
```

The ordering is the whole point: **the push executes only after the build and the post-deploy
self-checks both succeed.**

## Rationale

- **The remote can never receive a broken revision**, because a failed build never reaches the push step.
- **A failed publish is fully reversible.** The output directory is restored from a pre-build copy, and
  the commit is undone with `git reset --soft HEAD~1`, which keeps the file changes in the working tree
  so they can be fixed and retried.
- **Idempotent.** A state file records the last successfully deployed local HEAD, so a re-run with
  nothing new exits immediately. A second state file records the last failing revision so the cron job
  skips it instead of burning CPU every ten minutes.

## Trade-offs

- The recorded "deployed revision" had to be redefined as the **local HEAD** rather than `origin/main`,
  since the local branch may legitimately be ahead of the remote.
- `deploy` needs a guard (skip when there are unpushed local commits) so the cron job cannot compete
  with a manual publish for control of the checkout.
- The commit step uses an explicit allow-list of paths to `git add`. Anything outside the list is
  silently not committed — this has already caused two near-misses (a new directory, then two new root
  files). Adding a top-level file or directory therefore requires updating the list.

## Consequences

- Publishing one article is a single command.
- The failure path is tested deliberately rather than assumed: an intentionally broken page was
  published to confirm that the exit code is non-zero, the output directory rolls back, the remote
  stays untouched, and the broken source file survives in the working tree.
- Repository prerequisites: a write-capable key on the server, and a configured commit identity.
  Without the latter, git silently invents `user@hostname` as the author of every automated commit.
