<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import AccentIconTile from './AccentIconTile.svelte'
  import CardSurface from './CardSurface.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    label: string
    children: Snippet
    icon?: ComponentType
    gapClass?: string
    paddingClass?: string
  }

  let {
    label,
    children,
    icon: Icon,
    gapClass = 'gap-3',
    paddingClass = 'p-2.5',
    class: className,
    ...restProps
  }: Props = $props()
</script>

<!-- Shared icon-leading pill shell for compact read-only workspace metadata. -->
<CardSurface
  variant="inset"
  class={mergeClasses('flex min-h-0 min-w-0 items-center', gapClass, paddingClass, className)}
  {...restProps}
>
  {#if Icon}
    <AccentIconTile icon={Icon} variant="accent" />
  {/if}

  <div class="flex min-w-0 flex-col gap-1">
    <div class="cthulhuUiIconPillSurfaceLabel">{label}</div>
    {@render children()}
  </div>
</CardSurface>

<style>
  .cthulhuUiIconPillSurfaceLabel {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0;
    line-height: 16px;
    text-transform: uppercase;
  }
</style>
