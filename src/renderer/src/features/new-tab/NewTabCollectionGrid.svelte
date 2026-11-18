<script lang="ts">
  import type { Action } from 'svelte/action'
  import { FileText, Layers } from 'lucide-svelte'
  import {
    createDroppableStateRegistry,
    draggable,
    droppable,
    type DraggableOptions,
    type DroppableOptions
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import DropIndicator from '@renderer/common/drag-drop/DropIndicator.svelte'
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

  /** Drop payload naming the tile a dropped tile follows, or null to place it first. */
  type TileDropPayload = { previousId: string | null }

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

  /** Tiles per row, matching the grid's grid-cols-3 class. */
  const COLUMN_COUNT = 3
  /** Drop state key for the grid's end, which no collection ID equals. */
  const END_DROP_KEY = ''
  /** Identity unique to this grid instance. */
  const gridId = $props.id()
  /** Drag type unique to this grid, so a dragged tile only drops among its own project's tiles. */
  const dragType = `new-tab-collection:${gridId}`
  /** Drop line state for each tile's left side, keyed by collection ID, and for the grid's end. */
  const dropStates = createDroppableStateRegistry<string>()
  /** Tile currently being dragged, or null while idle. */
  let draggedId = $state<string | null>(null)
  /** Empty cells after the last tile, which the grid's end covers; zero when the last row is full. */
  const emptyCellCount = $derived((COLUMN_COUNT - (collections.length % COLUMN_COUNT)) % COLUMN_COUNT)

  /** Kind icon shared by a collection's tile and its drag ghost. */
  const getCollectionIcon = (collection: PromptCollection) => (collection.kind === 'template' ? Layers : FileText)
  /** Tile action typed for SelectorButton's generic button action slot. */
  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>

  /**
   * Drop target whose left side places a dragged tile right after previousId, or first when it is null. It snaps from up
   * to 100px outside the grid, and is blocked when the drop would leave the dragged tile where it is.
   */
  const getDropOptions = (key: string, previousId: string | null): DroppableOptions<string, TileDropPayload> => ({
    dragType,
    allowedEdges: 'left',
    snapDimensions: { x: 100, y: 100 },
    payload: { previousId },
    canDrop: (draggedCollectionId) => {
      /** Tile IDs in display order. */
      const ids = collections.map((tile: NewTabCollectionTile) => tile.id)
      return previousId !== draggedCollectionId && previousId !== (ids[ids.indexOf(draggedCollectionId) - 1] ?? null)
    },
    indicator: dropStates.getState(key)
  })

  /** Draggable options for one tile, which saves its new position after a drop on an unblocked line. */
  const getDraggableOptions = (collectionId: string): DraggableOptions<string, TileDropPayload> => ({
    dragType,
    payload: collectionId,
    createGhost: () => {
      /** Dragged tile's collection, named and iconed like its tile. */
      const { collection } = collections.find((tile: NewTabCollectionTile) => tile.id === collectionId)!
      return createPromptDragGhost(collection.displayName, 'collection', getCollectionIcon(collection))
    },
    onDragStart: () => {
      draggedId = collectionId
    },
    onDragFinish: ({ dropPayload }) => {
      draggedId = null
      if (dropPayload) void onMoveCollection(collectionId, dropPayload.previousId)
    }
  })
</script>

<div class="grid grid-cols-3 gap-2" data-pointer-drag-owner>
  {#each collections as { collection, details }, index (collection.id)}
    <div class="relative min-w-0" use:droppable={getDropOptions(collection.id, collections[index - 1]?.id ?? null)}>
      <!-- The accent selection variant gives a dragged tile the Show All dropdown's dragged-row fill and border. -->
      <SelectorButton
        variant="tile"
        icon={getCollectionIcon(collection)}
        text={collection.displayName}
        detailParts={details.modifiedText ? [details.countText, details.modifiedText] : [details.countText]}
        showChevron={false}
        openInTab={openCollectionIds.includes(collection.id)}
        rowState={draggedId === collection.id ? 'dragging' : draggedId ? 'drag-idle' : 'idle'}
        selectionVariant="accent"
        buttonAction={draggableButtonAction}
        buttonActionParameter={getDraggableOptions(collection.id)}
        testId={`new-tab-collection-${collection.id}`}
        onclick={() => onOpenCollection(collection.id)}
      />
      {#if dropStates.isOver(collection.id)}
        <!-- The tile-high line starts at the tile's top and centers in the 8px gap beside it. -->
        <DropIndicator
          testId="new-tab-tile-drop-indicator"
          edge="left"
          insetStart="10px"
          edgeOffset="4px"
          isBlocked={dropStates.isBlocked(collection.id)}
        />
      {/if}
      {#if index === collections.length - 1}
        <!-- The grid's end starts one gap past the last tile and covers the row's empty cells; past a full row its width
             computes below zero, which CSS clamps to a zero-width line. Its left side is the line after the last tile. -->
        <div
          class="absolute inset-y-0 left-[calc(100%+8px)]"
          style:width="calc({emptyCellCount} * (100% + 8px) - 8px)"
          use:droppable={getDropOptions(END_DROP_KEY, collection.id)}
        >
          {#if dropStates.isOver(END_DROP_KEY)}
            <DropIndicator
              testId="new-tab-tile-drop-indicator"
              edge="left"
              insetStart="10px"
              edgeOffset="4px"
              isBlocked={dropStates.isBlocked(END_DROP_KEY)}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>
