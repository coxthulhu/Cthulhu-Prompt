import { noteClientStateCollection } from '@renderer/data/Collections/NoteClientStateCollection'
import { noteEditorMeasuredHeight } from '@renderer/data/UiState/cache/NoteEditorUiCache.svelte.ts'
import { MIN_PROMPT_FONT_SIZE, MAX_PROMPT_FONT_SIZE } from '@shared/domain/settings/SystemSettings'

/** Removes session markers and font-specific measurements for deleted notes. */
export const deleteNoteClientStates = (noteIds: string[]): void => {
  for (const id of noteIds) {
    if (noteClientStateCollection.has(id)) noteClientStateCollection.delete(id)
    // Each cached font variant belongs to the same deleted note.
    for (let fontSize = MIN_PROMPT_FONT_SIZE; fontSize <= MAX_PROMPT_FONT_SIZE; fontSize += 1) {
      noteEditorMeasuredHeight.clear(`${id}:${fontSize}`)
    }
  }
}
