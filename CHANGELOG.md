# Changelog

## 0.0.6

### Changes

- Refactored the TanStack data and IPC layers into a unified typed revision/update flow and removed legacy duplicate paths.
- Migrated prompt, prompt-folder, and system-settings drafts to paced autosave transactions with local-only draft collections and improved optimistic mutation handling.

### Fixed

- Enforced a strict draft-sync contract so server updates only apply to already-loaded drafts.
- Patched local-only mutation acceptance for system settings to improve blur/save persistence consistency.
- Added regression coverage for prompt editor font-size persistence.

## 0.0.5

### New Features

- Added a reusable Svelte dropdown menu system and integrated folder actions in prompt folders.
- Added a prompt editor minimum-lines setting.

### Changes

- Migrated to TanStack DB based mutation and query flows (create, update, delete) across the app.
- Refined sidebar and outliner behavior/polish (sizing, hover/focus interactions, and labels/copy).

### Fixed

- Fixed virtualized window measurement padding reactivity and resize hydration timing issues.
- Fixed outliner selection syncing when switching folders.

## 0.0.4

### New Features

- Added a prompt outliner panel for navigating prompts.
- Added prompt folder settings with a folder description editor.
- Added a custom Windows window title bar.
- Added optional example prompts during workspace creation.

### Changes

- Updated workspace storage to use the `Prompts/` folder plus workspace/folder IDs and renamed prompt files.
- Refreshed home screen and settings layouts; settings now autosave and prompt font size applies across the editor.
- Refined virtual list styling to better match Monaco.

### Fixed

- Improved virtualized list scrolling stability (anchoring, DPI snapping, centering) and auto-scroll edge cases.
- Fixed outliner selection behavior on click.
- Prevented root drive workspace selection and duplicate prompt folder names.
- Flushed autosaves on close to avoid losing recent edits.

## 0.0.3

### New Features

- Prompt folder find widget with match navigation and highlighting in prompt titles/bodies (including Monaco editor highlights).

### Changes

- Refined auto-scroll behavior in the prompt editor and prompt folder list (reordering/cursor jumps/find match reveal).
- Small UI polish for the find dialog and list chrome (e.g., sidebar sizing/scroll decoration).

### Fixed

- Auto-scroll offset when adding new lines in the prompt editor.
- Prompt editor row resizing regression after overflow changes.
- Repeated hydration event firing.
- Concurrency issue in prompt folder screen loading.

## 0.0.2

### New Features

- Auto-scrolls the virtualized prompt list to keep the focused title/cursor in view while editing.

### Changes

- Sidebar width/resize handle styling and prompt folder icons updated.

### Fixed

- Monaco overlay widgets (suggest/hover) can render above prompt rows without clipping.
- "No suggestions" widget sizing no longer overflows.
- Disabled Monaco's built-in find/replace shortcuts, which broke some visuals. Will re-implement global find/replace soon.
- Reduced scroll jumps in the virtualized prompt list during hydration/resize.

## 0.0.1

### New Features

- Initial Release!
- Workspace selection and setup.
- Familiar, code-like prompt editor.
- Prompt organization through infinite scrolling prompt folders.
- Local JSON prompt files, easily source-controllable.
