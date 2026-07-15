# CLAUDE.md

Guidance for Claude Code working in this repository. Adapted from `AGENTS.md` (which is written for Codex tooling); this file translates the same intent to Claude Code's tools and conventions.

## Project Description

This repository contains Cthulhu Prompt, an Electron application that stores and helps the user handle their AI prompts. These prompts are typically used for coding, and can be created, formatted, and organized. Ultimately, they are copied out of Cthulhu Prompt into an AI coding application like Claude Code, Codex CLI, or other online or on-device AI interfaces.

## Response Guidelines

- Do not ask rhetorical questions. Answer the user's questions before proceeding.
- Do not answer generically or abstractly, and do not speculate. Read the code and be concrete and specific.

## Coding Guidelines

- This is the only repository that uses this code, so backwards compatibility is never required, including when refactoring.
- Always use Svelte 5 Runes for state instead of Svelte stores. Always follow Svelte 5 best practices; avoid Svelte 4-style code.
- When adding Svelte lifecycle or reactivity (`onMount`, `onDestroy`, `tick`, reactive statements), add a short comment explaining its side effect/purpose. Prefer runes/reactivity; avoid `beforeUpdate`/`afterUpdate`.
- Always use Svelte 5 snippets — never slots. Avoid deprecated `<slot>`; prefer `{@render ...}` or explicit children functions to keep Svelte 5 warnings clean.
- When using snippets, declare `{#snippet ...}` inline inside the consumer's component tags instead of passing snippet props where possible, to keep markup concise.
- When creating renderer components, only use colors from `src/renderer/src/styles/palette.css`. Ask permission before adding new colors, and follow the rules at the top of that file.
- In `src/renderer/src/common/cthulhu-ui`:
  - Use classes for component identity, layout, and reusable visual variants. Compose root and icon classes with `mergeClasses` when accepting caller-provided classes.
  - Use scoped `data-*` attributes for transient visual state or enum-like styling hooks (e.g. `data-variant`, `data-disabled`, `data-invalid`, drag/drop state). Attribute selectors must be anchored to a component class, e.g. `.cthulhuUiComponent[data-state='true']`.
  - Use `aria-*` when the state has accessibility meaning (`aria-invalid`, `aria-pressed`, `aria-disabled`, `aria-orientation`). Styling semantic accessibility state with scoped component selectors is acceptable.
- We only develop support for Windows. Never develop support for other operating systems.
- Do not run prettier or a format command unless explicitly asked.

## Project Structure & Module Organization

- `src/main/` — Electron main process (IPC handlers, workspace/prompt APIs).
- `src/preload/` — Safe bridge via `contextBridge` exposing `promptAPI`.
- `src/renderer/` — Svelte + TypeScript UI. App source in `src/renderer/src` (components, stores, actions, contexts, styles).
- `tests/vitest/` — Unit/integration tests (logic, filesystem with `memfs`).
- `tests/playwright/` — End-to-end UI tests; helpers/fixtures under `tests/helpers` and `tests/fixtures`.
- Assets and packaging: `resources/`, `build/`, `electron-builder.yml`.

## Build, Test, and Development Commands

This repo lives on a Windows filesystem accessed from WSL:

- WSL path: `/mnt/c/Source/PromptApps/CthulhuPromptPublic`
- Windows path: `C:\Source\PromptApps\CthulhuPromptPublic`

Lint, typecheck, and Vitest must run in the Windows environment. From the Bash tool, invoke Windows `cmd.exe` directly. Give these commands a generous timeout (300000 ms / 300s).

- **Lint + Typecheck** (run together):
  ```bash
  cmd.exe /C "cd /d C:\Source\PromptApps\CthulhuPromptPublic && npm run lint && npm run typecheck"
  ```
- **Unit/integration tests** (Vitest, via Windows cmd):
  ```bash
  cmd.exe /C "cd /d C:\Source\PromptApps\CthulhuPromptPublic && npm run test:vitest"
  ```
- **Format**: `npm run format` — can run directly in WSL; applies Prettier styling. Only run when explicitly asked.

### Running Playwright

Playwright must run in the Windows environment. Use the wrapper, which changes to the repo root in WSL and then calls Windows `cmd.exe`:

- All tests: `./scripts/wsl-playwright.sh`
- Single file: `./scripts/wsl-playwright.sh tests/playwright/TestInfrastructure.spec.ts`
- Multiple files: `./scripts/wsl-playwright.sh tests/playwright/PromptFoldersMeasuredHeights.spec.ts tests/playwright/UserPersistence.spec.ts`
- Single test by name: `./scripts/wsl-playwright.sh tests/playwright/PromptFoldersPromptManagement.spec.ts --grep "preserves prompt order after navigating away"`

Keep the 300000 ms timeout. Don't override the reporter unless you include the custom one — the default config uses the dot reporter plus the console/page error reporter. Console/page errors are written to `test-results/renderer-errors.txt`. If you do override, include it explicitly (e.g. `--reporter=dot,./tests/helpers/RendererErrorReporter.ts`). If you hit a Svelte hydration/runtime error, search for the exact message online.

### Sandbox & permissions notes (Claude Code)

- Windows `cmd.exe` runs and Playwright may need filesystem access outside the sandbox. If a command fails with a sandbox/`execvp` error, re-run it with `dangerouslyDisableSandbox: true` on the Bash call.
- Git commands that contact a remote (`git pull`, `git fetch`, `git push`) need network access; run them outside the sandbox. If interactive auth is required, suggest the user run it via the `!` prefix in the prompt.

## Coding Style & Naming Conventions

- TypeScript, 2-space indentation; formatting via Prettier; linting via ESLint (`eslint.config.mjs`).
- Svelte components in PascalCase (`MyComponent.svelte`); shared stores/actions/utilities in `camelCase.ts`.
- Respect path alias `@renderer` → `src/renderer/src`.
- The renderer must call main only through preload APIs; keep IPC channels typed and minimal.

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

- Commit or push only when the user asks.
- Commits: short, imperative present tense (e.g. "Fix tests", "Add virtualization test"); group related changes; reference issues.
- Never run `git commit` and `git push` in parallel; finish the commit first, then push in a separate step.
- Write plain commit messages. Never add a `Co-Authored-By` trailer or any model-credit line.
- PRs: include summary, rationale, testing steps, and screenshots/GIFs for UI changes. Keep PRs focused and reviewable.
- Checks must pass: `lint` + `typecheck` (run together), and tests.

## Security & Configuration Tips

- Do not access Node APIs in the renderer; use `src/preload` bridges.
- Avoid broad IPC; validate inputs in `src/main`.
- Never commit secrets; update config (e.g. auto-update endpoints) via environment or local files.
