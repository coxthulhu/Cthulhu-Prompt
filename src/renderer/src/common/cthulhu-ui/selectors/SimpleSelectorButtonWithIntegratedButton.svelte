<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import '@renderer/common/cthulhu-ui/layout/segmentedControl.css'
  import SimpleSelectorButton, {
    type SimpleSelectorButtonProps
  } from '@renderer/common/cthulhu-ui/selectors/SimpleSelectorButton.svelte'

  // Props configure the selector and its optional quick-action segments.
  type Props = Omit<SimpleSelectorButtonProps, 'class'> & {
    integratedButton: Snippet
    trailingIntegratedButton: Snippet
    showIntegratedButton?: boolean
    showTrailingIntegratedButton?: boolean
    class?: string
    selectorClass?: string
  }

  // Component props keep both action snippets inline at the call site while controlling visibility here.
  let {
    integratedButton,
    trailingIntegratedButton,
    showIntegratedButton = true,
    showTrailingIntegratedButton = false,
    class: className,
    selectorClass,
    ...selectorProps
  }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiSimpleSelectorButtonWithIntegratedButton cthulhuUiSegmentedControl', className)}
>
  <!-- The caller owns the quick actions; this component only joins the controls visually. -->
  {#if showIntegratedButton}
    {@render integratedButton()}
    <Separator orientation="vertical" class="cthulhuUiSegmentedControlDivider" />
  {/if}
  <SimpleSelectorButton
    {...selectorProps}
    class={mergeClasses('cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector', selectorClass)}
  />
  {#if showTrailingIntegratedButton}
    <Separator orientation="vertical" class="cthulhuUiSegmentedControlDivider" />
    {@render trailingIntegratedButton()}
  {/if}
</span>
