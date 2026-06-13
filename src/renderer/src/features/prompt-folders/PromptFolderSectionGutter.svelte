<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement>

  let { class: className, ...restProps }: Props = $props()
</script>

<!-- Visual section rail for prompt-folder virtual rows. -->
<div
  class={mergeClasses('promptFolderSectionGutter', className)}
  aria-hidden="true"
  {...restProps}
></div>

<style>
  .promptFolderSectionGutter {
    align-self: stretch;
    background: var(--ui-neutral-emphasis-border);
    margin-bottom: var(--prompt-folder-section-gutter-bottom-inset, 0);
    margin-top: var(--prompt-folder-section-gutter-top-inset, 0);
    min-width: 2px;
    width: 2px;
  }
</style>
