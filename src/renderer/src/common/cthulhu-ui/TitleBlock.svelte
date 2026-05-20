<script lang="ts">
  import type { ComponentType } from 'svelte'
  import AccentIconTile, { type AccentIconTileVariant } from './AccentIconTile.svelte'
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

<div class:cthulhuUiTitleBlockWithIcon={Icon}>
  {#if Icon}
    <AccentIconTile icon={Icon} size={iconSize} variant={iconVariant} />
  {/if}

  <div class="cthulhuUiTitleBlockText">
    <svelte:element
      this={titleTag}
      class:cthulhuUiTitleBlockTitleLarge={size === 'large'}
      class:cthulhuUiTitleBlockTitleSmall={size === 'small'}
    >
      {title}
    </svelte:element>
    {#if description}
      <p
        class="cthulhuUiTitleBlockDescription mt-1"
        class:cthulhuUiTitleBlockDescriptionLarge={size === 'large'}
        class:cthulhuUiTitleBlockDescriptionSmall={size === 'small'}
      >
        {description}
      </p>
    {/if}
  </div>
</div>

<style>
  .cthulhuUiTitleBlockWithIcon {
    align-items: flex-start;
    display: flex;
    gap: 0.75rem;
  }

  .cthulhuUiTitleBlockText {
    min-width: 0;
  }

  .cthulhuUiTitleBlockTitleLarge {
    color: var(--ui-normal-text);
    font-size: 1.28rem;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .cthulhuUiTitleBlockTitleSmall {
    color: var(--ui-normal-text);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .cthulhuUiTitleBlockDescription {
    color: var(--ui-muted-text);
    line-height: 1.4;
  }

  .cthulhuUiTitleBlockDescriptionLarge {
    font-size: 0.9rem;
  }

  .cthulhuUiTitleBlockDescriptionSmall {
    font-size: 0.875rem;
  }
</style>
