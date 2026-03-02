<script lang="ts">
  import VSCodeMonaco from './VSCodeMonaco.svelte'
</script>

<div class="h-full w-full overflow-auto p-6" data-testid="test-screen">
  <h1 class="text-2xl font-semibold">Test Screen</h1>
  <p class="mt-3 text-muted-foreground">
    Monaco VS Code API test editor.
  </p>
  <div class="mt-4">
    <VSCodeMonaco
      initialValue={`# Monaco VS Code API

This is a basic test editor.`}
    />
  </div>
</div>
