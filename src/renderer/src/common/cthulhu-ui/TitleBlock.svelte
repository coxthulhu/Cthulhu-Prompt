<script lang="ts">
  import type { ComponentType } from 'svelte'
  import AccentIconTile, { type AccentIconTileVariant } from './AccentIconTile.svelte'
  import { mergeClasses } from './mergeClasses'
  import type { CthulhuSize } from './types'

  type TitleBlockSize = Extract<CthulhuSize, 'small' | 'large'>

  type Props = {
    title: string
    size: TitleBlockSize
    description?: string
    icon?: ComponentType
    iconVariant?: AccentIconTileVariant
  }

  let { title, size, description, icon: Icon, iconVariant = 'accent' }: Props = $props()

  const titleTag = $derived(size === 'large' ? 'h2' : 'h3')
  const iconSize = $derived(size === 'large' ? 'large' : 'medium')
</script>

<div class={mergeClasses('cthulhuUiTitleBlock', Icon ? 'cthulhuUiTitleBlock--withIcon' : null)}>
  {#if Icon}
    <AccentIconTile icon={Icon} size={iconSize} variant={iconVariant} />
  {/if}

  <div class="cthulhuUiTitleBlockText">
    <svelte:element
      this={titleTag}
      class={mergeClasses(
        'cthulhuUiTitleBlockTitle',
        size === 'large' ? 'cthulhuUiTitleBlockTitle--large' : null,
        size === 'small' ? 'cthulhuUiTitleBlockTitle--small' : null
      )}
    >
      {title}
    </svelte:element>
    {#if description}
      <p
        class={mergeClasses(
          'cthulhuUiTitleBlockDescription mt-1',
          size === 'large' ? 'cthulhuUiTitleBlockDescription--large' : null,
          size === 'small' ? 'cthulhuUiTitleBlockDescription--small' : null
        )}
      >
        {description}
      </p>
    {/if}
  </div>
</div>

<style>
  .cthulhuUiTitleBlock--withIcon {
    align-items: flex-start;
    display: flex;
    gap: 12px;
  }

  .cthulhuUiTitleBlockText {
    min-width: 0;
  }

  .cthulhuUiTitleBlockTitle--large {
    color: var(--ui-normal-text);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .cthulhuUiTitleBlockTitle--small {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
  }

  .cthulhuUiTitleBlockDescription {
    color: var(--ui-muted-text);
    line-height: 1.4;
  }

  .cthulhuUiTitleBlockDescription--large {
    font-size: 14px;
  }

  .cthulhuUiTitleBlockDescription--small {
    font-size: 14px;
  }
</style>
