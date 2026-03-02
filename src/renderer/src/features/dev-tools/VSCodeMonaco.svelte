<script lang="ts">
  import { onMount } from 'svelte'
  import * as monaco from 'monaco-editor'
  import { PROMPT_EDITOR_THEME } from '@renderer/lib/monacoVscode'

  type Props = {
    initialValue?: string
    language?: string
  }

  let { initialValue = '', language = 'markdown' }: Props = $props()
  let container = $state<HTMLDivElement | null>(null)

  // Side effect: mount and dispose a single Monaco editor for dev-only verification.
  onMount(() => {
    if (!container) return

    const editor = monaco.editor.create(container, {
      value: initialValue,
      language,
      theme: PROMPT_EDITOR_THEME,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on'
    })

    return () => {
      editor.dispose()
    }
  })
</script>

<div
  bind:this={container}
  class="h-80 w-full overflow-hidden rounded-md border border-border"
  data-testid="vscode-monaco-test-editor"
></div>
