---
name: github
description: Use the GitHub CLI (`gh`) for GitHub repository workflows from the command line, including authentication, repository and pull request operations, issues, Actions, direct REST/GraphQL API calls, and creating, drafting, publishing, uploading assets to, viewing, downloading, or verifying GitHub releases. Trigger when the user asks how to use `gh`, wants a `gh` command, needs GitHub automation, or needs help creating or publishing releases with GitHub CLI.
---

# GitHub CLI

Use `gh` as the default command-line interface for GitHub operations when the user wants terminal commands or automation. Prefer official `gh` subcommands over raw API calls when they exist; use `gh api` for unsupported operations or when exact REST/GraphQL endpoints are needed.

## Workflow

1. Identify the target repository. Prefer the current Git remote; otherwise pass `-R OWNER/REPO` or set `GH_REPO=OWNER/REPO`.
2. Check authentication for commands that contact GitHub: `gh auth status`. In automation, prefer `GH_TOKEN`/`GITHUB_TOKEN` over interactive login.
3. Choose the narrowest subcommand: `gh repo`, `gh pr`, `gh issue`, `gh release`, `gh run`, `gh workflow`, `gh secret`, `gh variable`, or `gh api`.
4. Use non-interactive flags when the task should be repeatable. Avoid commands that open a browser unless the user asks for an interactive flow.
5. For structured output, use `--json`, `--jq`, or `--template` instead of parsing human-readable text.

## Release Workflows

For release tasks, read `references/gh-cli.md` before giving final commands. Include the appropriate lifecycle:

- Publish immediately: `gh release create <tag> [assets...] --title "..." --notes-file RELEASE_NOTES.md`
- Draft first: `gh release create <tag> --draft ...`, then publish with `gh release edit <tag> --draft=false`
- Generate notes: add `--generate-notes`; optionally add `--notes-start-tag <previous-tag>`
- Require an existing remote tag: add `--verify-tag`
- Upload or replace assets after creation: `gh release upload <tag> <files...>`; use `--clobber` only when replacing assets is intentional
- Verify release state: `gh release view <tag> --json tagName,name,isDraft,isPrerelease,isImmutable,url,assets`

Prefer `--draft` when the user wants to review notes or assets before publishing. Mention that release immutability, when enabled for a repository, applies after publication, not while the release is still a draft.

## References

- `references/gh-cli.md`: command patterns, release checklist, authentication, output formatting, `gh api`, and official documentation links.
