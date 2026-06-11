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
- [ ] `SectionHeader.svelte`
  - Used by `features/prompt-folders/PromptFolderVirtualContent.svelte` and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatSectionHeader` equivalent; it currently depends on `AccentIconTile`.
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

- [ ] `AccentIconTile.svelte`
  - Used by `SectionHeader`, `TitleBlock`, and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatAccentIconTile` equivalent using only flat palette tokens.
- [ ] `DropdownPopupCore.svelte`
  - Used by `FlatDropdownPopupSimple` and `FlatDropdownPopupDetailed`.
  - Needs a flat-prefixed name and replacement of its remaining non-flat text token.
- [ ] `LogDetails.svelte`
  - Used by `FlatErrorDialog` and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatLogDetails` equivalent using only flat palette tokens.
- [ ] `TitleBlock.svelte`
  - Used by `FlatErrorDialog`, `LogDetails`, and `features/dev-tools/TestScreen.svelte`.
  - Needs a `FlatTitleBlock` equivalent or replacement with existing flat title/message components.

## Dev-Tools-Only Live Components

- [ ] `CardSurface.svelte`
  - Used by `features/dev-tools/TestScreen.svelte`.
  - Needs migration or removal from the dev tools catalog once flat surface coverage is complete.

## Flat Palette Cleanup

- [ ] `FlatCardSurface.svelte`
  - Its overlay variant still uses `--ui-card-overlay-surface` and `--ui-card-normal-border`.
  - Replace these with existing flat palette tokens or add approved flat palette tokens.

## Completed

- [x] Removed legacy `CthulhuDialog.svelte`, `ConfirmationDialog.svelte`, and `ErrorDialog.svelte`.
  - These had no live imports from app or feature screens; current dialog UI uses `FlatDialog`,
    `FlatErrorDialog`, and `FlatConfirmationDialog`.
- [x] Removed `IconTextButton.svelte`.
  - It was only kept alive by the legacy dialog stack and the dev tools catalog. The dev tools
    examples now use existing live flat/button components.
  - Verified with `npm run lint && npm run typecheck`.
