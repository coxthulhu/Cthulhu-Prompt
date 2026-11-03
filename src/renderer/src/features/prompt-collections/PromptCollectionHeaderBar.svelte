<script module lang="ts">
  /** One clickable breadcrumb segment in the fixed header path. */
  export type PromptCollectionHeaderSegment = {
    label: string
    testId: string
    onclick: () => void
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Search } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'

  /** Fixed header shared by the collection and single-prompt screens: path, path actions, and Find. */
  let { isReady, segments, findLabel, onFind, pathActions }: {
    /** Hides the path and Find until the screen's content can respond to them. */
    isReady: boolean
    /** Path segments from the collection down to the most specific location. */
    segments: PromptCollectionHeaderSegment[]
    /** Find button label and tooltip, including its shortcut. */
    findLabel: string
    onFind: () => void
    /** Optional controls shown directly after the path. */
    pathActions?: Snippet
  } = $props()
</script>

<div class="prompt-collection-header-bar flex h-9 shrink-0 items-center justify-between gap-3 px-6">
  {#if isReady}
    <div class="flex min-w-0 items-center gap-1">
      <div class="prompt-collection-header-breadcrumb flex min-w-0 items-center text-sm font-semibold">
        {#each segments as segment, index (segment.testId)}
          {#if index > 0}
            <span class="prompt-collection-header-separator mx-1 px-2">/</span>
          {/if}
          <button
            type="button"
            data-testid={segment.testId}
            class="prompt-collection-header-segment min-w-0 cursor-pointer truncate transition-colors duration-[var(--ui-animation-duration-standard)]"
            onclick={segment.onclick}
          >
            {segment.label}
          </button>
        {/each}
      </div>
      {@render pathActions?.()}
    </div>

    <IconButton
      icon={Search}
      label={findLabel}
      title={findLabel}
      size="compact"
      borderless
      testId="prompt-collection-find-button"
      onclick={onFind}
    />
  {/if}
</div>

<style>
  .prompt-collection-header-bar {
    /* Keep the fixed breadcrumb controls alongside Find and below editor popups. */
    position: relative;
    z-index: var(--z-chrome);
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .prompt-collection-header-breadcrumb,
  .prompt-collection-header-segment {
    color: var(--ui-muted-text);
  }

  .prompt-collection-header-segment {
    flex: 0 1 auto;
  }

  .prompt-collection-header-segment:hover {
    color: var(--ui-hoverable-text);
  }

  .prompt-collection-header-separator {
    color: var(--ui-neutral-emphasis-border);
  }

  .prompt-collection-header-segment:last-child {
    color: var(--ui-hoverable-text);
  }

  .prompt-collection-header-segment:last-child:hover {
    color: var(--ui-normal-text);
  }
</style>
