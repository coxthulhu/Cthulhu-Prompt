---
name: tanstack-db-schemas
description: |
  Cthulhu Prompt TanStack collection type and validation boundaries. Use when changing collection record types, revision envelopes, prompt summary/full normalization, form validation, IPC payload validation, or deciding whether runtime Standard Schema validation belongs in a renderer collection.
---

# Types and Validation Boundaries

The renderer currently uses explicit TypeScript record types and domain normalization helpers, not TanStack Standard Schema validation. Do not add Zod, Valibot, ArkType, or another schema library merely because generic TanStack DB guidance recommends a collection schema.

## Current Validation Layers

Use the existing layer that owns each concern:

| Concern | Repository mechanism |
| --- | --- |
| Collection record shape | Explicit TypeScript generic on `revisionCollectionOptions<T>` or `localOnlyCollectionOptions<T>` |
| IPC request/result shape | Shared request, result, payload, and revision-envelope types under `src/shared` |
| Persisted-to-renderer representation | Domain constructors such as `createPromptSummary`, `createPromptFull`, and template equivalents |
| Editable form validity | Feature/UI-state validation helpers such as `SystemSettingsFormat.ts` |
| Security and filesystem invariants | Validation in the main-process IPC handler before mutation |
| Optimistic concurrency | `expectedRevision` plus authoritative response reconciliation |

Keep renderer collection records free of revision metadata. `RevisionEnvelope<T>` carries `id`, `revision`, and `data`; the custom revision collection stores the revision separately and exposes the plain `T` record to UI code.

## Define Record Types

Persisted collections use shared domain types:

```ts
revisionCollectionOptions<PromptFolder>({
  id: 'prompt-folders',
  getKey: (promptFolder) => promptFolder.id
})
```

Local-only collections use renderer-specific draft records:

```ts
type SystemSettingsDraftRecord = {
  id: typeof SYSTEM_SETTINGS_DRAFT_ID
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
  promptEditorMaxLinesInput: string
  showLineNumbers: boolean
}
```

Use input-friendly types in drafts. Keep numeric settings as strings while users edit them, validate with `SystemSettingsFormat`, and convert to the persisted shared type only when the paced transaction is valid.

## Normalize at Boundaries

Use constructors when one persisted entity has multiple renderer shapes. Prompt summaries and full prompts can share an ID and revision, but a full prompt may replace a summary at the same revision through the collection's explicit equal-revision rule.

Keep serialization and normalization close to IPC query/mutation boundaries. Do not scatter type assertions or persisted-shape conversions through Svelte components.

## Runtime Collection Schemas

Introduce a TanStack-compatible runtime schema only after a deliberate repository-level decision that identifies:

- which client mutations require runtime validation
- whether input and output types transform
- how transformed values serialize through IPC
- how validation errors reach the existing UI
- whether authoritative sync data needs separate boundary validation, because TanStack collection schemas validate client mutations rather than sync writes

If a schema is adopted, update the custom revision options type, all affected local collection definitions, mutation payload conversion, and tests together. Do not mix a schema-inferred type with an unrelated explicit collection generic.

## Testing

Test domain normalization, invalid form drafts, conversion to persisted values, IPC rejection of invalid payloads, and summary/full replacement behavior at the layer that owns each rule.
