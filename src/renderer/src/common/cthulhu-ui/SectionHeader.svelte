<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import AccentIconTile, { type AccentIconTileVariant } from './AccentIconTile.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    title: string
    description?: string
    headingLevel?: 1 | 2 | 3
    icon?: ComponentType
    iconVariant?: AccentIconTileVariant
    showAccentLine?: boolean
  }

  let {
    title,
    description,
    headingLevel = 2,
    icon: Icon,
    iconVariant = 'accent',
    showAccentLine = false,
    class: className,
    ...restProps
  }: Props = $props()

  const headingTag = $derived(`h${headingLevel}`)
</script>

<!-- Shared section heading with optional small icon tile and leading accent line. -->
<div
  class={mergeClasses(
    'cthulhuUiSectionHeader',
    showAccentLine ? 'cthulhuUiSectionHeader--withLine' : null,
    className
  )}
  {...restProps}
>
  <div class="cthulhuUiSectionHeaderTitleRow">
    {#if Icon}
      <AccentIconTile icon={Icon} size="small" variant={iconVariant} iconClass="stroke-[2.4]" />
    {/if}
    <svelte:element this={headingTag} class="cthulhuUiSectionHeaderTitle font-bold">
      {title}
    </svelte:element>
  </div>

  {#if description}
    <p class="cthulhuUiSectionHeaderDescription">{description}</p>
  {/if}
</div>

<style>
  .cthulhuUiSectionHeader {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .cthulhuUiSectionHeader--withLine {
    border-left: 3px solid var(--ui-accent-normal-border);
    padding-left: 16px;
  }

  .cthulhuUiSectionHeaderTitleRow {
    align-items: center;
    display: flex;
    gap: 10px;
    min-width: 0;
  }

  .cthulhuUiSectionHeaderTitle {
    color: var(--ui-normal-text);
    font-size: 24px;
    line-height: 32px;
    margin: 0;
    min-width: 0;
  }

  .cthulhuUiSectionHeaderDescription {
    color: var(--ui-muted-text);
    font-size: 14px;
    line-height: 20px;
    margin: 0;
    min-width: 0;
  }
</style>
