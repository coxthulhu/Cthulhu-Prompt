<script lang="ts">
  import { PromptStatus } from '@shared/Prompt'
  import PromptEditorTitleRow, {
    type PromptEditorTitleRowProps
  } from './PromptEditorTitleRow.svelte'

  type Props = PromptEditorTitleRowProps & {
    titleAreaHeightPx: number
    compactLayout?: boolean
  }

  let {
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
    compactLayout = false
  }: Props = $props()
</script>

<div
  class="prompt-editor-title-area"
  style={`height:${titleAreaHeightPx}px; min-height:${titleAreaHeightPx}px; max-height:${titleAreaHeightPx}px;`}
>
  <PromptEditorTitleRow
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
</div>

<style>
  .prompt-editor-title-area {
    box-sizing: border-box;
    display: grid;
    min-width: 0;
    overflow: hidden;
  }
</style>
