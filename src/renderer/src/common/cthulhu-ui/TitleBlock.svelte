<script lang="ts">
  import type { ComponentType } from 'svelte'
  import AccentIconTile from './AccentIconTile.svelte'
  import type { CthulhuSize } from './types'

  type TitleBlockSize = Extract<CthulhuSize, 'small' | 'large'>
  type TitleBlockIconTone = 'accent' | 'accent-white-icon' | 'danger'

  type Props = {
    title: string
    size: TitleBlockSize
    description?: string
    icon?: ComponentType
    iconTone?: TitleBlockIconTone
  }

  let { title, size, description, icon: Icon, iconTone = 'accent-white-icon' }: Props = $props()

  const titleTag = $derived(size === 'large' ? 'h2' : 'h3')
</script>

<div class:cthulhuUiTitleBlockWithIcon={Icon}>
  {#if Icon}
    <AccentIconTile icon={Icon} size="large" tone={iconTone} />
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
    gap: 1rem;
  }

  .cthulhuUiTitleBlockText {
    min-width: 0;
  }

  .cthulhuUiTitleBlockTitleLarge {
    color: var(--ui-normal-text);
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .cthulhuUiTitleBlockTitleSmall {
    color: var(--ui-normal-text);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .cthulhuUiTitleBlockDescription {
    margin-top: 0.25rem;
    color: var(--ui-muted-text);
    font-size: 0.875rem;
    line-height: 1.5rem;
  }
</style>
