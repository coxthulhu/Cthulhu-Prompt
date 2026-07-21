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
    title,
    draftText,
    copyText,
    modifiedAt = null,
    onTitleChange,
    fallbackTitle = '',
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onStatusChange,
    onSelectionChange,
    onTitleForwardTab,
    inputRef = $bindable(null),
    metadataFolderLabel = 'Prompts',
    tokenCount,
    icon,
    copyLabel,
    copyTitle,
    completedAt,
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
    {title}
    {draftText}
    {copyText}
    {modifiedAt}
    {onTitleChange}
    {fallbackTitle}
    {rowId}
    {scrollToWithinWindowBand}
    {onDelete}
    {onStatusChange}
    {onSelectionChange}
    {onTitleForwardTab}
    bind:inputRef
    {metadataFolderLabel}
    {tokenCount}
    {icon}
    {copyLabel}
    {copyTitle}
    {completedAt}
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
