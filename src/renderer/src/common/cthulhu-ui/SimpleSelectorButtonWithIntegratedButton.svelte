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

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    position: relative;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton:hover),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiIconButton:focus-visible),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector:hover),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector:has(:focus-visible)) {
    z-index: 1;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton:first-child) {
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    margin-left: -1px;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiIconButton:last-child) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    margin-left: -1px;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton:first-child:not(:hover):not(:focus-visible)) {
    border-right-color: transparent;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiIconButton:last-child:not(:hover):not(:focus-visible)) {
    border-left-color: transparent;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton:first-child:hover)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(.cthulhuUiIconButton:first-child:focus-visible)
    + :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-left-color: transparent;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']:has(
      > :global(.cthulhuUiIconButton:last-child:hover)
    )
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']:has(
      > :global(.cthulhuUiIconButton:last-child:focus-visible)
    )
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector) {
    border-right-color: transparent;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(
      .cthulhuUiIconButton:first-child:has(
        + .cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector:hover
      )
    ),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-leading-action='true']
    > :global(
      .cthulhuUiIconButton:first-child:has(
        + .cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector:focus-within
      )
    ) {
    border-right-color: transparent;
  }

  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector:hover)
    + :global(.cthulhuUiIconButton:last-child),
  .cthulhuUiSimpleSelectorButtonWithIntegratedButton[data-trailing-action='true']
    > :global(.cthulhuUiSimpleSelectorButtonWithIntegratedButtonSelector:focus-within)
    + :global(.cthulhuUiIconButton:last-child) {
    border-left-color: transparent;
  }
</style>
