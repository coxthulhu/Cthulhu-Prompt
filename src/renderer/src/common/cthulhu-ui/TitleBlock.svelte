<script lang="ts">
  import type { ComponentType } from 'svelte'
  import AccentIconTile from './AccentIconTile.svelte'
  import type { CthulhuSize } from './types'

  type TitleBlockSize = Extract<CthulhuSize, 'small' | 'large'>
  type TitleBlockIconVariant = 'accent' | 'danger'

  type Props = {
    title: string
    size: TitleBlockSize
    description?: string
    icon?: ComponentType
    iconVariant?: TitleBlockIconVariant
  }

  let { title, size, description, icon: Icon, iconVariant = 'accent' }: Props = $props()

  const titleTag = $derived(size === 'large' ? 'h2' : 'h3')
</script>

<div class:cthulhuUiTitleBlockWithIcon={Icon}>
  {#if Icon}
    <AccentIconTile icon={Icon} size="large" variant={iconVariant} />
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
      <p class="cthulhuUiTitleBlockDescription">{description}</p>
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
    font-weight: 500;
  }

  .cthulhuUiTitleBlockDescription {
    margin-top: 0.3rem;
    color: var(--ui-muted-text);
    font-size: 0.9rem;
    line-height: 1.4;
  }
</style>
