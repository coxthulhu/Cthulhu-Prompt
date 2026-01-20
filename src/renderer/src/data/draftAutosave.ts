export const AUTOSAVE_MS = 2000

export type AutosaveDraft = {
  dirty: boolean
  saving: boolean
  autosaveTimeoutId: number | null
}

type AutosaveController = {
  saveNow: () => Promise<void>
  markDirtyAndScheduleAutosave: () => void
}

export const clearAutosaveTimeout = (draft: AutosaveDraft): void => {
  if (draft.autosaveTimeoutId == null) return
  window.clearTimeout(draft.autosaveTimeoutId)
  draft.autosaveTimeoutId = null
}

export const resetAutosaveDraft = (draft: AutosaveDraft): void => {
  clearAutosaveTimeout(draft)
  draft.dirty = false
  draft.saving = false
}

export const createAutosaveController = ({
  draft,
  autosaveMs,
  save
}: {
  draft: AutosaveDraft
  autosaveMs: number
  save: () => Promise<void>
}): AutosaveController => {
  let saveInFlight: Promise<void> | null = null

  const saveNow = async (): Promise<void> => {
    if (!draft.dirty) return
    if (saveInFlight) {
      await saveInFlight
      if (draft.dirty) {
        await saveNow()
      }
      return
    }

    clearAutosaveTimeout(draft)
    draft.saving = true

    saveInFlight = (async () => {
      try {
        await save()
      } finally {
        draft.saving = false
        saveInFlight = null
      }
    })()

    await saveInFlight
  }

  const scheduleAutosave = () => {
    clearAutosaveTimeout(draft)
    draft.autosaveTimeoutId = window.setTimeout(() => {
      draft.autosaveTimeoutId = null
      void saveNow()
    }, autosaveMs)
  }

  const markDirtyAndScheduleAutosave = () => {
    draft.dirty = true
    scheduleAutosave()
  }

  return {
    saveNow,
    markDirtyAndScheduleAutosave
  }
}
