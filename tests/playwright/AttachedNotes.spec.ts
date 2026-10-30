import type { Page } from '@playwright/test'
import type { AuthoritativeSnapshot } from '@shared/ipc/AuthoritativeSnapshot'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { focusMonacoEditor, isMonacoEditorFocused, setMonacoSelections, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { readWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { readTextFile, checkFileExists } from '../helpers/PromptPersistenceTestHelpers'
import { measureEditorCardGeometry } from '../helpers/CardGeometryHelpers'

/** Production controls, Monaco, SQLite, and workspace files are exercised together. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Isolated workspace identity shared by the two library variants. */
const WORKSPACE = '/ws/attached-note-ui'
/** Workspace-scoped visibility key used for persistence assertions. */
const WORKSPACE_ID = createDeterministicId(WORKSPACE)
/** Owner card and separate editor regions avoid ambiguous Monaco lookups. */
const OWNER = '[data-testid="prompt-editor-owner"]'
/** Main text editor excludes the attached note. */
const BODY = `${OWNER} .prompt-editor-body-editor-section`
/** Note text editor has its own focus, model, and viewport. */
const NOTE = `${OWNER} [data-testid="attached-note-editor"]`

/** Starts two owners in either library, optionally with an overflowing main document. */
const startNotes = async (testSetup: TestSetup, kind: 'prompt' | 'template', text = 'Owner text') => {
  /** Equivalent fixtures expose the same shared editor behavior. */
  const files = kind === 'prompt'
    ? createWorkspaceWithCollections(WORKSPACE, [{ folderName: 'Content', displayName: 'Content', prompts: [
        { id: 'owner', title: 'Owner', promptText: text }, { id: 'neighbor', title: 'Neighbor', promptText: 'Neighbor text' }
      ] }])
    : createWorkspaceWithTemplateCollections(WORKSPACE, [{ folderName: 'Content', displayName: 'Content', templates: [
        { id: 'owner', title: 'Owner', templateText: text }, { id: 'neighbor', title: 'Neighbor', templateText: 'Neighbor text' }
      ] }])
  await testSetup.setupFilesystem(files)
  await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE)])
  /** Real application and navigation helpers for this fixture. */
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  /** Reused navigation remounts the screen without resetting session markers. */
  const openCollection = () => kind === 'prompt'
    ? started.testHelpers.navigateToPromptCollections('Content')
    : started.testHelpers.navigateToPromptTemplateCollections('Content')
  await openCollection()
  await waitForMonacoEditor(started.mainWindow, BODY)
  return { ...started, openCollection, active: `${WORKSPACE}/${kind === 'prompt' ? 'Prompts' : 'Templates'}/Content/Active` }
}

/** Reads committed settings independently of the editable settings form. */
const readSettings = (page: Page) => page.evaluate(async () => {
  /** Main-process snapshots reveal whether invalid input was accidentally saved. */
  const result = await window.electron.ipcRenderer.invoke('load-system-settings')
  return result.snapshots.find((snapshot: AuthoritativeSnapshot) => snapshot.entityType === 'systemSettings')!.data
})

/** Measures actual Monaco viewports in units of their rendered line height. */
const readLineBudget = (page: Page) => page.locator(OWNER).evaluate((row) => {
  /** The main and note editors have separate registration entries. */
  const editors = window.__cthulhuMonacoEditors!.filter((entry) => row.contains(entry.container))
  /** Measures DOM height rather than comparing application sizing constants. */
  const measure = (selector: string) => {
    /** Hydrated root whose bounding box is the displayed viewport. */
    const root = row.querySelector<HTMLElement>(`${selector} .monaco-editor:has(.view-lines)` )!
    /** Rendered visual line height includes the current font setting. */
    const lineHeight = root.querySelector('.view-line')!.getBoundingClientRect().height
    /** Registry entry supplies unclamped wrapped content height. */
    const editor = editors.find((entry) => entry.container.contains(root))!.editor
    return { height: root.getBoundingClientRect().height, lineHeight, contentHeight: editor.getContentHeight() }
  }
  return { body: measure('.prompt-editor-body-editor-section'), note: measure('[data-testid="attached-note-editor"]') }
})

/** Checks row clipping and bottom alignment with a one-pixel tolerance. */
const expectCardFits = async (page: Page) => {
  await expect.poll(async () => {
    /** Natural child geometry catches clipping hidden by the card's pinned height. */
    const geometry = (await measureEditorCardGeometry(page, OWNER))!
    return Math.max(geometry.hiddenOverflowPx, Math.abs(geometry.bodyChildrenFillGapPx!), Math.abs(geometry.promptSidebarFillGapPx!))
  }).toBeLessThanOrEqual(1)
}

describe('Attached note editors', () => {
  for (const kind of ['prompt', 'template'] as const) {
    test(`${kind} creates an expanded note without a collapsed frame or a second height change`, async ({ testSetup }) => {
      const { mainWindow } = await startNotes(testSetup, kind)
      // Observe painted frames from the Add click through Monaco taking focus.
      const frames = await mainWindow.locator(OWNER).evaluate((owner) => new Promise<Array<{ expanded: string | null; height: number }>>((resolve, reject) => {
        const samples: Array<{ expanded: string | null; height: number }> = []
        let focusedFrames = 0
        const deadline = performance.now() + 10_000
        const sample = () => {
          const header = owner.querySelector('[data-testid="attached-note-header"]')
          if (header) samples.push({ expanded: header.getAttribute('aria-expanded'), height: owner.getBoundingClientRect().height })
          const note = owner.querySelector('[data-testid="attached-note-editor"]')
          const editor = window.__cthulhuMonacoEditors?.find((entry) => note?.contains(entry.container))?.editor
          focusedFrames = editor?.hasTextFocus() ? focusedFrames + 1 : 0
          if (focusedFrames >= 3) resolve(samples)
          else if (performance.now() > deadline) reject(new Error('New note did not receive focus'))
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
        owner.querySelector<HTMLButtonElement>('[data-testid="attached-note-button"]')!.click()
      }))
      expect(frames.length).toBeGreaterThan(0)
      expect(frames.every((frame) => frame.expanded === 'true')).toBe(true)
      const heights = frames.map((frame) => frame.height)
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
      await expectCardFits(mainWindow)
    })

    test(`${kind} focuses the correct editor from its padded background without changing selection`, async ({ testSetup }) => {
      const { mainWindow } = await startNotes(testSetup, kind)
      const owner = mainWindow.locator(OWNER)
      await owner.getByTestId('attached-note-button').click()
      await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
      await mainWindow.keyboard.insertText('Note text')

      for (const selector of [BODY, NOTE]) {
        await setMonacoSelections(mainWindow, selector, [{
          selectionStartLineNumber: 1, selectionStartColumn: 6,
          positionLineNumber: 1, positionColumn: 2
        }])
        const readSelection = () => mainWindow.locator(selector).evaluate((section) =>
          window.__cthulhuMonacoEditors!.find((entry) => section.contains(entry.container))!.editor.getSelections())
        const selection = await readSelection()
        const section = mainWindow.locator(selector)
        const size = await section.boundingBox()
        if (!size) throw new Error('Editor section is not visible')
        // Each edge is inside the padding, outside Monaco's own click handling.
        for (const position of [
          { x: size.width / 2, y: 2 },
          { x: size.width / 2, y: size.height - 2 },
          { x: 2, y: size.height / 2 },
          { x: size.width - 2, y: size.height / 2 }
        ]) {
          await owner.getByTestId('prompt-title').focus()
          await expect.poll(() => isMonacoEditorFocused(mainWindow, selector)).toBe(false)
          await section.click({ position })
          await expect.poll(() => isMonacoEditorFocused(mainWindow, selector)).toBe(true)
          expect(await readSelection()).toEqual(selection)
        }
      }
    })

    test(`${kind} adds, edits, hides, restores, and deletes independently of its owner`, async ({ testSetup, electronApp }) => {
      /** Both owners start without notes or saved visibility. */
      const { mainWindow, testHelpers, openCollection, active } = await startNotes(testSetup, kind)
      /** Owner-scoped locators keep toolbar and header assertions unambiguous. */
      const owner = mainWindow.locator(OWNER)
      await expect(owner.getByTestId('attached-note-options')).toBeDisabled()
      await expect(owner.getByTestId('attached-note-header')).toHaveCount(0)
      /** Every creation path reveals the note and persists that choice atomically. */
      const neighborId = await mainWindow.evaluate((kind) => window.playwrightTestControls!.notes.createAttachedNote(kind, 'neighbor'), kind)
      await expect(mainWindow.getByTestId('prompt-editor-neighbor').getByTestId('attached-note-header')).toHaveAttribute('aria-expanded', 'true')
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'attached-note', neighborId)).toEqual({ visible: true })

      await owner.getByTestId('attached-note-button').click()
      await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
      /** A visible blank note offers deletion as the main action instead of the dropdown. */
      await expect(owner.getByTestId('attached-note-button')).toHaveAttribute('aria-label', 'Delete attached note')
      await expect(owner.getByTestId('attached-note-options')).toBeDisabled()
      await expect(owner.getByTestId('attached-note-indicator')).toHaveAttribute('data-edited', 'false')
      /** Creation establishes the owner timestamp; text-only note edits must leave it alone. */
      const ownerBefore = await mainWindow.evaluate((kind) => window.playwrightTestControls!.notes.getOwner(kind, 'owner'), kind)
      /** Real generated identity is stored separately from the owner file. */
      const noteId = ownerBefore!.attachedNoteId!
      await mainWindow.keyboard.insertText('Remember this note\nSecond line')
      await expect(owner.getByTestId('attached-note-button')).toHaveAttribute('aria-label', 'Hide attached note')
      await expect(owner.getByTestId('attached-note-options')).toBeEnabled()
      await expect(owner.getByTestId('attached-note-indicator')).toHaveAttribute('data-edited', 'true')
      await expect(owner.getByTestId('prompt-title-status-indicator')).toHaveAttribute('data-edited', 'false')
      await expect(mainWindow.getByTestId('prompt-tree-status-indicator').first()).toHaveAttribute('data-edited', 'false')
      await expect(owner.getByTestId('attached-note-metadata')).toHaveText('Updated today')
      await expect(owner.getByTestId('attached-note-metadata')).toHaveAttribute('title', /.+/)
      await owner.getByTestId('attached-note-header').click()
      await expect(owner.getByTestId('attached-note-metadata')).toHaveText('Hidden')
      await expect(owner.getByTestId('attached-note-editor')).toHaveCount(0)
      await expect(owner.getByTestId('attached-note-indicator')).toHaveCount(0)
      await owner.getByTestId('attached-note-header').click()
      await waitForMonacoEditor(mainWindow, NOTE)
      await expect(owner.getByTestId('attached-note-header')).toBeFocused()
      await owner.getByTestId('attached-note-button').click()
      await expect(owner.getByTestId('attached-note-editor')).toHaveCount(0)
      await owner.getByTestId('attached-note-button').click()
      await waitForMonacoEditor(mainWindow, NOTE)
      await expect(owner.getByTestId('attached-note-button')).toBeFocused()
      await expect(owner.getByTestId('attached-note-indicator')).toHaveAttribute('data-edited', 'true')
      await mainWindow.evaluate(() => window.playwrightTestControls!.waitForMutations())
      // Waiting for mutations alone does not submit the note's pending autosave debounce.
      // Monaco's Windows text model retains CRLF in the Markdown body.
      await expect.poll(() => readTextFile(electronApp, `${active}/Owner.note.md`)).toContain('Remember this note\r\nSecond line')
      expect(await mainWindow.evaluate((kind) => window.playwrightTestControls!.notes.getOwner(kind, 'owner'), kind)).toEqual(ownerBefore)
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'attached-note', noteId)).toEqual({ visible: true })
      await testHelpers.navigateToHomeScreen()
      await openCollection()
      await expect(owner.getByTestId('attached-note-indicator')).toHaveAttribute('data-edited', 'true')
      await expectCardFits(mainWindow)

      // Leaving the editor and closing the workspace must preserve text and SQLite visibility.
      await focusMonacoEditor(mainWindow, NOTE)
      await mainWindow.keyboard.press('Control+End')
      await mainWindow.keyboard.insertText(' saved on close')
      await testHelpers.navigateToHomeScreen()
      await testHelpers.clearWorkspaceViaUI()
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE)])
      await testHelpers.setupWorkspaceViaUI()
      await openCollection()
      await waitForMonacoEditor(mainWindow, NOTE)
      await expect(owner.getByTestId('attached-note-indicator')).toHaveAttribute('data-edited', 'false')
      expect(await readTextFile(electronApp, `${active}/Owner.note.md`)).toContain('Second line saved on close')
      await owner.getByTestId('attached-note-button').click()
      await testHelpers.navigateToHomeScreen()
      await testHelpers.clearWorkspaceViaUI()
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE)])
      await testHelpers.setupWorkspaceViaUI()
      await openCollection()
      await expect(owner.getByTestId('attached-note-header')).toHaveAttribute('aria-expanded', 'false')

      await owner.getByTestId('attached-note-options').click()
      await mainWindow.getByTestId('attached-note-delete').click()
      await expect(mainWindow.getByTestId('attached-note-confirm-delete')).toBeVisible()
      await mainWindow.keyboard.press('Escape')
      await expect(owner.getByTestId('attached-note-header')).toBeVisible()
      await owner.getByTestId('attached-note-options').click()
      await mainWindow.getByTestId('attached-note-delete').click()
      await mainWindow.getByTestId('attached-note-confirm-delete').click()
      await expect(owner.getByTestId('attached-note-header')).toHaveCount(0)
      await mainWindow.evaluate(() => window.playwrightTestControls!.waitForMutations())
      expect(await checkFileExists(electronApp, `${active}/Owner.note.md`)).toBe(false)
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'attached-note', noteId)).toBeNull()
      await expect(owner.getByTestId('attached-note-options')).toBeDisabled()
      /** The blank note's main action deletes it without confirmation. */
      await owner.getByTestId('attached-note-button').click()
      await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
      await owner.getByTestId('attached-note-button').click()
      await expect(owner.getByTestId('attached-note-header')).toHaveCount(0)
      await expect(mainWindow.getByTestId('attached-note-confirm-delete')).toHaveCount(0)
      await expect(owner.getByTestId('attached-note-options')).toBeDisabled()
      await mainWindow.evaluate(() => window.playwrightTestControls!.waitForMutations())
      expect(await checkFileExists(electronApp, `${active}/Owner.note.md`)).toBe(false)
    })

    test(`${kind} shares visual lines and keeps wrapped notes within the budget across resize and navigation`, async ({ testSetup, electronApp }) => {
      /** Forty physical lines force the main editor to use every available line. */
      const { mainWindow, testHelpers, openCollection } = await startNotes(testSetup, kind, Array(40).fill('Prompt line').join('\n'))
      await mainWindow.locator(OWNER).getByTestId('attached-note-button').click()
      await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
      for (let lines = 1; lines <= 12; lines += 1) {
        if (lines > 1) await mainWindow.keyboard.press('Enter')
        await expect.poll(async () => {
          /** Real viewport differences detect one-line allocation errors. */
          const { body, note } = await readLineBudget(mainWindow)
          return Math.max(Math.abs(note.height - Math.min(lines, 10) * note.lineHeight), Math.abs(body.height - (35 - Math.min(lines, 10)) * body.lineHeight))
        }).toBeLessThanOrEqual(1)
      }
      await expectCardFits(mainWindow)
      await mainWindow.keyboard.press('Control+A')
      await mainWindow.keyboard.insertText('Wrapped note text '.repeat(30))
      await electronApp.evaluate(({ BrowserWindow }) => {
        /** A narrow Windows viewport forces additional soft wraps. */
        const window = BrowserWindow.getAllWindows()[0]!
        window.setSize(900, window.getBounds().height)
      })
      await waitForMonacoEditor(mainWindow, NOTE)
      await expect.poll(async () => {
        /** A single physical line must consume multiple visual lines. */
        const { note } = await readLineBudget(mainWindow)
        return note.height / note.lineHeight
      }).toBeGreaterThan(1)
      await expect.poll(async () => {
        /** Wrapped content is capped at ten lines and shares the same thirty-five-line total. */
        const { body, note } = await readLineBudget(mainWindow)
        return Math.max(Math.abs(body.height + note.height - 35 * body.lineHeight), Math.abs(note.height - Math.min(note.contentHeight, 10 * note.lineHeight)))
      }).toBeLessThanOrEqual(1)
      await testHelpers.navigateToHomeScreen()
      await openCollection()
      await waitForMonacoEditor(mainWindow, NOTE)
      await expectCardFits(mainWindow)
      await mainWindow.locator(OWNER).getByTestId('attached-note-header').click()
      await expect.poll(() => mainWindow.locator(`${BODY} .monaco-editor:has(.view-lines)`).evaluate((editor) => {
        /** Hiding the note returns all thirty-five lines to the main viewport. */
        const lineHeight = editor.querySelector('.view-line')!.getBoundingClientRect().height
        return Math.abs(editor.getBoundingClientRect().height - 35 * lineHeight)
      })).toBeLessThanOrEqual(1)
      await expectCardFits(mainWindow)
    })
  }

  test('validates both line limits, persists valid settings, and gives the shared maximum priority over the prompt minimum', async ({ testSetup }) => {
    /** Short main text exposes the minimum-height conflict once the note consumes five lines. */
    const { mainWindow, testHelpers, openCollection } = await startNotes(testSetup, 'prompt')
    await testHelpers.navigateToSettingsScreen()
    /** Both fields remain editable while conflicting values are rejected. */
    const noteMax = mainWindow.getByTestId('note-max-lines-input')
    /** Existing maximum now supplies the combined line budget. */
    const totalMax = mainWindow.getByTestId('max-lines-input')
    await expect(noteMax).toHaveValue('10')
    for (const value of ['0', '21']) {
      await noteMax.fill(value)
      await expect(mainWindow.getByTestId('note-max-lines-error')).toContainText('between 1 and 20')
    }
    await noteMax.fill('20')
    await totalMax.fill('24')
    await expect(noteMax).toHaveAttribute('aria-invalid', 'true')
    await expect(totalMax).toHaveAttribute('aria-invalid', 'true')
    await totalMax.blur()
    expect(await readSettings(mainWindow)).toMatchObject({ promptEditorMaxLines: 35 })
    await noteMax.fill('5')
    await totalMax.fill('10')
    await mainWindow.getByTestId('min-lines-input').fill('10')
    await testHelpers.navigateToHomeScreen()
    await expect.poll(() => readSettings(mainWindow)).toMatchObject({ attachedNoteMaxLines: 5, promptEditorMaxLines: 10, promptEditorMinLines: 10 })
    await openCollection()
    await mainWindow.locator(OWNER).getByTestId('attached-note-button').click()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
    await mainWindow.keyboard.insertText(Array(8).fill('Note line').join('\n'))
    await expect.poll(async () => {
      /** The main minimum of ten must yield to the five remaining shared lines. */
      const { body, note } = await readLineBudget(mainWindow)
      return Math.max(Math.abs(body.height - 5 * body.lineHeight), Math.abs(note.height - 5 * note.lineHeight))
    }).toBeLessThanOrEqual(1)
    await expectCardFits(mainWindow)
    await testHelpers.navigateToSettingsScreen()
    await expect(noteMax).toHaveValue('5')
    await noteMax.fill('1')
    await testHelpers.navigateToHomeScreen()
    await expect.poll(() => readSettings(mainWindow)).toMatchObject({ attachedNoteMaxLines: 1 })
    await openCollection()
    await waitForMonacoEditor(mainWindow, NOTE)
    await expect.poll(async () => {
      /** The valid minimum of one note line leaves nine main-editor lines. */
      const { body, note } = await readLineBudget(mainWindow)
      return Math.max(Math.abs(body.height - 9 * body.lineHeight), Math.abs(note.height - note.lineHeight))
    }).toBeLessThanOrEqual(1)
    await expectCardFits(mainWindow)
  })
})
