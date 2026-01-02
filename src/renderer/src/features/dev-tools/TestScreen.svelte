<script lang="ts">
  import { onMount } from 'svelte'
  import { monaco } from '@renderer/common/Monaco'

  let container: HTMLDivElement | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null

  onMount(() => {
    if (!container) return

    // Create Monaco when the container is ready; mirror legacy behavior.
    editor = monaco.editor.create(container, {
      value: '',
      language: 'markdown',
      theme: 'vs-dark'
    })

    // Dispose the editor when the component unmounts.
    return () => {
      editor?.dispose()
      editor = null
    }
  })
</script>

<div class="h-full w-full overflow-auto">
  <div bind:this={container} class="w-full" style="height: 1000px;"></div>
</div>
