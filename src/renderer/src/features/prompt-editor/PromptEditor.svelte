<script lang="ts">
  import { TEMPLATE_NOT_SELECTED_LABEL } from '@renderer/common/emptyStateText'
  import type { ComponentProps } from 'svelte'
  import {
    setPromptText,
    setPromptTitle
  } from '@renderer/data/UiState/client-state/PromptClientStateMutations.svelte.ts'
  import MarkdownContentEditor from './MarkdownContentEditor.svelte'

  type Props = Omit<
    ComponentProps<typeof MarkdownContentEditor>,
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

  let { promptId, contentKind = 'prompt', ...props }: Props = $props()
</script>

<MarkdownContentEditor
  {...props}
  {promptId}
  {contentKind}
  contentLabel={contentKind}
  copyLabel={`Copy ${contentKind}`}
  copyTitle={`Copy ${contentKind}`}
  deleteLabel={`Delete ${contentKind}`}
  deleteDialogTitle={contentKind === 'routine' ? 'Delete Routine' : 'Delete Prompt'}
  deleteDialogDescription={`Are you sure you want to permanently delete this ${contentKind}?`}
  metadataTemplateLabel={props.promptDraftRecord.templateName ?? TEMPLATE_NOT_SELECTED_LABEL}
  metadataTemplateState={props.promptDraftRecord.templateState ?? 'not-selected'}
  onTitleChange={(title) => setPromptTitle(promptId, title)}
  onTextChange={(text, measurement) => setPromptText(promptId, text, measurement)}
/>
