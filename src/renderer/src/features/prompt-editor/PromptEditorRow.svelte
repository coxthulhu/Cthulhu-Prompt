<script lang="ts">
  import { TEMPLATE_NOT_SELECTED_LABEL } from '@renderer/common/emptyStateText'
  import type { ComponentProps } from 'svelte'
  import {
    setPromptText,
    setPromptTitle
  } from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
  import MarkdownContentEditorRow from './MarkdownContentEditorRow.svelte'

  type Props = Omit<
    ComponentProps<typeof MarkdownContentEditorRow>,
    | 'contentKind'
    | 'contentLabel'
    | 'metadataTemplateLabel'
    | 'metadataTemplateState'
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
  metadataTemplateLabel={props.promptDraftRecord.templateName ?? TEMPLATE_NOT_SELECTED_LABEL}
  metadataTemplateState={props.promptDraftRecord.templateState ?? 'not-selected'}
  onTitleChange={(title) => setPromptTitle(promptId, title)}
  onTextChange={(text, measurement) => setPromptText(promptId, text, measurement)}
/>
