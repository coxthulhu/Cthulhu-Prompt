# Changelog

## 0.0.2

### Added
- Auto-scrolls the virtualized prompt list to keep the focused title/cursor in view while editing.

### Changed
- Sidebar width/resize handle styling and prompt folder icons updated.

### Fixed
- Monaco overlay widgets (suggest/hover) can render above prompt rows without clipping.
- "No suggestions" widget sizing no longer overflows.
- Disabled Monaco's built-in find/replace shortcuts, which broke some visuals. Will re-implement global find/replace soon.
- Reduced scroll jumps in the virtualized prompt list during hydration/resize.

## 0.0.1

### Added
- Initial Release!
- Workspace selection and setup.
- Familiar, code-like prompt editor.
- Prompt organization through infinite scrolling prompt folders.
- Local JSON prompt files, easily source-controllable.
