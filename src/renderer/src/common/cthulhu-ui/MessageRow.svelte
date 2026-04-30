<script lang="ts">
  import { AlertCircle, AlertTriangle } from 'lucide-svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'
  import type { CthulhuTone } from './types'

  export type MessageRowTone = Extract<CthulhuTone, 'danger' | 'warning'>

  type Props = HTMLAttributes<HTMLDivElement> & {
    text: string
    tone: MessageRowTone
    textTestId?: string
  }

  let { text, tone, textTestId, class: className, ...restProps }: Props = $props()

  const Icon = $derived(tone === 'danger' ? AlertCircle : AlertTriangle)
</script>

<div
  class={mergeClasses(
    'cthulhuUiMessageRow inline-flex h-11 items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-4 text-sm leading-5',
    className
  )}
  data-tone={tone}
  data-testid={textTestId}
  {...restProps}
>
  <!-- Tone controls both the icon and the row palette. -->
  <Icon class={mergeClasses('h-4 w-4', 'cthulhuUiMessageRowIcon')} />
  {text}
</div>

<style>
  .cthulhuUiMessageRow {
    color: var(--ui-normal-text);
  }

  .cthulhuUiMessageRowIcon {
    color: var(--cthulhu-ui-message-row-icon);
  }

  .cthulhuUiMessageRow[data-tone='danger'] {
    --cthulhu-ui-message-row-icon: var(--ui-danger-icon-glyph);

    background: var(--ui-danger-normal-surface);
    border-color: var(--ui-danger-normal-border);
  }

  .cthulhuUiMessageRow[data-tone='warning'] {
    --cthulhu-ui-message-row-icon: var(--ui-warning-icon-glyph);

    background: var(--ui-warning-normal-surface);
    border-color: var(--ui-warning-normal-border);
  }
</style>
