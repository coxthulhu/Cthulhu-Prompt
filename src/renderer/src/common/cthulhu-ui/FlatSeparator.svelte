<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import Separator from './Separator.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    orientation?: 'horizontal' | 'vertical'
    decorative?: boolean
    elementRef?: HTMLDivElement | null
  }

  let { class: className, ...restProps }: Props = $props()
</script>

<!-- Separator color used between padded rows inside FlatCard content. -->
<Separator class={mergeClasses('cthulhuUiFlatSeparator bg-[var(--ui-card-nested-border)]', className)} {...restProps} />
