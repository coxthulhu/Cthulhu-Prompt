import type { AuthoritativeSnapshot } from '@shared/AuthoritativeSnapshot'
import type { DomainTarget } from '@shared/DomainChanges'
import { data } from '../Data/Data'
import {
  buildCategorySnapshot,
  buildPromptFolderSnapshot,
  buildPromptSnapshot,
  buildPromptTemplateSnapshot,
  buildWorkspaceSnapshot
} from '../Data/DataSnapshotHelpers'

/** Builds a present or deleted authoritative snapshot for one registered entity target. */
const buildMainAuthoritativeSnapshot = (target: DomainTarget): AuthoritativeSnapshot => {
  switch (target.entityType) {
    case 'systemSettings': {
      /** Current system-settings entry selected by its singleton target ID. */
      const entry = data.systemSettings.committedStore.getEntry(target.id)
      return entry
        ? {
            entityType: 'systemSettings',
            id: target.id,
            revision: entry.revision,
            data: entry.committed
          }
        : { entityType: 'systemSettings', id: target.id, deleted: true }
    }
    case 'workspace': {
      /** Current workspace entry used by the established snapshot normalizer. */
      const entry = data.workspace.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'workspace', ...buildWorkspaceSnapshot(entry) }
        : { entityType: 'workspace', id: target.id, deleted: true }
    }
    case 'promptFolder': {
      /** Current prompt-folder entry used by the established graph filter. */
      const entry = data.promptFolder.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'promptFolder', ...buildPromptFolderSnapshot(entry) }
        : { entityType: 'promptFolder', id: target.id, deleted: true }
    }
    case 'category': {
      /** Current category entry selected for generic reconciliation. */
      const entry = data.category.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'category', ...buildCategorySnapshot(entry) }
        : { entityType: 'category', id: target.id, deleted: true }
    }
    case 'prompt': {
      /** Current prompt entry used by the established modified-time snapshot adapter. */
      const entry = data.prompt.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'prompt', ...buildPromptSnapshot(entry) }
        : { entityType: 'prompt', id: target.id, deleted: true }
    }
    case 'promptTemplate': {
      /** Current template entry used by the established modified-time snapshot adapter. */
      const entry = data.promptTemplate.committedStore.getEntry(target.id)
      return entry
        ? { entityType: 'promptTemplate', ...buildPromptTemplateSnapshot(entry) }
        : { entityType: 'promptTemplate', id: target.id, deleted: true }
    }
    case 'userPersistence':
    case 'markdownContentUiState':
    case 'workspaceUiState':
    case 'workspacePromptFolderUiState':
    case 'accordionUiState':
    case 'categoryDescriptionEditorUiState': {
      /** Current SQLite-backed entry selected by its authoritative target ID. */
      const entry = data[target.entityType].committedStore.getEntry(target.id)
      return entry
        ? ({
            entityType: target.entityType,
            id: target.id,
            revision: entry.revision,
            data: entry.committed
          } as AuthoritativeSnapshot)
        : ({
            entityType: target.entityType,
            id: target.id,
            deleted: true
          } as AuthoritativeSnapshot)
    }
  }
}

/** Builds authoritative snapshots for a complete target set in target order. */
export const buildMainAuthoritativeSnapshots = (
  targets: readonly DomainTarget[]
): AuthoritativeSnapshot[] => targets.map(buildMainAuthoritativeSnapshot)
