---
name: persistence
description: Decide where Cthulhu Prompt data belongs, distinguish user-specific from machine-specific state, and preserve data when changing persistence.
---

# Persistence

## Choose the right storage

- Keep globally shared workspace content in workspace files.
- Keep application settings and remembered UI state in SQLite as JSON objects.
- Scope state to the application, workspace, or individual entity according to what owns it.

## Classify state

- User-specific state represents preferences that should follow the user between machines: navigation choices, expansion, visibility, and whether Welcome has been shown.
- Machine-specific state depends on the local environment: filesystem paths, pixel sizes, positions, scroll offsets, window display modes, and editor view state.
- All system settings are user-specific, including font size.
- Give each state type one classification. Split records containing both kinds of state and reassemble them at the persistence boundary.

## Preserve ownership and data

- Keep independently owned state separate so one writer cannot overwrite another's changes.
- Save or delete related pieces atomically. Remove entity state when its owner disappears without affecting other entities or workspaces.
- Keep application-facing data contracts independent of storage layout.
- Preserve existing values during migration. Commit imported data before removing its source, and make retries safe.
- Retain invalid import sources and log the failure. Use defaults when no usable persisted state exists.
- Verify persistence through restoration, migration failure and retry, and isolation between owners and storage scopes.
