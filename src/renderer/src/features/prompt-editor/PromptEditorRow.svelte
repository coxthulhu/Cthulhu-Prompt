<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import {
    setPromptDraftText,
    setPromptDraftTitle
  } from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
  import MarkdownContentEditorRow from './MarkdownContentEditorRow.svelte'

  type Props = Omit<
    ComponentProps<typeof MarkdownContentEditorRow>,
    | 'contentKind'
    | 'contentLabel'
    | 'metadataFolderLabel'
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
  contentKind="prompt"
  contentLabel="prompt"
  metadataFolderLabel="Template"
  onTitleChange={(title) => setPromptDraftTitle(promptId, title)}
  onTextChange={(text, measurement) => setPromptDraftText(promptId, text, measurement)}
/>
