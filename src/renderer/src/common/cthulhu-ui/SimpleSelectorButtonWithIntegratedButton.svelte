<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import SimpleSelectorButton, {
    type SimpleSelectorButtonProps
  } from './SimpleSelectorButton.svelte'

  type Props = Omit<SimpleSelectorButtonProps, 'class'> & {
    integratedButton: Snippet
    class?: string
    selectorClass?: string
  }

  let {
    integratedButton,
    class: className,
    selectorClass,
    ...selectorProps
  }: Props = $props()
</script>

<span class={mergeClasses('cthulhuUiSimpleSelectorButtonWithIntegratedButton', className)}>
  <!-- The caller owns the integrated action; this component only joins the controls visually. -->
  {@render integratedButton()}
  <SimpleSelectorButton
    {...selectorProps}
    class={mergeClasses('cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector', selectorClass)}
  />
</span>

<style>
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton {
    align-items: stretch;
    display: inline-flex;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton > :global(.cthulhuUiIconButton) {
    background: transparent;
    border-bottom-right-radius: 0;
    border-right: 0;
    border-top-right-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton[data-hover-variant='success']:hover)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton[data-hover-variant='success']:focus-visible)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-left-color: var(--ui-success-muted-hover-border);
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton[data-hover-variant='neutral']:hover)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton[data-hover-variant='neutral']:focus-visible)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-left-color: var(--ui-neutral-hover-border);
  }
</style>
