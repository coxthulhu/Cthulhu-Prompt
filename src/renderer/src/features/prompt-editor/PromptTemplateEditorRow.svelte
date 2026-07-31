<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import { createPromptTemplateEditorModelUri } from '@renderer/common/Monaco'
  import {
    setPromptTemplateDraftText,
    setPromptTemplateDraftTitle
  } from '@renderer/data/UiState/PromptTemplateDraftMutations.svelte.ts'
  import { PROMPT_TEMPLATE_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX } from './promptEditorSizing'
  import MarkdownContentEditorRow from './MarkdownContentEditorRow.svelte'

  type Props = Omit<
    ComponentProps<typeof MarkdownContentEditorRow>,
    | 'contentKind'
    | 'contentLabel'
    | 'metadataFolderLabel'
    | 'metadataFolderState'
    | 'modelUri'
    | 'compactLayoutMaxWidthPx'
    | 'copyLabel'
    | 'copyTitle'
    | 'deleteLabel'
    | 'deleteDialogTitle'
    | 'deleteDialogDescription'
    | 'onTitleChange'
    | 'onTextChange'
  >

  let { promptId, ...props }: Props = $props()
</script>

<MarkdownContentEditorRow
  {...props}
  {promptId}
  contentKind="template"
  contentLabel="template"
  metadataFolderLabel={null}
  modelUri={createPromptTemplateEditorModelUri(promptId)}
  compactLayoutMaxWidthPx={PROMPT_TEMPLATE_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX}
  copyLabel="Copy template"
  copyTitle="Copy template"
  deleteLabel="Delete template"
  deleteDialogTitle="Delete Template"
  deleteDialogDescription="Are you sure you want to delete this template?"
  onTitleChange={(title) => setPromptTemplateDraftTitle(promptId, title)}
  onTextChange={(text, measurement) =>
    setPromptTemplateDraftText(promptId, text, measurement)}
/>
