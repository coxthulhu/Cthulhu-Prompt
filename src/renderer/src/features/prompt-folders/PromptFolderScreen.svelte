<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { PromptFolder } from '@shared/ipc'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import { estimatePromptEditorHeight } from '../prompt-editor/promptEditorSizing'
  import {
    getPromptData,
    lookupPromptEditorMeasuredHeight
  } from '@renderer/data/PromptDataStore.svelte.ts'
  import PromptDivider from '../prompt-editor/PromptDivider.svelte'
  import BottomSpacer, { getBottomSpacerHeightPx } from '../prompt-editor/BottomSpacer.svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps
  } from '../virtualizer/virtualWindowTypes'
  import {
    getPromptFolderData,
    loadPromptFolder,
    createPromptInFolder,
    deletePromptInFolder,
    movePromptDownInFolder,
    movePromptUpInFolder
  } from '@renderer/data/PromptFolderDataStore.svelte.ts'
  import { promptFolderFindState } from './promptFolderFindState.svelte.ts'

  let { folder } = $props<{ folder: PromptFolder }>()
  let isFindOpen = $state(false)
  let findInput = $state<HTMLTextAreaElement | null>(null)
  let isFindInputFocused = $state(false)

  // Side effect: reload prompts and close the find dialog when the selected folder changes.
  $effect(() => {
    isFindOpen = false
    void loadPromptFolder(folder.folderName)
  })

  const folderData = $derived(getPromptFolderData(folder.folderName))
  const isFindAvailable = $derived(
    Boolean(folderData && !folderData.isLoading && !folderData.errorMessage)
  )

  const focusFindInput = async () => {
    // Side effect: wait for the dialog to render before focusing the input.
    await tick()
    if (!findInput) return
    findInput.focus()
    findInput.select()
  }

  const openFindDialog = () => {
    if (!isFindAvailable) return
    isFindOpen = true
    void focusFindInput()
  }

  const closeFindDialog = () => {
    isFindOpen = false
  }

  // Side effect: close the find dialog when the screen is loading or errored.
  $effect(() => {
    if (!isFindAvailable && isFindOpen) {
      isFindOpen = false
    }
  })

  // Side effect: capture global find/escape shortcuts while the prompt folder screen is active.
  onMount(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isFindOpen) return
        event.preventDefault()
        event.stopPropagation()
        closeFindDialog()
        return
      }

      if (
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault()
        event.stopPropagation()
        openFindDialog()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown, { capture: true })
    }
  })

  type PromptFolderRow =
    | { kind: 'header'; promptCount: number; isLoading: boolean; folder: PromptFolder }
    | { kind: 'placeholder'; messageKind: 'loading' | 'empty' }
    | { kind: 'prompt-divider'; previousPromptId: string | null }
    | { kind: 'prompt-editor'; promptId: string }
    | { kind: 'bottom-spacer' }

  type PromptEditorRowProps = VirtualWindowRowComponentProps<
    Extract<PromptFolderRow, { kind: 'prompt-editor' }>
  >

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    header: {
      estimateHeight: () => 164,
      snippet: headerRow
    },
    placeholder: {
      estimateHeight: () => 120,
      snippet: placeholderRow
    },
    'prompt-divider': {
      // Match the xs button height so the divider row doesn't clip.
      estimateHeight: () => 28,
      snippet: dividerRow
    },
    'prompt-editor': {
      estimateHeight: (row, widthPx, heightPx) =>
        estimatePromptEditorHeight(getPromptData(row.promptId).draft.text, widthPx, heightPx),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) =>
        lookupPromptEditorMeasuredHeight(row.promptId, widthPx, devicePixelRatio),
      needsOverlayRow: true,
      snippet: promptEditorRow
    },
    'bottom-spacer': {
      estimateHeight: (_row, _widthPx, heightPx) => getBottomSpacerHeightPx(heightPx),
      snippet: bottomSpacerRow
    }
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptFolderRow>[] => {
    const promptIds = folderData?.promptIds ?? []
    const isLoading = folderData?.isLoading ?? true
    const rows: VirtualWindowItem<PromptFolderRow>[] = [
      {
        id: 'header',
        row: {
          kind: 'header',
          promptCount: promptIds.length,
          isLoading,
          folder
        }
      }
    ]

    if (isLoading) {
      rows.push({
        id: 'placeholder-loading',
        row: { kind: 'placeholder', messageKind: 'loading' }
      })
    } else if (promptIds.length === 0) {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })
      rows.push({
        id: 'placeholder-empty',
        row: { kind: 'placeholder', messageKind: 'empty' }
      })
    } else {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })

      promptIds.forEach((promptId) => {
        rows.push({ id: `${promptId}-editor`, row: { kind: 'prompt-editor', promptId } })
        rows.push({
          id: `${promptId}-divider`,
          row: { kind: 'prompt-divider', previousPromptId: promptId }
        })
      })
    }

    rows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return rows
  })

  const handleAddPrompt = (previousPromptId: string | null) => {
    void createPromptInFolder(folder.folderName, previousPromptId)
  }

  const handleDeletePrompt = (promptId: string) => {
    void deletePromptInFolder(folder.folderName, promptId)
  }

  const handleMovePromptUp = (promptId: string) => {
    return movePromptUpInFolder(folder.folderName, promptId)
  }

  const handleMovePromptDown = (promptId: string) => {
    return movePromptDownInFolder(folder.folderName, promptId)
  }
</script>

<main class="flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
  {#if folderData && folderData.errorMessage}
    <div class="flex-1 min-h-0 overflow-y-auto">
      <div class="pt-6 pl-6">
        <h1 class="text-2xl font-bold">{folder.displayName}</h1>
        <p class="mt-4 text-muted-foreground">
          Edit prompts in the "{folder.displayName}" folder.
        </p>
        <h2 class="mt-6 text-lg font-semibold mb-4">
          Prompts ({folderData.isLoading ? 0 : folderData.promptIds.length})
        </h2>
        <p class="mt-6 text-red-500">Error loading prompts: {folderData.errorMessage}</p>
      </div>
    </div>
  {:else}
    <div class="flex-1 min-h-0 flex">
      <SvelteVirtualWindow
        items={virtualItems}
        {rowRegistry}
        getHydrationPriorityEligibility={(row) => row.kind === 'prompt-editor'}
      />
    </div>
  {/if}
</main>

{#if isFindOpen && isFindAvailable}
  <div
    class="monaco-editor vs-dark monaco-find-widget-host"
    style="position: fixed; top: 0; right: 14px; width: 320px; z-index: 40;"
  >
    <div class="editor-widget find-widget visible" style="width: 320px; transition: none;">
      <div class="find-part">
        <div class="monaco-findInput">
          <div class="monaco-scrollable-element" role="presentation" style="position: relative; overflow: hidden;">
            <div
              class="monaco-inputbox idle"
              class:synthetic-focus={isFindInputFocused}
              style="background-color: var(--vscode-input-background, #3c3c3c); color: var(--vscode-input-foreground, #cccccc); border: 1px solid var(--vscode-input-border, transparent);"
            >
              <div class="ibwrapper">
                <textarea
                  bind:this={findInput}
                  bind:value={promptFolderFindState.query}
                  class="input"
                  class:empty={!promptFolderFindState.query}
                  rows="1"
                  wrap="off"
                  placeholder="Find"
                  aria-label="Find"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  style="background-color: inherit;"
                  onfocus={() => {
                    isFindInputFocused = true
                  }}
                  onblur={() => {
                    isFindInputFocused = false
                  }}
                ></textarea>
                <div class="mirror">{promptFolderFindState.query || ' '}</div>
              </div>
            </div>
          </div>
          <div class="controls" style="display: none;"></div>
        </div>
        <div class="find-actions">
          <div class="matchesCount" style="min-width: 69px;">0 of 0</div>
          <div
            class="button previous codicon codicon-find-previous-match"
            role="button"
            tabindex="0"
            title="Find Previous"
            aria-label="Find Previous"
            onclick={() => {}}
            onkeydown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
            }}
          ></div>
          <div
            class="button next codicon codicon-find-next-match"
            role="button"
            tabindex="0"
            title="Find Next"
            aria-label="Find Next"
            onclick={() => {}}
            onkeydown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
            }}
          ></div>
        </div>
      </div>
      <div
        class="button codicon codicon-widget-close"
        role="button"
        tabindex="0"
        title="Close"
        aria-label="Close"
        onclick={closeFindDialog}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          closeFindDialog()
        }}
      ></div>
    </div>
  </div>
{/if}

{#snippet headerRow({ row })}
  <div class="pt-6">
    <h1 class="text-2xl font-bold">{row.folder.displayName}</h1>
    <p class="mt-4 text-muted-foreground">
      Edit prompts in the "{row.folder.displayName}" folder.
    </p>
    <h2 class="mt-6 text-lg font-semibold mb-4">
      Prompts ({row.isLoading ? 0 : row.promptCount})
    </h2>
  </div>
{/snippet}

{#snippet placeholderRow({ row })}
  <div class="text-center py-12 text-muted-foreground">
    {#if row.messageKind === 'loading'}
      <p>Loading prompts...</p>
    {:else}
      <p>No prompts found in this folder.</p>
      <p class="text-sm mt-2">Click the + button to create your first prompt.</p>
    {/if}
  </div>
{/snippet}

{#snippet dividerRow({ row })}
  <PromptDivider
    disabled={folderData?.isCreatingPrompt ?? false}
    onAddPrompt={() => handleAddPrompt(row.previousPromptId)}
    testId={
      row.previousPromptId
        ? `prompt-divider-add-after-${row.previousPromptId}`
        : 'prompt-divider-add-initial'
    }
  />
{/snippet}

{#snippet promptEditorRow({
  row,
  rowId,
  virtualWindowWidthPx,
  virtualWindowHeightPx,
  devicePixelRatio,
  measuredHeightPx,
  hydrationPriority,
  shouldDehydrate,
  overlayRowElement,
  scrollToWithinWindowBand,
  onHydrationChange
}: PromptEditorRowProps)}
  <PromptEditorRow
    promptId={row.promptId}
    {rowId}
    {virtualWindowWidthPx}
    {virtualWindowHeightPx}
    {devicePixelRatio}
    {measuredHeightPx}
    {hydrationPriority}
    {shouldDehydrate}
    {overlayRowElement}
    {onHydrationChange}
    {scrollToWithinWindowBand}
    onDelete={() => handleDeletePrompt(row.promptId)}
    onMoveUp={() => handleMovePromptUp(row.promptId)}
    onMoveDown={() => handleMovePromptDown(row.promptId)}
  />
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
