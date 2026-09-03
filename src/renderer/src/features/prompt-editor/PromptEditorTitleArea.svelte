<script lang="ts">
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import { PromptStatus } from '@shared/Prompt'
  import PromptEditorTitleRow, {
    type PromptEditorTitleRowProps
  } from './PromptEditorTitleRow.svelte'

  type Props = PromptEditorTitleRowProps & {
    titleAreaHeightPx: number
    compactLayout?: boolean
    infoText?: string
  }

  let {
    promptId,
    title,
    draftText,
    copyText,
    modifiedAt = null,
    onTitleChange,
    fallbackTitle = '',
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onArchive,
    onTemplateSelect,
    onTemplateSelectAndCopy,
    onCopySuccess,
    onStatusChange,
    onSelectionChange,
    onTitleEditorFocus,
    inputRef = $bindable(null),
    metadataFolderLabel = 'Template',
    metadataFolderState = 'not-selected',
    tokenCount,
    icon,
    copyLabel,
    copyTitle,
    deleteLabel,
    deleteDialogTitle,
    deleteDialogDescription,
    finalizedAt,
    status = PromptStatus.Todo,
    isEdited = false,
    titleAreaHeightPx,
    compactLayout = false,
    infoText
  }: Props = $props()
</script>

<div
  class="prompt-editor-title-area"
  style={`height:${titleAreaHeightPx}px; min-height:${titleAreaHeightPx}px; max-height:${titleAreaHeightPx}px;`}
>
  <PromptEditorTitleRow
    {promptId}
    {title}
    {draftText}
    {copyText}
    {modifiedAt}
    {onTitleChange}
    {fallbackTitle}
    {rowId}
    {scrollToWithinWindowBand}
    {onDelete}
    {onArchive}
    {onTemplateSelect}
    {onTemplateSelectAndCopy}
    {onCopySuccess}
    {onStatusChange}
    {onSelectionChange}
    {onTitleEditorFocus}
    bind:inputRef
    {metadataFolderLabel}
    {metadataFolderState}
    {tokenCount}
    {icon}
    {copyLabel}
    {copyTitle}
    {deleteLabel}
    {deleteDialogTitle}
    {deleteDialogDescription}
    {finalizedAt}
    {status}
    {isEdited}
    {compactLayout}
  />

  {#if infoText}
    <InfoRow text={infoText} />
  {/if}
</div>

<style>
  .prompt-editor-title-area {
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }
</style>
