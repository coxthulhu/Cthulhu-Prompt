<script lang="ts">
  import { flip } from 'svelte/animate'
  import type { Action } from 'svelte/action'
  import { FileText, Layers } from 'lucide-svelte'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createListReorder } from '@renderer/common/drag-drop/listReorder.svelte.ts'
  import SelectorButton from '@renderer/common/cthulhu-ui/selectors/SelectorButton.svelte'
  import type { PromptCollectionDetails } from '@renderer/features/prompt-collections/promptCollectionDetails'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'

  /** One collection tile, keyed by its collection's ID. */
  export type NewTabCollectionTile = {
    id: string
    collection: PromptCollection
    details: PromptCollectionDetails
  }

  let { collections, openCollectionIds, onOpenCollection, onMoveCollection } = $props<{
    /** One project's visible collections in Show All order. */
    collections: NewTabCollectionTile[]
    /** Collections shown by other work tabs, whose tiles are marked open. */
    openCollectionIds: string[]
    /** Opens a clicked collection. */
    onOpenCollection: (collectionId: string) => void
    /** Saves a dragged collection right after another visible one, or first without one. */
    onMoveCollection: (collectionId: string, previousCollectionId: string | null) => Promise<void>
  }>()

  /** Tile action typed for SelectorButton's generic button action slot. */
  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>
  /** Stationary tile grid that owns pointer capture and defines where a dragged tile can go. */
  let gridElement = $state<HTMLElement>()
  /** Live drag reordering of the tiles, kept inside this project's grid. */
  const reorder = createListReorder({
    dragType: 'new-tab-collection',
    getIds: () => collections.map((tile: NewTabCollectionTile) => tile.id),
    // Grid slots come from untransformed tile sizes, so flip animations do not disturb hit testing. Outside the grid
    // the dragged tile keeps its last slot; space after the last tile maps to the last slot.
    getTargetIndex: (clientX, clientY) => {
      const grid = gridElement!
      /** Grid bounds, gaps and an unfilled last row included. */
      const rect = grid.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
      /** Every tile shares the first tile's size. */
      const tile = grid.firstElementChild as HTMLElement
      const style = window.getComputedStyle(grid)
      /** Tiles per row. */
      const columnCount = style.gridTemplateColumns.split(' ').length
      const column = Math.min(Math.floor((clientX - rect.left) / (tile.offsetWidth + parseFloat(style.columnGap))), columnCount - 1)
      const row = Math.floor((clientY - rect.top) / (tile.offsetHeight + parseFloat(style.rowGap)))
      return Math.min(row * columnCount + column, collections.length - 1)
    },
    onReorder: (_, collectionId, previousCollectionId) => onMoveCollection(collectionId, previousCollectionId)
  })
</script>

<div bind:this={gridElement} class="grid grid-cols-3 gap-2" data-pointer-drag-owner>
  {#each reorder.sort<NewTabCollectionTile>(collections) as { collection, details } (collection.id)}
    <!-- Tiles only slide while a drag previews a reorder; other changes apply instantly. -->
    <div class="min-w-0" animate:flip={{ duration: reorder.draggedId ? uiAnimationDurationMs.standard : 0 }}>
      <!-- The accent selection variant gives a dragged tile the Show All dropdown's dragged-row fill and border. -->
      <SelectorButton
        variant="tile"
        icon={collection.kind === 'template' ? Layers : FileText}
        text={collection.displayName}
        detailParts={details.modifiedText ? [details.countText, details.modifiedText] : [details.countText]}
        showChevron={false}
        openInTab={openCollectionIds.includes(collection.id)}
        rowState={reorder.draggedId === collection.id ? 'dragging' : reorder.draggedId ? 'drag-idle' : 'idle'}
        selectionVariant="accent"
        buttonAction={draggableButtonAction}
        buttonActionParameter={reorder.getDraggableOptions(collection.id)}
        testId={`new-tab-collection-${collection.id}`}
        onclick={() => onOpenCollection(collection.id)}
      />
    </div>
  {/each}
</div>
