<script lang="ts">
  import type { Action } from 'svelte/action'
  import { FileText, Layers } from 'lucide-svelte'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import DropIndicator from '@renderer/common/drag-drop/DropIndicator.svelte'
  import { createDropIndicatorReorder } from '@renderer/common/drag-drop/dropIndicatorReorder.svelte.ts'
  import SelectorButton from '@renderer/common/cthulhu-ui/selectors/SelectorButton.svelte'
  import type { PromptCollectionDetails } from '@renderer/features/prompt-collections/promptCollectionDetails'
  import { createPromptDragGhost } from '@renderer/features/prompt-drag-drop/promptDragGhost'
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

  /** Kind icon shared by a collection's tile and its drag ghost. */
  const getCollectionIcon = (collection: PromptCollection) => (collection.kind === 'template' ? Layers : FileText)
  /** Tile action typed for SelectorButton's generic button action slot. */
  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>
  /** Tile grid that owns pointer capture and defines where a dragged tile can go. */
  let gridElement = $state<HTMLElement>()
  /** Drag reordering of the tiles, kept inside this project's grid. */
  const reorder = createDropIndicatorReorder({
    dragType: 'new-tab-collection',
    getIds: () => collections.map((tile: NewTabCollectionTile) => tile.id),
    // The tile under the pointer, and which half of it, sets the boundary; space after the last tile of an unfilled
    // row is after that tile. Outside the grid there is no target.
    getDropTarget: (clientX, clientY) => {
      const grid = gridElement!
      /** Grid bounds, gaps and an unfilled last row included. */
      const rect = grid.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
      /** Every tile shares the first tile's size. */
      const tile = grid.firstElementChild as HTMLElement
      const style = window.getComputedStyle(grid)
      /** Tiles per row. */
      const columnCount = style.gridTemplateColumns.split(' ').length
      /** Tile width plus the gap after it. */
      const columnPitch = tile.offsetWidth + parseFloat(style.columnGap)
      const column = Math.min(Math.floor((clientX - rect.left) / columnPitch), columnCount - 1)
      const row = Math.floor((clientY - rect.top) / (tile.offsetHeight + parseFloat(style.rowGap)))
      /** Tile in the pointer's grid cell, absent in an unfilled row's empty cells. */
      const hoveredTile: NewTabCollectionTile | undefined = collections[row * columnCount + column]
      return hoveredTile
        ? { id: hoveredTile.id, after: clientX - rect.left - column * columnPitch > tile.offsetWidth / 2 }
        : { id: collections[collections.length - 1].id, after: true }
    },
    createGhost: (collectionId) => {
      /** Dragged tile's collection, named and iconed like its tile. */
      const { collection } = collections.find((tile: NewTabCollectionTile) => tile.id === collectionId)!
      return createPromptDragGhost(collection.displayName, 'collection', getCollectionIcon(collection))
    },
    onReorder: (collectionId, previousCollectionId) => onMoveCollection(collectionId, previousCollectionId)
  })
</script>

<div bind:this={gridElement} class="grid grid-cols-3 gap-2" data-pointer-drag-owner>
  {#each collections as { collection, details } (collection.id)}
    <div class="relative min-w-0">
      <!-- The accent selection variant gives a dragged tile the Show All dropdown's dragged-row fill and border. -->
      <SelectorButton
        variant="tile"
        icon={getCollectionIcon(collection)}
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
      {#if reorder.dropTarget?.id === collection.id}
        <!-- The tile-high line starts at the tile's top and centers in the 8px gap beside it. -->
        <DropIndicator
          testId="new-tab-tile-drop-indicator"
          edge={reorder.dropTarget?.after ? 'right' : 'left'}
          insetStart="10px"
          edgeOffset="4px"
          isBlocked={reorder.isBlocked}
        />
      {/if}
    </div>
  {/each}
</div>
