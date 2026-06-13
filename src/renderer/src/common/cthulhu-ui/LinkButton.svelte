<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import './actionButton.css'

  export type LinkButtonVariant = 'neutral' | 'accent'

  type Props = {
    href: string
    text: string
    endIcon?: ComponentType
    variant?: LinkButtonVariant
    class?: string
    target?: string
    rel?: string
    testId?: string
  }

  let {
    href,
    text,
    endIcon: EndIcon,
    variant = 'neutral',
    class: className,
    target,
    rel,
    testId
  }: Props = $props()
</script>

<a
  class={mergeClasses('cthulhuUiActionButton cthulhuUiLinkButton', className)}
  data-variant={variant}
  data-testid={testId}
  {href}
  {target}
  {rel}
>
  <span>{text}</span>
  {#if EndIcon}
    <EndIcon class="cthulhuUiLinkButtonIcon" size={16} aria-hidden="true" />
  {/if}
</a>

<style>
  .cthulhuUiLinkButton {
    text-decoration: none;
  }

  .cthulhuUiLinkButtonIcon {
    stroke-width: 2;
  }
</style>
