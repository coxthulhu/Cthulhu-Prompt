<script lang="ts">
  type TitleBlockVariant = 'large' | 'small'

  type Props = {
    title: string
    variant: TitleBlockVariant
    description?: string
  }

  let { title, variant, description }: Props = $props()

  const titleTag = $derived(variant === 'large' ? 'h2' : 'h3')
</script>

<div>
  <svelte:element
    this={titleTag}
    class:cthulhuUiTitleBlockTitleLarge={variant === 'large'}
    class:cthulhuUiTitleBlockTitleSmall={variant === 'small'}
  >
    {title}
  </svelte:element>
  {#if description}
    <p class="cthulhuUiTitleBlockDescription">{description}</p>
  {/if}
</div>

<style>
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
