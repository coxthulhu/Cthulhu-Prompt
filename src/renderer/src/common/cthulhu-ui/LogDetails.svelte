<script lang="ts">
  import TitleBlock from './TitleBlock.svelte'

  type Props = {
    title: string
    text: string
  }

  let { title, text }: Props = $props()
</script>

<section class="space-y-2">
  <TitleBlock {title} variant="small" />
  <!-- Preserve line breaks so technical errors remain readable. -->
  <pre class="cthulhuUiLogDetailsText rounded-2xl px-4 py-3 text-sm leading-6">{text}</pre>
</section>

<style>
  .cthulhuUiLogDetailsText {
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    margin: 0;
    overflow-x: auto;
    white-space: pre-wrap;
  }
</style>
