<script module lang="ts">
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { VirtualWindowRowComponentProps } from '../virtualizer/virtualWindowTypes'

  export type PromptTreeRow =
    | {
        kind: 'root-folder'
        folder: PromptFolder
      }
    | {
        kind: 'folder'
        folder: PromptFolder
        parentFolder: PromptFolder | null
        indentCount: number
        isLastRow: boolean
        isSubfolder: boolean
      }
    | {
        kind: 'folder-prompt'
        folder: PromptFolder
        promptId: string
        indentCount: number
        isLastRow: boolean
        isNestedPrompt: boolean
      }
    | {
        kind: 'special'
        id: string
        label: string
      }
    | {
        kind: 'empty-state'
      }
    | {
        kind: 'bottom-spacer'
      }

  export type PromptTreeRootFolderRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'root-folder' }>
  >
  export type PromptTreeFolderRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'folder' }>
  >
  export type PromptTreePromptRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'folder-prompt' }>
  >
  export type PromptTreeSpecialRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'special' }>
  >
  export type PromptTreeEmptyStateRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'empty-state' }>
  >
  export type PromptTreeBottomSpacerRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'bottom-spacer' }>
  >
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowViewportMetrics
  } from '../virtualizer/virtualWindowTypes'

  type Props = {
    items: VirtualWindowItem<PromptTreeRow>[]
    testId: string
    spacerTestId: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand | null
    viewportMetrics?: VirtualWindowViewportMetrics | null
    rootFolderRow: Snippet<[PromptTreeRootFolderRowProps]>
    promptTreeRootFolderRowOverlay?: Snippet<[PromptTreeRootFolderRowProps]>
    folderRow: Snippet<[PromptTreeFolderRowProps]>
    promptTreeFolderRowOverlay?: Snippet<[PromptTreeFolderRowProps]>
    folderPromptRow: Snippet<[PromptTreePromptRowProps]>
    promptTreeRowOverlay?: Snippet<[PromptTreePromptRowProps]>
    specialRow: Snippet<[PromptTreeSpecialRowProps]>
    emptyStateRow: Snippet<[PromptTreeEmptyStateRowProps]>
    bottomSpacerRow: Snippet<[PromptTreeBottomSpacerRowProps]>
    promptTreeBottomSpacerRowOverlay?: Snippet<[PromptTreeBottomSpacerRowProps]>
  }

  let {
    items,
    testId,
    spacerTestId,
    scrollToWithinWindowBand = $bindable<ScrollToWithinWindowBand | null>(null),
    viewportMetrics = $bindable<VirtualWindowViewportMetrics | null>(null),
    rootFolderRow,
    promptTreeRootFolderRowOverlay,
    folderRow,
    promptTreeFolderRowOverlay,
    folderPromptRow,
    promptTreeRowOverlay,
    specialRow,
    emptyStateRow,
    bottomSpacerRow,
    promptTreeBottomSpacerRowOverlay
  }: Props = $props()

  const PROMPT_TREE_ROW_HEIGHT_PX = 32
  const rowRegistry = $derived.by(() =>
    defineVirtualWindowRowRegistry<PromptTreeRow>({
      'root-folder': {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        centerRowEligible: true,
        overlayRow: { snippet: promptTreeRootFolderRowOverlay },
        snippet: rootFolderRow
      },
      folder: {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        centerRowEligible: true,
        overlayRow: { snippet: promptTreeFolderRowOverlay },
        snippet: folderRow
      },
      'folder-prompt': {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        overlayRow: { snippet: promptTreeRowOverlay },
        snippet: folderPromptRow
      },
      special: {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        snippet: specialRow
      },
      'empty-state': {
        estimateHeight: () => 86,
        snippet: emptyStateRow
      },
      'bottom-spacer': {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        overlayRow: { snippet: promptTreeBottomSpacerRowOverlay },
        snippet: bottomSpacerRow
      }
    })
  )
</script>

<SvelteVirtualWindow
  {items}
  {rowRegistry}
  overlayScrollbar
  leftScrollPaddingPx={0}
  rightScrollPaddingPx={0}
  {testId}
  {spacerTestId}
  bind:scrollToWithinWindowBand
  bind:viewportMetrics
/>
