<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import SimpleSelectorButton, {
    type SimpleSelectorButtonProps
  } from './SimpleSelectorButton.svelte'

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
  class={mergeClasses('cthulhuUiSimpleSelectorButtonWithIntegratedButton', className)}
  data-leading-action={showIntegratedButton ? 'true' : 'false'}
  data-trailing-action={showTrailingIntegratedButton ? 'true' : 'false'}
>
  <!-- The caller owns the quick actions; this component only joins the controls visually. -->
  {#if showIntegratedButton}
    {@render integratedButton()}
  {/if}
  <SimpleSelectorButton
    {...selectorProps}
    class={mergeClasses('cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector', selectorClass)}
  />
  {#if showTrailingIntegratedButton}
    {@render trailingIntegratedButton()}
  {/if}
</span>

<style>
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton {
    align-items: stretch;
    display: inline-flex;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton:first-child) {
    background: transparent;
    border-bottom-right-radius: 0;
    border-right: 0;
    border-top-right-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiIconButton:last-child) {
    background: transparent;
    border-bottom-left-radius: 0;
    border-left: 0;
    border-top-left-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton[data-hover-variant='success']:hover)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton[data-hover-variant='success']:focus-visible)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-left-color: var(--ui-success-muted-hover-border);
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton[data-hover-variant='neutral']:hover)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton[data-hover-variant='neutral']:focus-visible)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-left-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']:has(
      > :global(.cthulhuUiIconButton[data-hover-variant='success']:last-child:hover),
      > :global(.cthulhuUiIconButton[data-hover-variant='success']:last-child:focus-visible)
    )
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-right-color: var(--ui-success-muted-hover-border);
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']:has(
      > :global(.cthulhuUiIconButton[data-hover-variant='neutral']:last-child:hover),
      > :global(.cthulhuUiIconButton[data-hover-variant='neutral']:last-child:focus-visible)
    )
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-right-color: var(--ui-neutral-hover-border);
  }
</style>
