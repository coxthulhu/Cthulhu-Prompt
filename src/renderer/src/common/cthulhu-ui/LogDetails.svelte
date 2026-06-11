<script lang="ts">
  import FlatTitle from './FlatTitle.svelte'

  type Props = {
    title: string
    text: string
  }

  let { title, text }: Props = $props()
</script>

<section class="space-y-2">
  <FlatTitle {title} size="small" headingLevel={3} />
  <!-- Preserve line breaks so technical errors remain readable. -->
  <pre
    class="cthulhuUiLogDetailsText rounded-[var(--cthulhu-ui-radius-control)] p-3 text-sm leading-6">{text}</pre>
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
