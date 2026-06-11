# Flat UI Migration

This is the working list of cthulhu-ui components that still need flat migration work.
It only includes components with live imports from app/feature code, dev tools, or current `Flat*`
wrappers.

## App-Facing Components

- [ ] `ActivityBarButton.svelte`
  - Used by `features/sidebar/AppActivityBar.svelte`.
  - Already uses flat palette tokens; migration is mostly a rename to `FlatActivityBarButton`.
- [ ] `BareIconButton.svelte`
  - Used by `features/sidebar/AppSidebar.svelte`.
  - Already uses flat palette tokens; migration is mostly a rename to `FlatBareIconButton`.
- [ ] `IconOnlyButton.svelte`
  - Used by `features/sidebar/PromptTreeFolderRow.svelte` and `features/dev-tools/TestScreen.svelte`.
  - Already uses flat palette tokens; migrate by renaming or folding missing sizes/variants into `FlatIconButton`.
- [ ] `InfoRow.svelte`
  - Used by `features/prompt-folders/PromptFolderSettingsRow.svelte` and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatInfoRow` equivalent using only flat palette tokens.
- [ ] `InlineTextButton.svelte`
  - Used by `features/sidebar/PromptTreeVisibilityToggleRow.svelte`.
  - Needs a `FlatInlineTextButton` equivalent using only flat palette tokens.
- [ ] `LoadingOverlay.svelte`
  - Used by `app/AppOverlays.svelte` and `features/prompt-folders/PromptFolderScreen.svelte`.
  - Needs a `FlatLoadingOverlay` equivalent using flat palette tokens instead of app background utility colors.
- [ ] `Separator.svelte`
  - Used directly by `features/sidebar/AppSidebar.svelte` and `features/prompt-editor/PromptDivider.svelte`.
  - Also used by `FlatSeparator`; migration is mostly a rename or replacement with a flat primitive.
- [ ] `SeparatorDot.svelte`
  - Used by `features/prompt-editor/PromptEditorTitleBar.svelte` and `FlatSelectorButton.svelte`.
  - Needs a flat-prefixed primitive name.
- [ ] `RotatingChevron.svelte`
  - Used by `features/sidebar/PromptTreeFolderRow.svelte` and `FlatSelectorButton.svelte`.
  - Needs a flat-prefixed primitive name.

## Internal Flat Wrapper Dependencies

- [ ] `DropdownPopupCore.svelte`
  - Used by `FlatDropdownPopupSimple` and `FlatDropdownPopupDetailed`.
  - Needs a flat-prefixed name and replacement of its remaining non-flat text token.
- [ ] `LogDetails.svelte`
  - Used by `FlatErrorDialog` and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatLogDetails` equivalent using only flat palette tokens.

## Completed

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
