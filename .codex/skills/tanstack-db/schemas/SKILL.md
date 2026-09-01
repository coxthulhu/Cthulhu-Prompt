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
| Query IPC request/result shape | Shared request, result, payload, and revision-envelope types under `src/shared` plus query parsers in `IpcValidation.ts` |
| Mutation command and authoritative changes | Strict command parser plus shared `DomainPlanner` in `src/shared/*DomainMutations.ts` |
| Generic mutation wire shape | `DomainMutationRequest`, revision expectations, and authoritative snapshots in `DomainChanges.ts` |
| Persisted-to-renderer representation | Domain constructors such as `createPromptSummary`, `createPromptFull`, and template equivalents |
| Editable form validity | Feature/UI-state validation helpers such as `SystemSettingsFormat.ts` |
| Security, business, and filesystem invariants | Strict main command parsing, main-side planner recomputation, domain transitions, and storage adapters |
| Optimistic concurrency | Framework-derived exact target/revision expectations plus authoritative snapshot reconciliation |

Keep renderer collection records free of revision metadata. `RevisionEnvelope<T>` carries `id`, `revision`, and `data`; the custom revision collection stores the revision separately and exposes the plain `T` record to UI code.

## Define Record Types

Persisted collections use shared domain types:

```ts
revisionCollectionOptions<PromptFolder>({
  id: 'prompt-folders',
  getKey: (promptFolder) => promptFolder.id
})
```

Local-only collections use renderer-specific client-state records:

```ts
type SystemSettingsClientStateRecord = {
  id: typeof SYSTEM_SETTINGS_CLIENT_STATE_ID
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
  promptEditorMaxLinesInput: string
  showLineNumbers: boolean
}
```

Use input-friendly types in client state. Keep numeric settings as strings while users edit them, validate with `SystemSettingsFormat`, and convert to the persisted shared type only when the paced transaction is valid.

## Normalize at Boundaries

Use constructors when one persisted entity has multiple renderer shapes. Prompt summaries and full prompts can share an ID and revision, but a full prompt may replace a summary at the same revision through the collection's explicit equal-revision rule.

Keep serialization and normalization close to IPC query/mutation boundaries. Do not scatter type assertions or persisted-shape conversions through Svelte components.

## Domain Mutation Types

Add authoritative entity types to `DomainEntityMap` and use `DomainPlannerEntityMap` only when the renderer legitimately plans from a projection such as a prompt summary. A mutation-specific shared module should colocate:

- a serializable command type
- a strict runtime parser that rejects missing, mistyped, and additional properties
- one shared planner that returns unique `DomainChange` targets or a business conflict with authoritative targets

The renderer and main process run the same planner against different state adapters. Put IDs, timestamps, and other nondeterministic inputs in the command; do not generate them inside the planner. Keep renderer-only state out of shared commands and plans, and apply it through the renderer mutation callback instead.

## Runtime Collection Schemas

Introduce a TanStack-compatible runtime schema only after a deliberate repository-level decision that identifies:

- which client mutations require runtime validation
- whether input and output types transform
- how transformed values serialize through IPC
- how validation errors reach the existing UI
- whether authoritative sync data needs separate boundary validation, because TanStack collection schemas validate client mutations rather than sync writes

If a schema is adopted, update the custom revision options type, all affected local collection definitions, domain command conversion, and tests together. Do not mix a schema-inferred type with an unrelated explicit collection generic.

## Testing

Test domain normalization, invalid client-state form inputs, conversion to persisted values, strict command rejection, planner changes/conflicts, IPC rejection of invalid payloads, and summary/full replacement behavior at the layer that owns each rule.
