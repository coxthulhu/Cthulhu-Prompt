# Flat UI Migration

This is the working list of cthulhu-ui components that still need flat migration work.
It only includes components with live imports from app/feature code, dev tools, or current `Flat*`
wrappers.

## App-Facing Components

- [ ] `InfoRow.svelte`
  - Used by `features/prompt-folders/PromptFolderSettingsRow.svelte` and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatInfoRow` equivalent using only flat palette tokens.
- [ ] `InlineTextButton.svelte`
  - Used by `features/sidebar/PromptTreeVisibilityToggleRow.svelte`.
  - Needs a `FlatInlineTextButton` equivalent using only flat palette tokens.
## Completed

- [x] Renamed `LoadingOverlay.svelte` to `FlatLoadingOverlay.svelte`.
  - `app/AppOverlays.svelte`, `features/prompt-folders/PromptFolderScreen.svelte`, and the dev
    tools catalog now import the flat-prefixed component directly.
  - Kept the overlay background on `--background` so it matches the main window background.
  - Replaced the spinner/message utility color with `--ui-flat-secondary-text`.
- [x] Renamed `LogDetails.svelte` to `FlatLogDetails.svelte`.
  - `FlatErrorDialog` and `features/dev-tools/TestScreen.svelte` now import the flat-prefixed
    component directly.
  - Replaced the remaining non-flat palette token names with matching flat palette tokens, which
    preserve the same color values.
- [x] Renamed `SeparatorDot.svelte` to `FlatSeparatorDot.svelte`.
  - `features/prompt-editor/PromptEditorTitleBar.svelte` and `FlatSelectorButton.svelte` now
    import the flat-prefixed primitive directly.
  - Visual styling was preserved.
- [x] Renamed `RotatingChevron.svelte` to `FlatRotatingChevron.svelte`.
  - `features/sidebar/PromptTreeFolderRow.svelte` and `FlatSelectorButton.svelte` now import
    the flat-prefixed primitive directly.
  - Visual styling and rotation behavior were preserved.
- [x] Removed `Separator.svelte`.
  - `FlatSeparator.svelte` now owns the separator implementation directly, including orientation,
    accessibility attributes, sizing, element binding, and scoped flat styling.
  - `features/sidebar/AppSidebar.svelte` and `features/prompt-editor/PromptDivider.svelte` now
    import `FlatSeparator` directly.
  - Updated the prompt drag/drop Playwright helper selector to `.cthulhuUiFlatSeparator`.
  - Verified with `npm run lint && npm run typecheck` and
    `./scripts/codex-playwright.sh tests/playwright/PromptFoldersPromptDragDrop.spec.ts`.
- [x] Removed `IconOnlyButton.svelte`.
  - Folded active/dropdown accessibility attributes into `FlatIconButton`.
  - `PromptTreeFolderRow` and the dev tools catalog now use `FlatIconButton` directly.
- [x] Renamed `ActivityBarButton.svelte` to `FlatActivityBarButton.svelte`.
  - `features/sidebar/AppActivityBar.svelte` now imports the flat-prefixed component.
  - Visual styling and behavior were preserved.
- [x] Renamed `BareIconButton.svelte` to `FlatBareIconButton.svelte`.
  - `features/sidebar/AppSidebar.svelte` now imports the flat-prefixed component.
  - Visual styling and behavior were preserved.
- [x] Renamed `DropdownPopupCore.svelte` to `FlatDropdownPopupCore.svelte`.
  - `FlatDropdownPopupSimple` and `FlatDropdownPopupDetailed` now import the flat-prefixed core.
  - Replaced the remaining non-flat text token with `--ui-flat-normal-text`.
- [x] Removed `CardSurface.svelte`.
  - It was only kept alive by the dev tools catalog. The catalog now uses `FlatCardSurface`
    for section shells and surface variant examples.
  - `FlatCardSurface` overlay styling now uses existing flat palette tokens.
- [x] Removed legacy `CthulhuDialog.svelte`, `ConfirmationDialog.svelte`, and `ErrorDialog.svelte`.
  - These had no live imports from app or feature screens; current dialog UI uses `FlatDialog`,
    `FlatErrorDialog`, and `FlatConfirmationDialog`.
- [x] Removed `IconTextButton.svelte`.
  - It was only kept alive by the legacy dialog stack and the dev tools catalog. The dev tools
    examples now use existing live flat/button components.
  - Verified with `npm run lint && npm run typecheck`.
- [x] Removed `SectionHeader.svelte`.
  - App-facing prompt folder section headings now use `FlatTitle`.
  - The remaining dev tools examples were removed before deleting the component.
- [x] Removed `TitleBlock.svelte` and `AccentIconTile.svelte`.
  - `FlatTitle` now has a `small` variant for section labels.
  - Dialog/details headings and dev tools section headings now use `FlatTitle`.
- [x] Unified `FlatTitle` variants.
  - `FlatTitle` now owns page, small, card, and dialog title styling.
  - `FlatCard` and `FlatDialog` no longer keep local duplicate title styles.
  - Rechecked legacy title components; `TitleBlock.svelte`, `AccentIconTile.svelte`, and
    `SectionHeader.svelte` have no tracked files, untracked files, or imports remaining.
