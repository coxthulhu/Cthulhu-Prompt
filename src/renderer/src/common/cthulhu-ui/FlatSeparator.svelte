<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import Separator from './Separator.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement>

  let { class: className, ...restProps }: Props = $props()
</script>

<!-- Separator spacing/color used between rows inside FlatCard content. -->
<Separator class={mergeClasses('cthulhuUiFlatSeparator my-2 bg-[var(--ui-card-nested-border)]', className)} {...restProps} />
