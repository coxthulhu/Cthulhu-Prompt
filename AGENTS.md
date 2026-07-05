# Repository Guidelines

## Project Description

This repository contains Cthulhu Prompt, an Electron application that stores and helps the user to handle their AI prompts. These prompts are typically used for coding, and can be created, formatted, and organized. Ultimately, these prompts are copied out of the Cthulhu Prompt into an AI coding application like Claude Code, Codex CLI, or other online or on-device AI interfaces.

## Response Guidelines

- I do not ask rhetorical questions. Answer my questions before proceeding.
- Do not answer my questions generically or abstractly. Do not speculate. Read over the code and be concrete and specific in your answers.

## Coding Guidelines

- This is the only repository that uses any of this code, so you do not need to maintain backwards compability.
- Backwards compatibility is not required when refactoring.
- When adding Svelte lifecycle or reactivity (e.g., `onMount`, `onDestroy`, `tick`, reactive statements), include a short comment explaining its side effect/purpose; in Svelte 5 prefer runes/reactivity and avoid `beforeUpdate`/`afterUpdate`.
- Always use Svelte 5 Runes.
- Always use Svelte 5 Runes to store state instead of using Svelte's stores.
- Always use Svelte 5 snippets. Never use slots.
- Always follow Svelte 5 best practices. Avoid Svelte 4 styled code.
- Avoid deprecated `<slot>` rendering; prefer `{@render ...}` or explicit children functions to keep Svelte 5 warnings clean.
- When using render functions/snippets, declare `{#snippet ...}` inline inside the consumer’s component tags instead of passing snippet props where possible, to keep markup concise and consistent.
- When creating renderer components, only use colors from `src/renderer/src/styles/palette.css`, and ask permission before adding new colors to that palette.
- When adding colors to `src/renderer/src/styles/palette.css`, follow the rules at the top of that file.
- In `src/renderer/src/common/cthulhu-ui`, use classes for component identity, layout, and reusable visual variants. Compose root and icon classes with `mergeClasses` when accepting caller-provided classes.
- In `cthulhu-ui`, use scoped `data-*` attributes for transient visual state or enum-like styling hooks that CSS consumes, such as `data-variant`, `data-disabled`, `data-invalid`, or drag/drop state. Attribute selectors must be anchored to a component class, e.g. `.cthulhuUiComponent[data-state='true']`.
- In `cthulhu-ui`, use `aria-*` when the state has accessibility meaning, such as `aria-invalid`, `aria-pressed`, `aria-disabled`, or `aria-orientation`. Styling semantic accessibility state with scoped component selectors is acceptable.
- We are only developing support for Windows. Never develop support for other operating systems.
- Do not run prettier or a format command unless explicitly asked.
- When building playwright tests and validating positions, use either 1px or 2px tolerances, not more.

## Project Structure & Module Organization

- `src/main/` — Electron main process (IPC handlers, workspace/prompt APIs).
- `src/preload/` — Safe bridge via `contextBridge` exposing `promptAPI`.
- `src/renderer/` — Svelte + TypeScript UI. App source in `src/renderer/src` (components, stores, actions, contexts, styles).
- `tests/vitest/` — Unit/integration tests (logic, filesystem with `memfs`).
- `tests/playwright/` — End‑to‑end UI tests; helpers/fixtures under `tests/helpers` and `tests/fixtures`.
- Assets and packaging: `resources/`, `build/`, `electron-builder.yml`.

## Build, Test, and Development Commands

For Codex lint + typecheck, Vitest, and Playwright runs, use the WSL wrapper scripts. They run from WSL, change to the repository root, and call Windows `cmd.exe` internally. When invoking these commands via the tool, set `timeout_ms` to **300000** (300 seconds).
Git commands that contact a remote (e.g., `git pull`, `git fetch`) require escalated permissions in the tool call to allow network access.

### Windows Command Execution

- When asked to open a file, folder, or workspace in VS Code, do it from Windows so it opens in the user's Windows VS Code instance.
- Direct Windows commands that do not have a wrapper must use `cmd.exe` with escalated permissions and a short justification.

### Common npm Scripts

- Lint + Typecheck (Windows interop): use `./scripts/wsl-linttypecheck.sh`; keep `timeout_ms` at 300000.
- Format: `npm run format` — can run in WSL; applies Prettier styling.
- Unit/integration tests: use `./scripts/wsl-vitest.sh`; keep `timeout_ms` at 300000.

### Running Playwright (Windows)

For Codex `functions.exec_command` Playwright runs, use `./scripts/wsl-playwright.sh`. The wrapper changes to the repository root in WSL, then calls Windows `cmd.exe` so Playwright still runs in the required Windows environment. Keep the 300000 ms timeout.

Avoid overriding the reporter unless you include the custom reporter, because the default config already uses the dot reporter plus the console/page error reporter. If you hit a Svelte hydration/runtime error, search for the exact message online. Typical variants:
Console/page errors captured during Playwright runs are written to `test-results/renderer-errors.txt` (plain text). If you override the reporter, include it explicitly (e.g., `--reporter=dot,./tests/helpers/RendererErrorReporter.ts`).

- WSL wrapper, all tests: `./scripts/wsl-playwright.sh`
- WSL wrapper, single file: `./scripts/wsl-playwright.sh tests/playwright/TestInfrastructure.spec.ts`
- WSL wrapper, multiple files: `./scripts/wsl-playwright.sh tests/playwright/PromptFoldersMeasuredHeights.spec.ts tests/playwright/UserPersistence.spec.ts`
- WSL wrapper, single test with spaces: `./scripts/wsl-playwright.sh tests/playwright/PromptFoldersPromptManagement.spec.ts --grep "preserves prompt order after navigating away"`

## Coding Style & Naming Conventions

- TypeScript, 2‑space indentation; formatting via Prettier; linting via ESLint (`eslint.config.mjs`).
- Svelte components in PascalCase (`MyComponent.svelte`); shared stores/actions/utilities in `camelCase.ts`.
- Respect path alias `@renderer` → `src/renderer/src`.
- Renderer must call main only through preload APIs; keep IPC channels typed and minimal.

## Testing Guidelines

- Frameworks: Vitest (logic/integration), Playwright (E2E UI).
- Name tests `*.test.ts` under `tests/vitest` or `tests/playwright`.
- Prefer fast unit tests; mock FS with `memfs` where applicable.
- E2E changes should include selectors and user flows to reproduce.

### Writing Playwright Tests

- Review similar tests in `tests/playwright`; copy the closest pattern.
- Initialize: `const { test, describe, expect } = createPlaywrightTestSuite()`.
- Select a workspace and start:
  - `const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' | 'sample' | 'empty' | 'virtual' | 'height', path?: '/ws/...', autoSetup?: boolean } })`
  - `autoSetup` defaults to true; set `false` and call `await testHelpers.setupWorkspaceViaUI()` to exercise the dialog.
- Prefer `testHelpers` and `[data-testid=...]` selectors; avoid raw text when mapped.

```ts
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
const { test, describe, expect } = createPlaywrightTestSuite()

describe('My Feature', () => {
  test('works with a minimal workspace', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.locator('[data-testid="nav-button-home"]')).toBeVisible()
  })
})
```

## Commit & Pull Request Guidelines

- Commits: short, imperative present tense (e.g., “Fix tests”, “Add virtualization test”); group related changes; reference issues.
- Never run `git commit` and `git push` in parallel; finish the commit first, then push in a separate step.
- Git commands that write to `.git` must use escalated permissions in the tool call, even when they do not contact a remote. This includes `git commit`, `git merge`, `git rebase`, `git cherry-pick`, `git stash`, `git tag`, and any retry after a `.git/index.lock` or read-only filesystem error.
- For `git commit`, request escalation with a scoped persistent prefix rule for `["git", "commit"]` when available.
- PRs: include summary, rationale, testing steps, and screenshots/GIFs for UI changes.
- Checks must pass: `lint` + `typecheck` (run together), `test`. Keep PRs focused and reviewable.

## Security & Configuration Tips

- Do not access Node APIs in the renderer; use `src/preload` bridges.
- Avoid broad IPC; validate inputs in `src/main`.
- Never commit secrets; update config (e.g., auto‑update endpoints) via environment or local files.
