# GitHub CLI Reference

Use this reference when a user asks for `gh` commands, GitHub automation, or release creation and publishing.

Official docs checked:

- Manual overview: https://cli.github.com/manual/
- Top-level commands: https://cli.github.com/manual/gh
- Authentication login: https://cli.github.com/manual/gh_auth_login
- Authentication status: https://cli.github.com/manual/gh_auth_status
- Environment variables: https://cli.github.com/manual/gh_help_environment
- API command: https://cli.github.com/manual/gh_api
- Releases: https://cli.github.com/manual/gh_release
- Release create: https://cli.github.com/manual/gh_release_create
- Release upload: https://cli.github.com/manual/gh_release_upload
- Release view: https://cli.github.com/manual/gh_release_view
- Release download: https://cli.github.com/manual/gh_release_download
- Release verify: https://cli.github.com/manual/gh_release_verify
- Windows install docs: https://github.com/cli/cli/blob/trunk/docs/install_windows.md

## Install And Authenticate

Windows install:

```powershell
winget install --id GitHub.cli
gh --version
```

Interactive login:

```bash
gh auth login
gh auth status
```

Browser login with device-code copied to clipboard:

```bash
gh auth login --web --clipboard
```

Headless or automation authentication:

```bash
# GitHub.com
set GH_TOKEN=<token>

# GitHub Enterprise Server
set GH_ENTERPRISE_TOKEN=<token>
set GH_HOST=<hostname>
```

In GitHub Actions, use `GH_TOKEN: ${{ github.token }}` in the step environment. Prefer environment tokens for automation and CI instead of `gh auth login --with-token`.

## Repository Targeting

Most `gh` commands infer the repository from the current Git remote. To target another repository:

```bash
gh pr list -R OWNER/REPO
gh issue view 123 -R OWNER/REPO
gh release list -R OWNER/REPO
```

For scripts that run outside a Git checkout:

```bash
set GH_REPO=OWNER/REPO
gh release list
```

For GitHub Enterprise, use `[HOST/]OWNER/REPO` with `-R` or set `GH_HOST`.

## Structured Output

Prefer structured output over parsing display text:

```bash
gh pr view 123 --json title,author,state,url
gh release view v1.2.3 --json tagName,name,isDraft,url,assets
gh run list --json databaseId,status,conclusion,workflowName
```

Filter with jq:

```bash
gh release view v1.2.3 --json assets --jq '.assets[].name'
```

Format with Go templates when the user needs a compact human-readable table:

```bash
gh pr list --json number,title,author --template '{{range .}}{{printf "#%v %s @%s\n" .number .title .author.login}}{{end}}'
```

## Common Command Families

Repositories:

```bash
gh repo view OWNER/REPO
gh repo clone OWNER/REPO
gh repo create my-project --private --source=. --remote=origin --push
```

Pull requests:

```bash
gh pr status
gh pr list --state open
gh pr view 123 --web
gh pr checkout 123
gh pr create --title "Title" --body-file body.md
gh pr merge 123 --squash --delete-branch
```

Issues:

```bash
gh issue list --label bug
gh issue view 123
gh issue create --title "Title" --body-file issue.md
gh issue comment 123 --body-file comment.md
```

Actions:

```bash
gh workflow list
gh workflow run build.yml
gh run list
gh run view <run-id> --log
gh run watch <run-id>
```

Secrets and variables:

```bash
gh secret set NAME --body "value"
gh variable set NAME --body "value"
gh secret list
gh variable list
```

## Direct API Calls

Use `gh api` for operations without a first-class `gh` subcommand, or when exact REST/GraphQL behavior matters.

REST examples:

```bash
gh api repos/{owner}/{repo}/releases
gh api repos/{owner}/{repo}/issues/123/comments -f body='Hi from CLI'
gh api -X GET search/issues -f q='repo:{owner}/{repo} is:open label:bug'
```

Typed fields with `-F` convert `true`, `false`, `null`, and integers to JSON types and expand placeholders like `{owner}` and `{repo}`. Raw fields with `-f` send string values.

Read request body from a file:

```bash
gh api repos/{owner}/{repo}/rulesets --method POST --input ruleset.json
```

Paginate:

```bash
gh api repos/{owner}/{repo}/issues --paginate
gh api repos/{owner}/{repo}/issues --paginate --slurp
```

GraphQL:

```bash
gh api graphql -F owner='{owner}' -F name='{repo}' -f query='
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      releases(last: 3) {
        nodes { tagName name isDraft }
      }
    }
  }
'
```

## Creating And Publishing Releases

Always clarify or infer:

- Release tag, such as `v1.2.3`
- Target branch or commit, if not the default branch
- Whether to create/push a tag before release or require an existing remote tag
- Whether this is a draft, prerelease, or normal published release
- Release notes source: inline text, file, tag annotation, or generated notes
- Asset files and labels

Create and publish immediately:

```bash
gh release create v1.2.3 --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Create and publish with generated notes:

```bash
gh release create v1.2.3 --generate-notes
```

Generate notes from a specific previous tag:

```bash
gh release create v1.2.3 --generate-notes --notes-start-tag v1.2.2
```

Create a release only if the remote tag already exists:

```bash
gh release create v1.2.3 --verify-tag --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Create the tag from a specific branch or commit if it does not already exist:

```bash
gh release create v1.2.3 --target main --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Create a draft for review:

```bash
gh release create v1.2.3 --draft --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Publish an existing draft:

```bash
gh release edit v1.2.3 --draft=false
```

Mark as prerelease:

```bash
gh release create v2.0.0-beta.1 --prerelease --generate-notes
```

Avoid marking as latest:

```bash
gh release create v1.2.3 --latest=false --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Create with assets:

```bash
gh release create v1.2.3 ./dist/*.zip ./dist/*.msi --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Create with an asset display label by appending `#Label` to the asset path:

```bash
gh release create v1.2.3 './dist/app-windows.zip#Windows zip' --title "v1.2.3" --notes-file RELEASE_NOTES.md
```

Upload assets after release creation:

```bash
gh release upload v1.2.3 ./dist/*.zip ./dist/*.msi
```

Replace existing assets intentionally:

```bash
gh release upload v1.2.3 ./dist/app-windows.zip --clobber
```

`--clobber` deletes existing assets of the same name before uploading replacements. If the upload fails, the original assets can be lost.

View and verify a release:

```bash
gh release view v1.2.3 --json tagName,name,isDraft,isPrerelease,isImmutable,url,assets
gh release verify v1.2.3
```

Download release assets:

```bash
gh release download v1.2.3
gh release download v1.2.3 --pattern '*.msi' --dir dist/release
gh release download v1.2.3 --archive=zip
```

Release immutability note: when a repository has release immutability enabled, tag and asset protections apply only after the release is published. Draft releases and their associated tags/assets can still be changed or deleted before publishing.

## Practical Release Checklist

1. Confirm the working tree and branch are correct.
2. Confirm the version/tag name.
3. Build artifacts locally or in CI.
4. Decide whether to create a draft first.
5. Use `--verify-tag` if release policy requires tags to be created and pushed before release publication.
6. Use `--generate-notes` for GitHub-generated notes, or `--notes-file` for curated notes.
7. Upload assets during `gh release create` or with `gh release upload`.
8. Inspect the release with `gh release view ... --json ...`.
9. Publish drafts with `gh release edit <tag> --draft=false`.
10. Verify attestations with `gh release verify <tag>` when the project publishes them.
