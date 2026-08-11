<script lang="ts">
  import CopyButton from '@renderer/common/cthulhu-ui/CopyButton.svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/IconButtonBar.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { Layers, Zap } from 'lucide-svelte'

  type Props = {
    draftText: string
    copyText?: string
    onTemplateSelect?: () => void
    onTemplateSelectAndCopy?: () => void
    // The prompt's template decision controls whether Copy or quick selection is available.
    templateSelectionState?: 'not-selected' | 'no-template' | 'selected'
    copyLabel?: string
    copyTitle?: string
    onCopySuccess?: () => void | Promise<void>
  }

  let {
    draftText,
    copyText,
    onTemplateSelect,
    onTemplateSelectAndCopy,
    // Template editors omit quick selection and retain Copy with this default state.
    templateSelectionState = 'not-selected',
    copyLabel = 'Copy prompt',
    copyTitle = 'Copy prompt',
    onCopySuccess
  }: Props = $props()
</script>

<IconButtonBar>
  {#if onTemplateSelect}
    <IconButton
      icon={Layers}
      label="Set Template"
      title="Set Template"
      testId="prompt-template-button"
      onclick={onTemplateSelect}
    />
  {/if}
  {#if !onTemplateSelectAndCopy || templateSelectionState !== 'not-selected'}
    <CopyButton
      text={copyText ?? draftText}
      label={copyLabel}
      title={copyTitle}
      hoverVariant="accent"
      testId="prompt-copy-button"
      onCopied={onCopySuccess}
    />
  {/if}
  {#if onTemplateSelectAndCopy && templateSelectionState === 'not-selected'}
    <IconButton
      icon={Zap}
      label="Select Template and Copy"
      title="Select Template and Copy"
      testId="prompt-template-and-copy-button"
      onclick={onTemplateSelectAndCopy}
    />
  {/if}
</IconButtonBar>
