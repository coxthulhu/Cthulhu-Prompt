<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import './flatActionButton.css'

  export type FlatLinkButtonVariant = 'neutral' | 'accent'

  type Props = {
    href: string
    text: string
    endIcon?: ComponentType
    variant?: FlatLinkButtonVariant
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
  class={mergeClasses('cthulhuUiFlatActionButton cthulhuUiFlatLinkButton', className)}
  data-variant={variant}
  data-testid={testId}
  {href}
  {target}
  {rel}
>
  <span>{text}</span>
  {#if EndIcon}
    <EndIcon class="cthulhuUiFlatLinkButtonIcon" size={16} aria-hidden="true" />
  {/if}
</a>

<style>
  .cthulhuUiFlatLinkButton {
    text-decoration: none;
  }

  .cthulhuUiFlatLinkButtonIcon {
    stroke-width: 2.2;
  }
</style>
