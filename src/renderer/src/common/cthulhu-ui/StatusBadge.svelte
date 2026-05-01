<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type StatusBadgeVariant = 'success' | 'accent'

  type Props = HTMLAttributes<HTMLDivElement> & {
    icon: ComponentType
    text: string
    variant: StatusBadgeVariant
    iconClass?: string
    textTestId?: string
  }

  let {
    icon: Icon,
    text,
    variant,
    iconClass,
    textTestId,
    class: className,
    ...restProps
  }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiStatusBadge', className)} data-variant={variant} {...restProps}>
  <Icon class={mergeClasses('h-4 w-4', iconClass)} />
  <span class="cthulhuUiStatusBadgeText" data-testid={textTestId}>{text}</span>
</div>

<style>
  .cthulhuUiStatusBadge {
    align-items: center;
    border: 1px solid;
    border-radius: 999px;
    display: inline-flex;
    font-size: 13px;
    font-weight: 600;
    gap: 8px;
    line-height: 1;
    padding: 8px 12px;
    width: max-content;
  }

  .cthulhuUiStatusBadge :global(svg) {
    flex: 0 0 auto;
  }

  .cthulhuUiStatusBadgeText {
    display: inline-block;
    line-height: 1;
    transform: translateY(-1px);
  }

  .cthulhuUiStatusBadge[data-variant='success'] {
    background: var(--ui-success-normal-surface);
    border-color: var(--ui-success-normal-border);
    color: var(--ui-success-normal-text);
  }

  .cthulhuUiStatusBadge[data-variant='accent'] {
    background: var(--ui-accent-normal-surface);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-accent-normal-text);
  }
</style>
