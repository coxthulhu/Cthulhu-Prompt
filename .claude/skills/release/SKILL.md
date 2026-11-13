---
name: release
description: Cthulhu Prompt release process. Use when asked to release, patch a release, or promote a prerelease to stable.
---

# Release

Daily work stays on `main`. Pushing a `v*` tag runs `.github/workflows/publish-windows.yml`, which builds Windows installers and runs `scripts/publish-release.mjs` to publish the release with notes from that version's `CHANGELOG.md` section. `0.0.x` and `x.y.0` publish as prereleases; other `x.y.z` patches publish as stable. `package.json` always holds the last released version of its branch.

## Release from main

Next version: `0.0.(x+1)` during alpha, otherwise `0.(n+1).0`.

1. On a clean, up-to-date `main`, review `git log $(git describe --tags --abbrev=0)..HEAD`.
2. Add `## X.Y.Z` to the top of `CHANGELOG.md`, using `### New Features`, `### Changes`, and `### Fixed` (omit empty ones) in the style of earlier entries.
3. Set the version in `package.json` and both top-level `version` fields of `package-lock.json`.
4. Commit those three files as `Release vX.Y.Z`, then `git tag -a vX.Y.Z -m vX.Y.Z`.
5. `git push origin main`, then `git push origin vX.Y.Z`.
6. Watch the run with `gh run list --workflow publish-windows.yml --limit 1` and `gh run watch <id> --exit-status`, then confirm with `gh release view vX.Y.Z`.

## Patch an older release

1. Commit the fix on `main` first, unless it doesn't apply there.
2. Switch to `release/0.N`, creating it with `git switch -c release/0.N v0.N.0` if needed.
3. Cherry-pick the fix (or commit it here), then follow Release steps 2–6 with version `0.N.M`, pushing `release/0.N` instead of `main`.
4. Back on `main`, add the same `## 0.N.M` section to `CHANGELOG.md` in version order, commit it, and push.

## Promote a prerelease to stable

`gh release edit vX.Y.Z --prerelease=false --latest`
