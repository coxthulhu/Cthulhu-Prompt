# Repository Guidelines

## Project Description

This repository contains Cthulhu Prompt, a Windows application that stores and helps the user to handle their AI prompts. These prompts are typically used for coding, and can be created, formatted, and organized. Ultimately, these prompts are copied out of the Cthulhu Prompt into an AI coding application like Claude Code, Codex CLI, or other online or on-device AI interfaces.

## Coding Guidelines

- This is the only repository that uses any of this code, so you do not need to maintain backwards compability.
- When adding Svelte lifecycle or reactivity (e.g., `onMount`, `onDestroy`, `tick`, reactive statements), include a short comment explaining its side effect/purpose; in Svelte 5 prefer runes/reactivity and avoid `beforeUpdate`/`afterUpdate`.
- Always use Svelte 5 Runes.
- Always use Svelte 5 Runes to store state instead of using Svelte's stores.
- Always use Svelte 5 snippets. Do not use slots.
- Always follow Svelte 5 best practices. Avoid Svelte 4 styled code.
- Avoid deprecated `<slot>` rendering; prefer `{@render ...}` or explicit children functions to keep Svelte 5 warnings clean.
- When using render functions/snippets, declare `{#snippet ...}` inline inside the consumer’s component tags instead of passing snippet props where possible, to keep markup concise and consistent.

## Project Structure & Module Organization

- `src/main/` — Electron main process (IPC handlers, workspace/prompt APIs).
- `src/preload/` — Safe bridge via `contextBridge` exposing `workspaceAPI`/`promptAPI`.
- `src/renderer/` — Svelte + TypeScript UI. App source in `src/renderer/src` (components, stores, actions, contexts, styles).
- `tests/vitest/` — Unit/integration tests (logic, filesystem with `memfs`).
- `tests/playwright/` — End‑to‑end UI tests; helpers/fixtures under `tests/helpers` and `tests/fixtures`.
- Assets and packaging: `resources/`, `build/`, `electron-builder.yml`.

## Build, Test, and Development Commands

Use Windows `cmd.exe` for **lint**, **typecheck**, and Playwright runs via the shared template below. When invoking them via the tool, set `timeout_ms` to **300000** (300 seconds).

### Windows Command Execution

- Required for Windows-side runs (lint, typecheck, Playwright). Always invoke `cmd.exe` through the `shell` tool with `with_escalated_permissions: true`. Set it every time—even on retries—to avoid sandbox `execvp` errors.
- Include a short justification string explaining why elevation is needed.
- Reusable template (swap the trailing command as needed):
  ```ts
  await shell({
    command: ['cmd.exe', '/C', 'cd /d C:\\Source\\PromptApps\\CthulhuPrompt && <command>'],
    workdir: '/mnt/c/Source/PromptApps/CthulhuPrompt',
    with_escalated_permissions: true,
    justification: 'Windows cmd.exe run needs sandbox access to project artifacts',
    timeout_ms: 300000
  })
  ```

### Common npm Scripts

- Lint / Typecheck (Windows interop): use the template above with `<command>` set to `npm run lint` or `npm run typecheck`; keep `timeout_ms` at 300000.
- Format: `npm run format` — can run in WSL; applies Prettier styling.
- Unit/integration tests: `npm run test:vitest` — can run in WSL.

### Running Playwright (WSL)

Run via Windows `cmd.exe`; reuse the template and set `<command>` to the desired Playwright invocation (e.g., `npm run test:playwright -- --reporter=dot`). Always keep the 300000 ms timeout. If you hit a Svelte hydration/runtime error, search for the exact message online. Typical variants:

- All tests: `cmd.exe /C "cd /d C:\\Source\\PromptApps\\CthulhuPrompt && npm run test:playwright -- --reporter=dot"`
- Single file: `cmd.exe /C "cd /d C:\\Source\\PromptApps\\CthulhuPrompt && npm run test:playwright -- --reporter=dot tests/playwright/TestInfrastructure.test.ts"`
- Single test (recommended): `cmd.exe /C "cd /d C:\\Source\\PromptApps\\CthulhuPrompt && npm run test:playwright -- --reporter=dot tests/playwright/TestInfrastructure.test.ts --grep=no.*window"`
- Single test (keyword): `cmd.exe /C "cd /d C:\\Source\\PromptApps\\CthulhuPrompt && npm run test:playwright -- --reporter=dot tests/playwright/TestInfrastructure.test.ts -g hung"` (avoid spaces; prefer `--grep`)
- Filter across all files: `cmd.exe /C "cd /d C:\\Source\\PromptApps\\CthulhuPrompt && npm run test:playwright -- --reporter=dot --grep=hydrate"`

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
- PRs: include summary, rationale, testing steps, and screenshots/GIFs for UI changes.
- Checks must pass: `lint`, `typecheck`, `test`. Keep PRs focused and reviewable.

## Security & Configuration Tips

- Do not access Node APIs in the renderer; use `src/preload` bridges.
- Avoid broad IPC; validate inputs in `src/main`.
- Never commit secrets; update config (e.g., auto‑update endpoints) via environment or local files.
