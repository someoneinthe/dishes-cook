---
name: release-status
description: Report what the next dishes-cook release will contain and whether it's ready to ship. Use when the user asks about the next release, the release PR, or the changelog.
---

1. Find the open release-please PR: `gh pr list --label "autorelease: pending" --json number,title,url,body`.
2. If there is one, summarize its version and changelog. If not, list commits since the last tag (`git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..origin/main --oneline`) and predict the bump (`feat` → minor, `fix`/`perf` → patch; while `0.x`, breaking → minor).
3. Check the latest `CI` and `Release` workflow runs on `main` (`gh run list --branch main --limit 5`).
4. Report: next version, user-facing changes, CI status, and any blockers (failing checks, missing signing secrets noted in `docs/release.md`).

Do not merge the release PR yourself; merging publishes a release. Tell the user it's ready and let them merge.
