export type WorkspaceInfoFile = {
  /** Version governing this file and every persisted file in its workspace. */
  schemaVersion: number
  workspaceId: string
  workspaceName: string
}

export type PromptCollectionInfoFile = {
  displayName: string
  collectionId: string
  kind: 'prompt' | 'template'
}

export type PromptCollectionOrderFile = OrderContainer<EntryRef>

/** Collection prompt or template category ordering stored in CategoryOrder.json. */
export type PromptCollectionCategoryOrderFile = import('@shared/domain/prompt-collection/PromptCollection').CategoryOrder

import type { EntryRef, OrderContainer } from '@shared/domain/OrderContainer'
