<script module lang="ts">
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Category } from '@shared/Category'
  import type { VirtualWindowRowComponentProps } from '../virtualizer/virtualWindowTypes'

  export type PromptTreeRow =
    | {
        kind: 'root-folder'
        folder: PromptFolder
      }
    | {
        kind: 'category'
        category: Category
        rootFolder: PromptFolder
        indentCount: number
        endsVisibleBranch: boolean
        /** Whether this row owns the unique prompt drop target at tree start. */
        isFirstTreeRow: boolean
      }
    | {
        kind: 'prompt'
        folder: PromptFolder
        categoryId: string | null
        promptId: string
        indentCount: number
        isLastRow: boolean
        /** Whether this row owns the unique prompt drop target at tree start. */
        isFirstTreeRow: boolean
      }
    /** Creation action beneath an expanded category with no visible content. */
    | {
        kind: 'empty-category'
        /** Category that receives the new prompt or template. */
        category: Category
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
  /** Virtual-row props for one category header. */
  export type PromptTreeCategoryRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'category' }>
  >
  export type PromptTreePromptRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'prompt' }>
  >
  /** Virtual-row props for the empty-category creation action. */
  export type PromptTreeEmptyCategoryRowProps = VirtualWindowRowComponentProps<
    Extract<PromptTreeRow, { kind: 'empty-category' }>
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
    categoryRow: Snippet<[PromptTreeCategoryRowProps]>
    promptTreeCategoryRowOverlay?: Snippet<[PromptTreeCategoryRowProps]>
    promptRow: Snippet<[PromptTreePromptRowProps]>
    promptTreeRowOverlay?: Snippet<[PromptTreePromptRowProps]>
    /** Renders the inline creation action for an empty category. */
    emptyCategoryRow: Snippet<[PromptTreeEmptyCategoryRowProps]>
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
    categoryRow,
    promptTreeCategoryRowOverlay,
    promptRow,
    promptTreeRowOverlay,
    emptyCategoryRow,
    emptyStateRow,
    bottomSpacerRow,
    promptTreeBottomSpacerRowOverlay
  }: Props = $props()

  const PROMPT_TREE_ROW_HEIGHT_PX = 32
  const PROMPT_TREE_BOTTOM_SPACER_HEIGHT_PX = 16
  const rowRegistry = $derived.by(() =>
    defineVirtualWindowRowRegistry<PromptTreeRow>({
      'root-folder': {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        centerRowEligible: true,
        overlayRow: { snippet: promptTreeRootFolderRowOverlay },
        snippet: rootFolderRow
      },
      category: {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        centerRowEligible: true,
        overlayRow: { snippet: promptTreeCategoryRowOverlay },
        snippet: categoryRow
      },
      prompt: {
        estimateHeight: () => PROMPT_TREE_ROW_HEIGHT_PX,
        overlayRow: { snippet: promptTreeRowOverlay },
        snippet: promptRow
      },
      // Preserve the compact action's 22px content height and 1px padding on each side.
      'empty-category': {
        estimateHeight: () => 24,
        snippet: emptyCategoryRow
      },
      'empty-state': {
        estimateHeight: () => 86,
        snippet: emptyStateRow
      },
      'bottom-spacer': {
        estimateHeight: () => PROMPT_TREE_BOTTOM_SPACER_HEIGHT_PX,
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
