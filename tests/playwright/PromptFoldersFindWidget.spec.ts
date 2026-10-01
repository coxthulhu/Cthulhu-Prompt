import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import {
  focusMonacoEditor,
  isMonacoEditorFocused,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { getPromptEditorIds } from '../helpers/PromptFolderHelpers'
import {
  VIRTUAL_FIND_FIRST_PROMPT_ID,
  VIRTUAL_FIND_LAST_PROMPT_ID,
  VIRTUAL_FIND_MARKER
} from '../helpers/VirtualFindTestConstants'

const { test, describe, expect } = createPlaywrightTestSuite()

const FIND_INPUT = '[data-testid="prompt-find-input"]'
const FIND_BUTTON = '[data-testid="prompt-folder-find-button"]'
const FIND_CLOSE = '[data-testid="prompt-find-close"]'
const FIND_MATCHES_LABEL = '[data-testid="prompt-find-widget"] .prompt-find-widget__matches'
const LOOP_REGRESSION_QUERY = 'cthulhu-loop-regression-marker-9x4k'
const LOOP_MATCH_PROMPT_IDS = Array.from(
  { length: 19 },
  (_, index) => `loop-test-${2 + index * 60}`
)
const RAPID_LOOP_QUERY = 'cthulhu-rapid-loop-marker-fish'
const TYPING_ANCHOR_QUERY = 'hello'
const LIVE_COUNT_QUERY = 'cthulhu-live-find-count-marker'
const LIVE_POSITION_QUERY = 'cthulhu-live-find-position-marker'
/** Unique incremental query used to repeat sidebar reveals for one prompt-tree row. */
const SMALL_SIDEBAR_QUERY = 'qzxv-sidebar-center-marker'
/** Prompt kept away from both tree boundaries during the small-viewport regression. */
const SMALL_SIDEBAR_TARGET_PROMPT_ID = 'small-sidebar-prompt-30'
/** Wrapped-body sizes exercise exact title placement independently of the complete row height. */
const CENTER_TRACKING_CASES = [
  {
    key: 'fits',
    testName: 'centers a measured title after its fitting body hydrates',
    query: 'cthulhu-centered-row-fits-marker',
    promptText: 'W'.repeat(1500),
  },
  {
    key: 'padding-overflow',
    testName: 'centers a measured title after its nearly viewport-height body hydrates',
    query: 'cthulhu-centered-row-padding-overflow-marker',
    promptText: 'W'.repeat(2600),
  },
  {
    key: 'row-overflow',
    testName: 'centers a measured title after its taller-than-viewport body hydrates',
    query: 'cthulhu-centered-row-overflow-marker',
    promptText: 'W'.repeat(10000),
  }
] as const

type CenterTrackingCase = (typeof CENTER_TRACKING_CASES)[number]

const getMonacoSelectedText = async (
  mainWindow: any,
  editorSelector: string
): Promise<string | null> => {
  return await mainWindow.evaluate((selector) => {
    const monacoNode = document.querySelector(`${selector} .monaco-editor`)
    if (!monacoNode) return null

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getModel: () => {
              getValueInRange: (range: any) => string
            } | null
            getSelection: () => any
          }
        }>
      }
    ).__cthulhuMonacoEditors

    if (!registry?.length) return null

    const entry = registry.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })
    if (!entry) return null

    const model = entry.editor.getModel()
    const selection = entry.editor.getSelection()
    if (!model || !selection) return null

    return model.getValueInRange(selection)
  }, editorSelector)
}

const getMonacoWordAtCursor = async (
  mainWindow: any,
  editorSelector: string
): Promise<string | null> => {
  return await mainWindow.evaluate((selector) => {
    const monacoNode = document.querySelector(`${selector} .monaco-editor`)
    if (!monacoNode) return null

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getConfiguredWordAtPosition: (position: any) => { word: string } | null
            getPosition: () => any
          }
        }>
      }
    ).__cthulhuMonacoEditors

    if (!registry?.length) return null

    const entry = registry.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })
    if (!entry) return null

    const position = entry.editor.getPosition()
    if (!position) return null

    return entry.editor.getConfiguredWordAtPosition(position)?.word ?? null
  }, editorSelector)
}

const getFindMatchesLabelText = async (mainWindow: any): Promise<string> => {
  return await mainWindow.evaluate((selector) => {
    return document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? ''
  }, FIND_MATCHES_LABEL)
}

const getCurrentFindMatchRowTestId = async (mainWindow: any): Promise<string | null> => {
  return await mainWindow.evaluate(() => {
    const currentFindMatch = document.querySelector('.monaco-editor .currentFindMatch')
    if (!currentFindMatch) return null
    const row = currentFindMatch.closest<HTMLElement>('[data-testid][data-virtual-window-row]')
    return row?.getAttribute('data-testid') ?? null
  })
}

const getMonacoSelectionState = async (
  mainWindow: any,
  editorSelector: string
): Promise<{
  selectedText: string
  startLineNumber: number
  startColumn: number
  selectionStartColumn: number
  positionColumn: number
} | null> => {
  return await mainWindow.evaluate((selector) => {
    const monacoNode = document.querySelector(`${selector} .monaco-editor`)
    if (!monacoNode) return null

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getModel: () => {
              getValueInRange: (range: any) => string
            } | null
            getSelection: () => any
          }
        }>
      }
    ).__cthulhuMonacoEditors

    if (!registry?.length) return null
    const entry = registry.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })
    if (!entry) return null

    const model = entry.editor.getModel()
    const selection = entry.editor.getSelection()
    if (!model || !selection) return null

    return {
      selectedText: model.getValueInRange(selection),
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      selectionStartColumn: selection.selectionStartColumn,
      positionColumn: selection.positionColumn
    }
  }, editorSelector)
}

/** Isolates search parity cases in either a native title or a Monaco body. */
const buildFindParityWorkspace = (
  workspacePath: string,
  section: 'title' | 'body',
  text: string
): Record<string, string | null> => createWorkspaceWithFolders(workspacePath, [{
  folderName: 'Find Parity',
  displayName: 'Find Parity',
  promptFolderId: 'find-parity-folder',
  prompts: [{
    id: 'find-parity-prompt',
    title: section === 'title' ? text : 'Search Target',
    promptText: section === 'body' ? text : ''
  }]
}])

const buildVirtualFindLoopWorkspace = (workspacePath: string): Record<string, string | null> => {
  const promptIdsWithMatches = new Set(LOOP_MATCH_PROMPT_IDS)
  const basePromptBody = '\n'.repeat(80)
  const prompts = Array.from({ length: 1200 }, (_, index) => {
    const promptId = `loop-test-${index + 1}`
    return {
      id: promptId,
      title: `Loop Prompt ${index + 1}`,
      promptText: promptIdsWithMatches.has(promptId)
        ? `${basePromptBody}\n${LOOP_REGRESSION_QUERY}`
        : basePromptBody
    }
  })

  const filesystem = createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Long',
      displayName: 'Long',
      prompts,
      promptFolderId: 'loop-folder'
    }
  ])

  const folderDescriptionPath = `${workspacePath}/Prompts/Long/_FolderInfo/Description.md`
  filesystem[folderDescriptionPath] = `Find marker in folder description: ${LOOP_REGRESSION_QUERY}`

  return filesystem
}

const buildVirtualFindRapidWorkspace = (workspacePath: string): Record<string, string | null> => {
  const promptMatchCounts = new Map<string, number>([
    ['rapid-loop-2', 2],
    ['rapid-loop-300', 7],
    ['rapid-loop-700', 1],
    ['rapid-loop-1100', 1]
  ])
  const basePromptBody = '\n'.repeat(80)
  const prompts = Array.from({ length: 1200 }, (_, index) => {
    const promptId = `rapid-loop-${index + 1}`
    const matchCount = promptMatchCounts.get(promptId) ?? 0
    const matchLines =
      matchCount <= 0
        ? ''
        : `\n${Array.from({ length: matchCount }, () => RAPID_LOOP_QUERY).join('\n')}`
    return {
      id: promptId,
      title: `Rapid Loop Prompt ${index + 1}`,
      promptText: `${basePromptBody}${matchLines}`
    }
  })

  const filesystem = createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Long',
      displayName: 'Long',
      prompts,
      promptFolderId: 'rapid-loop-folder'
    }
  ])

  const folderDescriptionPath = `${workspacePath}/Prompts/Long/_FolderInfo/Description.md`
  filesystem[folderDescriptionPath] = `Rapid loop marker in folder description: ${RAPID_LOOP_QUERY}`

  return filesystem
}

/** Builds a virtualized folder with one title match on a configured height-changing row. */
const buildCenteredRowHydrationWorkspace = (
  workspacePath: string,
  trackingCase: CenterTrackingCase
): Record<string, string | null> => {
  /** Prompts surrounding the target so centered placement is not document-boundary clamped. */
  const prompts = Array.from({ length: 60 }, (_, index) => {
    /** Stable prompt identity used by the virtual row and find result. */
    const promptId = `center-tracking-${trackingCase.key}-${index + 1}`
    const targetPromptId = `center-tracking-${trackingCase.key}-30`
    return {
      id: promptId,
      title:
        promptId === targetPromptId
          ? `Tracked ${trackingCase.query}`
          : `Center Tracking ${trackingCase.key} Prompt ${index + 1}`,
      promptText: promptId === targetPromptId ? trackingCase.promptText : 'one line'
    }
  })

  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: `Center Tracking ${trackingCase.key}`,
      displayName: `Center Tracking ${trackingCase.key}`,
      promptFolderId: `center-tracking-${trackingCase.key}-folder`,
      prompts
    }
  ])
}

const buildTypingAnchorWorkspace = (workspacePath: string): Record<string, string | null> => {
  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Anchor',
      displayName: 'Anchor',
      promptFolderId: 'typing-anchor-folder',
      prompts: [
        {
          id: 'typing-anchor-1',
          title: 'Typing Anchor Prompt',
          promptText: `hello first marker
zzzz marker line
hello second marker
hello third marker`
        }
      ]
    }
  ])
}

/** Builds a long prompt tree with one incrementally searchable title near its middle. */
const buildSmallSidebarFindWorkspace = (
  workspacePath: string
): Record<string, string | null> => {
  /** Prompts surrounding the target prevent virtual-scroll boundary clamping. */
  const prompts = Array.from({ length: 60 }, (_, index) => {
    /** Stable one-based identity for the generated prompt row. */
    const promptId = `small-sidebar-prompt-${index + 1}`
    return {
      id: promptId,
      title:
        promptId === SMALL_SIDEBAR_TARGET_PROMPT_ID
          ? `Target ${SMALL_SIDEBAR_QUERY}`
          : `Ordinary Entry ${index + 1}`,
      promptText: 'Plain body text.'
    }
  })

  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Small Sidebar',
      displayName: 'Small Sidebar',
      promptFolderId: 'small-sidebar-folder',
      prompts
    }
  ])
}

/** Builds separated matches with blank-line anchors for persisted-query reopen coverage. */
const buildPersistedQueryReopenWorkspace = (
  workspacePath: string
): Record<string, string | null> => {
  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Reopen',
      displayName: 'Reopen',
      promptFolderId: 'persisted-query-reopen-folder',
      prompts: [
        {
          id: 'persisted-query-reopen-prompt',
          title: 'Persisted Query Reopen Prompt',
          promptText: `hello first marker

hello second marker

hello third marker`
        }
      ]
    }
  ])
}

const buildConfiguredWordWorkspace = (workspacePath: string): Record<string, string | null> => {
  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Boundaries',
      displayName: 'Boundaries',
      promptFolderId: 'configured-word-folder',
      prompts: [
        {
          id: 'configured-word-1',
          title: 'Configured Word Prompt',
          promptText: `1.23 marker`
        }
      ]
    }
  ])
}

describe('Prompt folder find dialog', () => {
  // Exercise both selection producers through actual keyboard selection and search input.
  for (const section of ['body', 'title'] as const) {
    /** Backward selections must search from their active caret when the query changes. */
    test(`searches query edits from a backward ${section} selection caret`, async ({ testSetup }) => {
      /** Repeated suffix distinguishes the selection's start from its end. */
      const workspacePath = `/ws/find-backward-query-${section}`
      await testSetup.setupFilesystem(buildFindParityWorkspace(workspacePath, section, 'alpha beta / beta'))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Application and navigation helpers for the isolated selection fixture. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders('Find Parity')
      /** Row whose title or body supplies the search anchor. */
      const editorSelector = promptEditorSelector('find-parity-prompt')
      /** Native input used for title selection and focus assertions. */
      const title = mainWindow.locator(`${editorSelector} ${PROMPT_TITLE_SELECTOR}`)
      if (section === 'body') await focusMonacoEditor(mainWindow, editorSelector)
      else await title.focus()
      await mainWindow.keyboard.press('Control+Home')
      // Move to the end of the first phrase, then select it back to the beginning.
      for (let step = 0; step < 10; step += 1) await mainWindow.keyboard.press('ArrowRight')
      await mainWindow.keyboard.press('Shift+Home')
      if (section === 'body') {
        await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
          selectedText: 'alpha beta', selectionStartColumn: 11, positionColumn: 1
        })
      } else {
        await expect.poll(() => title.evaluate((input: HTMLInputElement) => ({
          start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection
        }))).toEqual({ start: 0, end: 10, direction: 'backward' })
      }
      await mainWindow.keyboard.press('Control+F')
      /** Changing the seeded phrase must select its first suffix, not the later occurrence. */
      const findInput = mainWindow.locator(FIND_INPUT)
      await expect(findInput).toHaveValue('alpha beta')
      await findInput.fill('beta')
      await expect(mainWindow.locator(FIND_MATCHES_LABEL)).toHaveText('1 of 2')
      await expect(findInput).toBeFocused()
      if (section === 'body') {
        await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
          selectedText: 'beta', startColumn: 7
        })
      } else {
        await expect(mainWindow.locator(`${editorSelector} [data-testid="prompt-title-find-match"]`).first())
          .toHaveAttribute('data-current', 'true')
      }
      await findInput.press('Escape')
      if (section === 'body') {
        await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
        await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
          selectedText: 'beta', startColumn: 7
        })
      } else {
        await expect(title).toBeFocused()
        await expect.poll(() => title.evaluate((input: HTMLInputElement) => ({
          start: input.selectionStart, end: input.selectionEnd
        }))).toEqual({ start: 6, end: 10 })
      }
    })

    /** Exact query changes must navigate even when case-insensitive results are unchanged. */
    test(`navigates case-only query edits from the ${section} caret`, async ({ testSetup }) => {
      /** Two occurrences distinguish passive opening from active query-edit navigation. */
      const workspacePath = `/ws/find-case-only-query-${section}`
      await testSetup.setupFilesystem(buildFindParityWorkspace(workspacePath, section, 'foo foo'))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Application and navigation helpers for case-only edits. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders('Find Parity')
      /** Row containing the repeated query. */
      const editorSelector = promptEditorSelector('find-parity-prompt')
      /** Native title target for the same keyboard flow as Monaco. */
      const title = mainWindow.locator(`${editorSelector} ${PROMPT_TITLE_SELECTOR}`)
      /** Find input is remounted for each caret case. */
      const findInput = mainWindow.locator(FIND_INPUT)
      // Cover passive opening from a collapsed caret and from a forward selection.
      for (const selectWord of [false, true]) {
        if (section === 'body') await focusMonacoEditor(mainWindow, editorSelector)
        else await title.focus()
        await mainWindow.keyboard.press('Control+Home')
        if (selectWord) {
          await mainWindow.keyboard.press('Shift+ArrowRight')
          await mainWindow.keyboard.press('Shift+ArrowRight')
          await mainWindow.keyboard.press('Shift+ArrowRight')
        }
        await mainWindow.keyboard.press('Control+F')
        await expect(findInput).toHaveValue('foo')
        await findInput.fill('FOO')
        await expect(mainWindow.locator(FIND_MATCHES_LABEL)).toHaveText(selectWord ? '2 of 2' : '1 of 2')
        await expect(findInput).toBeFocused()
        if (section === 'body') {
          await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
            selectedText: 'foo', startColumn: selectWord ? 5 : 1
          })
        } else {
          await expect(mainWindow.locator(`${editorSelector} [data-testid="prompt-title-find-match"]`)
            .nth(selectWord ? 1 : 0)).toHaveAttribute('data-current', 'true')
        }
        await findInput.press('Escape')
        if (section === 'body') {
          await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
        } else {
          await expect(title).toBeFocused()
          await expect.poll(() => title.evaluate((input: HTMLInputElement) => input.selectionStart))
            .toBe(selectWord ? 4 : 0)
        }
      }
    })

    // Unicode cases exercise both offset expansion and Monaco's case-fold equivalence.
    for (const unicodeCase of [
      { name: 'dotted-I', text: 'İ foo foo', query: 'foo', caret: 5, start: 2, end: 5, selected: 'foo', nextStart: 6, nextEnd: 9, nextSelected: 'foo' },
      { name: 'sigma', text: 'ς σ', query: 'σ', caret: 1, start: 0, end: 1, selected: 'ς', nextStart: 2, nextEnd: 3, nextSelected: 'σ' }
    ]) {
      /** Navigation and close must use the same original-text ranges as the highlights. */
      test(`preserves ${unicodeCase.name} match ranges in the ${section}`, async ({ testSetup }) => {
        /** Unicode fixture contains two matches and a cursor at the first match's end. */
        const workspacePath = `/ws/find-unicode-${unicodeCase.name}-${section}`
        await testSetup.setupFilesystem(buildFindParityWorkspace(workspacePath, section, unicodeCase.text))
        await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
        /** Application and navigation helpers for Unicode matching. */
        const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
        await testHelpers.setupWorkspaceViaUI()
        await testHelpers.navigateToPromptFolders('Find Parity')
        /** Prompt whose offsets must remain in the original text. */
        const editorSelector = promptEditorSelector('find-parity-prompt')
        /** Native title target for restored-selection assertions. */
        const title = mainWindow.locator(`${editorSelector} ${PROMPT_TITLE_SELECTOR}`)
        await mainWindow.keyboard.press('Control+F')
        /** Establish the query before manually anchoring navigation in the edited section. */
        const findInput = mainWindow.locator(FIND_INPUT)
        await findInput.fill(unicodeCase.query)
        await expect(mainWindow.locator(FIND_MATCHES_LABEL)).toHaveText('1 of 2')
        if (section === 'body') await focusMonacoEditor(mainWindow, editorSelector)
        else await title.focus()
        await mainWindow.keyboard.press('Control+Home')
        // Anchor exactly at the first match's end without changing the established query.
        for (let step = 0; step < unicodeCase.caret; step += 1) await mainWindow.keyboard.press('ArrowRight')
        await findInput.focus()
        await findInput.press('Shift+Enter')
        await expect(mainWindow.locator(FIND_MATCHES_LABEL)).toHaveText('1 of 2')
        if (section === 'body') {
          await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
            selectedText: unicodeCase.selected, startColumn: unicodeCase.start + 1
          })
        } else {
          await expect(mainWindow.locator(`${editorSelector} [data-testid="prompt-title-find-match"]`).first())
            .toHaveAttribute('data-current', 'true')
        }
        await findInput.press('Escape')
        if (section === 'body') {
          await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
          await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
            selectedText: unicodeCase.selected, startColumn: unicodeCase.start + 1
          })
        } else {
          await expect(title).toBeFocused()
          await expect.poll(() => title.evaluate((input: HTMLInputElement) => ({
            start: input.selectionStart, end: input.selectionEnd
          }))).toEqual({ start: unicodeCase.start, end: unicodeCase.end })
        }

        // Reopening seeds from the actual selected text; forward navigation must share Monaco's ranges too.
        await mainWindow.keyboard.press('Control+F')
        await expect(findInput).toHaveValue(unicodeCase.selected)
        await findInput.press('Enter')
        await expect(mainWindow.locator(FIND_MATCHES_LABEL)).toHaveText('2 of 2')
        await findInput.press('Escape')
        if (section === 'body') {
          await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
          await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
            selectedText: unicodeCase.nextSelected, startColumn: unicodeCase.nextStart + 1
          })
        } else {
          await expect(title).toBeFocused()
          await expect.poll(() => title.evaluate((input: HTMLInputElement) => ({
            start: input.selectionStart, end: input.selectionEnd
          }))).toEqual({ start: unicodeCase.nextStart, end: unicodeCase.nextEnd })
        }
      })
    }
  }

  // Guard the visible match colors as the active result moves between occurrences.
  test('uses an amber fill without a border for the current match while navigating', async ({
    testSetup
  }) => {
    /** Isolated prompt with three matches for forward and backward navigation. */
    const workspacePath = '/ws/find-match-colors'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Window and helpers for opening the search fixture. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Anchor')
    /** Editor containing the current and remaining matches. */
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.press('Control+F')
    /** Find input seeded from the word at the cursor. */
    const findInput = mainWindow.locator(FIND_INPUT)
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await findInput.press('Enter')

    /** Check rendered colors and selection together so navigation cannot leave stale styling. */
    const expectMatchAppearance = async (lineNumber: number) => {
      await expect(findInput).toBeFocused()
      await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(false)
      await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
        selectedText: TYPING_ANCHOR_QUERY,
        startLineNumber: lineNumber
      })
      /** Monaco's theme supplies the amber fill and leaves the current match borderless. */
      const currentMatch = mainWindow.locator(`${editorSelector} .currentFindMatch`)
      await expect(currentMatch).toHaveCount(1)
      await expect(currentMatch).toHaveCSS('background-color', 'rgba(240, 177, 53, 0.3)')
      await expect(currentMatch).toHaveCSS('border-top-style', 'none')
      /** Other occurrences retain the Dark 2026 blue highlight. */
      const otherMatches = mainWindow.locator(`${editorSelector} .findMatch`)
      await expect(otherMatches).toHaveCount(2)
      await expect(otherMatches.first()).toHaveCSS('background-color', 'rgba(39, 103, 130, 0.5)')
    }

    await expectMatchAppearance(1)
    await findInput.press('Enter')
    await expectMatchAppearance(3)
    await findInput.press('Shift+Enter')
    await expectMatchAppearance(1)
  })

  // Keep title decorations, editor decorations, and focus synchronized across find navigation.
  test('highlights title occurrences while find retains focus and clears stale matches', async ({ testSetup }) => {
    /** Fixture includes two title matches and a body match to exercise section transitions. */
    const workspacePath = '/ws/find-title-colors'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, [{
      folderName: 'Title Highlights',
      displayName: 'Title Highlights',
      promptFolderId: 'title-highlights-folder',
      prompts: [{ id: 'title-highlights-prompt', title: 'needle and NEEDLE', promptText: 'needle body' }]
    }]))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** App window and navigation helpers for the title fixture. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Title Highlights')
    /** Prompt containing both title and Monaco matches. */
    const row = mainWindow.locator(promptEditorSelector('title-highlights-prompt'))
    /** Native title input must stay unfocused during find navigation. */
    const title = row.locator(PROMPT_TITLE_SELECTOR)
    /** All title match backgrounds, including the current occurrence. */
    const matches = row.locator('[data-testid="prompt-title-find-match"]')
    /** Find input controls navigation without transferring focus to the title. */
    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.locator(FIND_BUTTON).click()
    await findInput.fill('needle')
    await expect(mainWindow.locator(FIND_MATCHES_LABEL)).toHaveText('1 of 3')
    await expect(matches).toHaveCount(2)
    await expect(matches.nth(0)).toHaveAttribute('data-current', 'true')
    await expect(matches.nth(0)).toHaveCSS('background-color', 'oklch(0.8 0.15 80 / 0.3)')
    await expect(matches.nth(0)).toHaveCSS('border-top-style', 'none')
    await expect(matches.nth(1)).toHaveCSS('background-color', 'oklch(0.485004 0.0772893 229.387 / 0.5)')
    await expect(findInput).toBeFocused()
    await expect(title).not.toBeFocused()

    await findInput.press('Enter')
    await expect(matches.nth(1)).toHaveAttribute('data-current', 'true')
    await expect(matches.nth(0)).toHaveAttribute('data-current', 'false')
    await findInput.press('Enter')
    await expect(row.locator('[data-testid="prompt-title-find-match"][data-current="true"]')).toHaveCount(0)
    await expect(row.locator('.currentFindMatch')).toHaveCount(1)
    await expect(findInput).toBeFocused()
    await findInput.press('Shift+Enter')
    await expect(matches.nth(1)).toHaveAttribute('data-current', 'true')
    await expect(row.locator('.currentFindMatch')).toHaveCount(0)
    await expect(findInput).toBeFocused()

    await findInput.fill('missing')
    await expect(matches).toHaveCount(0)
    await findInput.fill('needle')
    await expect(matches).toHaveCount(2)
    await findInput.fill('')
    await expect(matches).toHaveCount(0)
    await findInput.fill('needle')
    await expect(matches).toHaveCount(2)
    await findInput.press('Escape')
    await expect(matches).toHaveCount(0)
    await expect(title).toBeFocused()

    // Opening from a title cursor remains passive until navigation.
    await title.press('Control+Home')
    await title.press('Control+F')
    await expect(findInput).toHaveValue('needle')
    await expect(matches).toHaveCount(2)
    await expect(row.locator('[data-testid="prompt-title-find-match"][data-current="true"]')).toHaveCount(0)
    await expect(findInput).toBeFocused()
    await findInput.press('Enter')
    await expect(row.locator('[data-testid="prompt-title-find-match"][data-current="true"]')).toHaveCount(1)

    // Editing while find stays open must recalculate decorations without taking focus back.
    await title.fill('needle changed')
    await expect(matches).toHaveCount(1)
    await expect(matches).toHaveText('needle')
    await expect(title).toBeFocused()
  })

  // Reproduce clipped matches and stale highlight offsets in an overflowing native title input.
  test('reveals long title matches horizontally without focusing or selecting the title', async ({ testSetup }) => {
    /** Wide spacing forces the second occurrence outside the native input viewport. */
    const titleText = `needle ${'wide spacing '.repeat(40)}NEEDLE`
    /** Workspace dedicated to horizontal title navigation. */
    const workspacePath = '/ws/find-title-overflow'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, [{
      folderName: 'Long Titles',
      displayName: 'Long Titles',
      promptFolderId: 'long-titles-folder',
      prompts: [{ id: 'long-title-prompt', title: titleText, promptText: 'No body matches.' }]
    }]))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Window and helpers used to open the long-title fixture. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Long Titles')
    /** Native title and its highlight mirror share a viewport. */
    const row = mainWindow.locator(promptEditorSelector('long-title-prompt'))
    /** Input selection must not move as find changes only its scroll offset. */
    const title = row.locator(PROMPT_TITLE_SELECTOR)
    await title.click()
    await title.press('Control+Home')
    /** Initial cursor selection to compare after forward and backward navigation. */
    const selection = await title.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])
    await title.press('Control+F')
    /** Find query is seeded from the first word, without initially revealing a match. */
    const findInput = mainWindow.locator(FIND_INPUT)
    await expect(findInput).toHaveValue('needle')
    await findInput.press('Enter')
    /** Current title decoration to check against the native input's visible bounds. */
    const current = row.locator('[data-testid="prompt-title-find-match"][data-current="true"]')
    await expect(current).toHaveText('needle')
    await findInput.press('Enter')
    await expect(current).toHaveText('NEEDLE')
    await expect.poll(() => title.evaluate((input) => input.scrollLeft)).toBeGreaterThan(0)

    /** Confirm background alignment and clipping using a strict two-pixel geometry tolerance. */
    const expectVisibleAlignedMatch = async () => {
      await expect.poll(() => row.evaluate((element) => {
        /** Native title field, its invisible mirror, and the active background rectangle. */
        const input = element.querySelector<HTMLInputElement>('[data-testid="prompt-title"]')!
        const mirror = element.querySelector<HTMLElement>('.prompt-editor-title-mirror')!
        const match = element.querySelector<HTMLElement>('[data-testid="prompt-title-find-match"][data-current="true"]')!
        /** Visible bounds of the input and active match. */
        const inputRect = input.getBoundingClientRect()
        const matchRect = match.getBoundingClientRect()
        return Math.max(
          inputRect.left - matchRect.left,
          matchRect.right - inputRect.right,
          Math.abs(mirror.getBoundingClientRect().left - (inputRect.left - input.scrollLeft)),
          Math.abs(matchRect.top - inputRect.top)
        )
      })).toBeLessThanOrEqual(2)
      await expect(findInput).toBeFocused()
      expect(await title.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual(selection)
      expect(await row.locator('.prompt-editor-title-mirror').textContent()).toBe(titleText)
      expect(await row.evaluate((element) => {
        /** Matching font metrics keep the mirror's substring offsets aligned with the native text. */
        const inputStyle = getComputedStyle(element.querySelector('[data-testid="prompt-title"]')!)
        const mirrorStyle = getComputedStyle(element.querySelector('.prompt-editor-title-mirror')!)
        return (['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const).every(
          (property) => inputStyle[property] === mirrorStyle[property]
        )
      })).toBe(true)
    }
    await expectVisibleAlignedMatch()
    await findInput.press('Shift+Enter')
    await expect(current).toHaveText('needle')
    await expect.poll(() => title.evaluate((input) => input.scrollLeft)).toBeLessThanOrEqual(1)
    await expectVisibleAlignedMatch()

    // Native editing scroll must move the mirror too, even with no active find result.
    await title.click()
    await title.press('End')
    await expect.poll(() => title.evaluate((input) => input.scrollLeft)).toBeGreaterThan(0)
    await expect.poll(() => title.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]))
      .toEqual([titleText.length, titleText.length])
    await expect.poll(() => row.evaluate((element) => {
      /** Input and mirror offsets after keyboard-driven native scrolling. */
      const input = element.querySelector<HTMLInputElement>('[data-testid="prompt-title"]')!
      const mirror = element.querySelector<HTMLElement>('.prompt-editor-title-mirror')!
      return Math.abs(mirror.getBoundingClientRect().left - (input.getBoundingClientRect().left - input.scrollLeft))
    })).toBeLessThanOrEqual(1)
    await expect(title).toBeFocused()
  })

  test('opens with Ctrl+F and closes with Escape or the close button', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findClose = mainWindow.locator(FIND_CLOSE)

    // Step 1: open find.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    // Step 2: close with Escape.
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    // Step 3: reopen, then close with the X button.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findClose.click()
    await expect(findInput).toHaveCount(0)
  })

  test('toggles from the title bar find button', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findButton = mainWindow.locator(FIND_BUTTON)
    const findInput = mainWindow.locator(FIND_INPUT)

    await expect(findButton).toBeVisible()
    await expect(findButton).toHaveAttribute('title', 'Find in Folder (Control + F)')
    await expect(findButton).toHaveCSS('border-top-width', '0px')

    await findButton.click()
    await expect(findInput).toBeVisible()
    await expect(findInput).toBeFocused()

    await findButton.click()
    await expect(findInput).toHaveCount(0)
  })

  test('reveals a root prompt match without a root settings row', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })
    await expect(mainWindow.locator('[data-testid^="category-editor-"]')).toHaveCount(0)

    await mainWindow.locator(FIND_BUTTON).click()
    await mainWindow.locator(FIND_INPUT).fill('best practices')

    await expect(mainWindow.locator(promptEditorSelector('dev-1'))).toBeVisible()
  })

  test('updates the match count while editing Monaco content and a prompt title', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-live-counts'
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Live Counts',
          displayName: 'Live Counts',
          promptFolderId: 'find-live-counts-folder',
          prompts: [
            {
              id: 'find-live-counts-prompt',
              title: `Existing ${LIVE_COUNT_QUERY}`,
              promptText: ''
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Live Counts')
    const editorSelector = promptEditorSelector('find-live-counts-prompt')
    const title = mainWindow.locator(`${editorSelector} ${PROMPT_TITLE_SELECTOR}`)
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await mainWindow.keyboard.press('Control+F')
    await mainWindow.locator(FIND_INPUT).fill(LIVE_COUNT_QUERY)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.type(LIVE_COUNT_QUERY)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 2')

    await title.click()
    await title.press('End')
    await title.pressSequentially(` ${LIVE_COUNT_QUERY}`)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')
  })

  test('moves the current position to a matching word typed in a later prompt', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-live-position'
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Live Position',
          displayName: 'Live Position',
          promptFolderId: 'find-live-position-folder',
          prompts: [
            {
              id: 'find-live-position-first',
              title: 'First Prompt',
              promptText: LIVE_POSITION_QUERY
            },
            {
              id: 'find-live-position-second',
              title: 'Second Prompt',
              promptText: 'Later prompt: '
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Live Position')
    const firstEditorSelector = promptEditorSelector('find-live-position-first')
    const secondEditorSelector = promptEditorSelector('find-live-position-second')
    await waitForMonacoEditor(mainWindow, firstEditorSelector)
    await waitForMonacoEditor(mainWindow, secondEditorSelector)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await findInput.fill(LIVE_POSITION_QUERY)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')

    await focusMonacoEditor(mainWindow, secondEditorSelector)
    await mainWindow.keyboard.press('End')
    await mainWindow.keyboard.type(LIVE_POSITION_QUERY)

    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 2')
    await expect(findInput).not.toBeFocused()
    const secondCursorBeforeClose = await getMonacoSelectionState(
      mainWindow,
      secondEditorSelector
    )
    expect(secondCursorBeforeClose).toMatchObject({ selectedText: '' })
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
    await expect
      .poll(() => isMonacoEditorFocused(mainWindow, secondEditorSelector))
      .toBe(true)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, secondEditorSelector))
      .toEqual(secondCursorBeforeClose)

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await focusMonacoEditor(mainWindow, firstEditorSelector)
    const firstCursorBeforeClose = await getMonacoSelectionState(
      mainWindow,
      firstEditorSelector
    )
    await mainWindow.locator(FIND_CLOSE).click()
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, firstEditorSelector)).toBe(true)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, firstEditorSelector))
      .toEqual(firstCursorBeforeClose)
  })

  test('keeps a newly created prompt focused while find is open', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))
    const initialPromptIds = await getPromptEditorIds(mainWindow)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await findInput.fill('best practices')
    await expect.poll(() => getCurrentFindMatchRowTestId(mainWindow)).toBe('prompt-editor-dev-1')

    const addAfterDevTwoSelector = '[data-testid="prompt-divider-add-after-dev-2"]'
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      addAfterDevTwoSelector,
      120
    )
    await mainWindow.locator(addAfterDevTwoSelector).click()

    const getCreatedPromptId = async () =>
      (await getPromptEditorIds(mainWindow)).find(
        (promptId) => !initialPromptIds.includes(promptId)
      )
    await expect.poll(getCreatedPromptId).toBeTruthy()
    const newPromptId = (await getCreatedPromptId())!
    const newEditorSelector = promptEditorSelector(newPromptId)
    await waitForMonacoEditor(mainWindow, newEditorSelector)
    await mainWindow.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )

    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue('best practices')
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')
    await expect(mainWindow.locator(newEditorSelector)).toBeInViewport()
    await expect(
      mainWindow.locator(`[data-testid="prompt-tree-active-prompt-${newPromptId}"]`)
    ).toHaveAttribute('aria-current', 'true')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, newEditorSelector), { timeout: 5000 })
      .toBe(true)
  })

  test('reopens with previous query and selection', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    const longQuery = 'nonmatching-0123456789-abcdefghijklmnopqrstuvwxyz-unique-query'
    const getSelectionInfo = async (page: any) => {
      return await page.locator(FIND_INPUT).evaluate((el: HTMLTextAreaElement) => {
        return {
          start: el.selectionStart,
          end: el.selectionEnd,
          value: el.value
        }
      })
    }

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findPrev = mainWindow.locator('[data-testid="prompt-find-prev"]')
    const findNext = mainWindow.locator('[data-testid="prompt-find-next"]')
    const findClose = mainWindow.locator(FIND_CLOSE)

    // Step 1-3: open find, confirm dialog and disabled buttons.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findPrev).toHaveAttribute('aria-disabled', 'true')
    await expect(findNext).toHaveAttribute('aria-disabled', 'true')

    // Step 4-5: type a long query, then close.
    await findInput.fill(longQuery)
    await findClose.click()
    await expect(findInput).toHaveCount(0)

    // Step 6: reopen, confirm focus + preserved text + full selection.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(longQuery)
    await expect(findInput).toBeFocused()

    await expect
      .poll(async () => getSelectionInfo(mainWindow), { timeout: 2000 })
      .toEqual({ start: 0, end: longQuery.length, value: longQuery })
  })

  test('seeds find input from selected Monaco text on Ctrl+F', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.up('Shift')

    const selectedText = await getMonacoSelectedText(mainWindow, editorSelector)
    expect(selectedText && selectedText.length > 0).toBe(true)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(selectedText!)
  })

  // Fresh Ctrl+F searches adopt the navigated result without losing title close selections.
  for (const section of ['body', 'title'] as const) {
    test(`seeds repeated Ctrl+F from the navigated ${section} result`, async ({ testSetup }) => {
      /** Isolated workspace for the section whose search selection is retained. */
      const workspacePath = `/ws/find-fresh-anchor-${section}`
      await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, [{
        folderName: 'Fresh Anchor',
        displayName: 'Fresh Anchor',
        promptFolderId: 'fresh-anchor-folder',
        prompts: [{
          id: 'fresh-anchor-prompt',
          title: section === 'title' ? 'alpha beta beta beta' : 'Search Target',
          promptText: section === 'body' ? 'alpha beta beta beta' : 'Unrelated text'
        }]
      }]))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Application and navigation helpers for this section's fixture. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders('Fresh Anchor')
      /** Prompt containing the seed and three navigable matches. */
      const editorSelector = promptEditorSelector('fresh-anchor-prompt')
      /** Title input also verifies deferred selection when Find closes. */
      const title = mainWindow.locator(`${editorSelector} ${PROMPT_TITLE_SELECTOR}`)
      if (section === 'body') {
        await waitForMonacoEditor(mainWindow, editorSelector)
        await focusMonacoEditor(mainWindow, editorSelector)
      } else {
        await title.click()
      }
      await mainWindow.keyboard.press('Control+Home')
      await mainWindow.keyboard.press('Control+F')
      /** Find input remains focused throughout reseeding and navigation. */
      const findInput = mainWindow.locator(FIND_INPUT)
      await expect(findInput).toHaveValue('alpha')
      await findInput.fill('beta')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 3')
      await findInput.press('Enter')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')
      await findInput.press('Control+F')
      await expect(findInput).toHaveValue('beta')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')
      await findInput.press('Enter')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('3 of 3')
      await findInput.press('Control+F')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('3 of 3')
      await findInput.press('Shift+Enter')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')

      // Empty and unsuccessful queries leave the last selected editor result available to Ctrl+F.
      for (const query of ['', 'missing-query']) {
        await findInput.fill(query)
        await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('No results')
        await findInput.press('Control+F')
        await expect(findInput).toHaveValue('beta')
        await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')
        await expect(findInput).toBeFocused()
      }
      await findInput.press('Escape')
      if (section === 'body') {
        await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
          selectedText: 'beta', startColumn: 12, positionColumn: 16
        })
        await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
      } else {
        await expect(title).toBeFocused()
        await expect.poll(() => title.evaluate((input: HTMLInputElement) => ({
          start: input.selectionStart, end: input.selectionEnd
        }))).toEqual({ start: 11, end: 15 })
      }
    })
  }

  // Query edits search from the actual cursor, including prefixes and suffixes of its word.
  test('searches changed queries from the cursor without expanding its word', async ({ testSetup }) => {
    /** Repeated prefixes and suffixes distinguish cursor-based lookup from wrapping. */
    const workspacePath = '/ws/find-query-cursor-boundary'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, [{
      folderName: 'Query Cursor', displayName: 'Query Cursor', promptFolderId: 'query-cursor-folder',
      prompts: [{ id: 'query-cursor-prompt', title: 'Search Target', promptText: 'foobar foo bar' }]
    }]))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Application and navigation helpers for the cursor fixture. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Query Cursor')
    /** Editor whose first word must not move the query's search anchor. */
    const editorSelector = promptEditorSelector('query-cursor-prompt')
    await waitForMonacoEditor(mainWindow, editorSelector)
    /** Find input reused after opening from each cursor position. */
    const findInput = mainWindow.locator(FIND_INPUT)
    // Each case distinguishes the cursor offset from the containing word's boundaries.
    for (const cursorCase of [
      { inside: false, query: 'foo', column: 1 },
      { inside: true, query: 'bar', column: 4 },
      { inside: true, query: 'foo', column: 8 }
    ]) {
      await focusMonacoEditor(mainWindow, editorSelector)
      await mainWindow.keyboard.press('Control+Home')
      if (cursorCase.inside) await mainWindow.keyboard.press('ArrowRight')
      await mainWindow.keyboard.press('Control+F')
      await expect(findInput).toHaveValue('foobar')
      await findInput.fill(cursorCase.query)
      await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
        selectedText: cursorCase.query, startColumn: cursorCase.column
      })
      await findInput.press('Escape')
    }
  })

  // Previous excludes a match containing the cursor, but includes one ending exactly there.
  test('navigates previous by match end across cursor boundaries and prompts', async ({ testSetup }) => {
    /** Two prompts make backward wrap distinguishable from the current prompt's first match. */
    const workspacePath = '/ws/find-previous-cursor-boundary'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, [{
      folderName: 'Previous Cursor', displayName: 'Previous Cursor', promptFolderId: 'previous-cursor-folder',
      prompts: [
        { id: 'previous-cursor-first', title: 'First', promptText: 'foo foo' },
        { id: 'previous-cursor-last', title: 'Last', promptText: 'foo' }
      ]
    }]))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Application and navigation helpers for backward navigation. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Previous Cursor')
    /** First editor contains the match whose start, interior, and end are exercised. */
    const firstEditor = promptEditorSelector('previous-cursor-first')
    /** Last editor supplies the folder's backward wrap destination. */
    const lastEditor = promptEditorSelector('previous-cursor-last')
    await waitForMonacoEditor(mainWindow, firstEditor)
    await focusMonacoEditor(mainWindow, firstEditor)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.press('Control+F')
    /** Find input stays open while the user moves the editor cursor. */
    const findInput = mainWindow.locator(FIND_INPUT)
    await expect(findInput).toHaveValue('foo')
    // Cursor offsets cover match interior, start, end, and folder start in that order.
    for (const boundary of [
      { offset: 5, column: 1, index: 1 },
      { offset: 4, column: 1, index: 1 },
      { offset: 7, column: 5, index: 2 },
      { offset: 0, column: 1, index: 3 }
    ]) {
      await focusMonacoEditor(mainWindow, firstEditor)
      await mainWindow.keyboard.press('Control+Home')
      // Move through real keyboard events so Find receives the user's updated anchor.
      for (let step = 0; step < boundary.offset; step += 1) {
        await mainWindow.keyboard.press('ArrowRight')
      }
      await findInput.focus()
      await findInput.press('Shift+Enter')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe(`${boundary.index} of 3`)
      await expect.poll(() => getMonacoSelectionState(
        mainWindow, boundary.index === 3 ? lastEditor : firstEditor
      )).toMatchObject({ selectedText: 'foo', startColumn: boundary.column })
    }
    await findInput.press('Shift+Enter')
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')
    await expect.poll(() => getMonacoSelectionState(mainWindow, firstEditor)).toMatchObject({
      selectedText: 'foo', startColumn: 5
    })
  })

  // Navigation must follow a manually moved cursor even after find has selected a result.
  test('navigates from a manually moved cursor while find stays open', async ({ testSetup }) => {
    /** Isolated folder with three body matches on separate lines. */
    const workspacePath = '/ws/find-manual-navigation-anchor'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Application window and navigation helpers for the regression workspace. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Anchor')
    /** Editor containing all three navigation targets. */
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await waitForMonacoEditor(mainWindow, editorSelector)
    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.press('Control+F')
    /** Find input used to establish an actively selected search result. */
    const findInput = mainWindow.locator(FIND_INPUT)
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await findInput.press('Enter')
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
      selectedText: TYPING_ANCHOR_QUERY,
      startLineNumber: 1
    })
    await findInput.press('Enter')
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
      selectedText: TYPING_ANCHOR_QUERY,
      startLineNumber: 3
    })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.locator('[data-testid="prompt-find-next"]').click()
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
      selectedText: TYPING_ANCHOR_QUERY,
      startLineNumber: 1
    })
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 3')

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Control+End')
    await mainWindow.keyboard.press('Home')
    await mainWindow.locator('[data-testid="prompt-find-prev"]').click()
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
      selectedText: TYPING_ANCHOR_QUERY,
      startLineNumber: 3
    })
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')
  })

  // Reinvoking find must preserve both cursor positions and selection direction.
  for (const selectionCase of ['same-word', 'different-word', 'backward-selection'] as const) {
    test(`preserves ${selectionCase} on Ctrl+F while find stays open`, async ({ testSetup }) => {
      /** Separate persisted workspace for each selection scenario. */
      const workspacePath = `/ws/find-open-${selectionCase}`
      await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Application window and navigation helpers for this scenario. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders('Anchor')
      /** Editor whose cursor or selection supplies the next query. */
      const editorSelector = promptEditorSelector('typing-anchor-1')
      await waitForMonacoEditor(mainWindow, editorSelector)
      await focusMonacoEditor(mainWindow, editorSelector)
      await mainWindow.keyboard.press('Control+Home')
      await mainWindow.keyboard.press('Control+F')
      /** Existing find input, kept open throughout the cursor change. */
      const findInput = mainWindow.locator(FIND_INPUT)
      await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
      await findInput.press('Enter')
      await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toMatchObject({
        selectedText: TYPING_ANCHOR_QUERY,
        startLineNumber: 1
      })
      await findInput.press('Enter')
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('2 of 3')

      await focusMonacoEditor(mainWindow, editorSelector)
      await mainWindow.keyboard.press('Control+Home')
      if (selectionCase === 'backward-selection') {
        await mainWindow.keyboard.press('End')
        await mainWindow.keyboard.press('Control+Shift+ArrowLeft')
      } else {
        if (selectionCase === 'different-word') await mainWindow.keyboard.press('ArrowDown')
        await mainWindow.keyboard.press('ArrowRight')
      }
      /** Exact editor selection, including direction, before refocusing find. */
      const selectionBeforeFind = await getMonacoSelectionState(mainWindow, editorSelector)
      expect(selectionBeforeFind).toMatchObject(
        selectionCase === 'backward-selection'
          ? { selectedText: 'marker', selectionStartColumn: 19, positionColumn: 13 }
          : { selectedText: '', startColumn: 2 }
      )
      await mainWindow.keyboard.press('Control+F')
      await expect(findInput).toBeFocused()
      await expect(findInput).toHaveValue(
        selectionCase === 'backward-selection'
          ? 'marker'
          : selectionCase === 'different-word'
            ? 'zzzz'
            : TYPING_ANCHOR_QUERY
      )
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe(
        selectionCase === 'backward-selection'
          ? '1 of 4'
          : selectionCase === 'different-word'
            ? '1 of 1'
            : '1 of 3'
      )
      await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toEqual(
        selectionBeforeFind
      )
      await mainWindow.keyboard.press('Escape')
      await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
      await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toEqual(
        selectionBeforeFind
      )
    })
  }

  test('preserves a backward selected Monaco match when opening and closing find', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-selection-start-match'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.up('Shift')

    const selectionBeforeFind = await getMonacoSelectionState(mainWindow, editorSelector)
    expect(selectionBeforeFind).toMatchObject({
      selectedText: TYPING_ANCHOR_QUERY,
      startLineNumber: 1,
      startColumn: 1,
      selectionStartColumn: 6,
      positionColumn: 1
    })

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)

    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toEqual(selectionBeforeFind)

    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toEqual(selectionBeforeFind)
  })

  test('starts on the selected match when reopening find with the same persisted query', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-selection-start-match-reopen'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(TYPING_ANCHOR_QUERY)
    await findInput.press('Enter')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.up('Shift')

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 1, startColumn: 1 })
  })

  test('preserves a nonmatching cursor and navigates from it when reopening a persisted query', async ({
    testSetup
  }) => {
    /** Isolated workspace containing matches on both sides of blank cursor anchors. */
    const workspacePath = '/ws/find-persisted-query-reopen'
    await testSetup.setupFilesystem(buildPersistedQueryReopenWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    /** Started application and helpers for the isolated reopen workspace. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    /** Workspace setup result confirms the prompt folder is available for navigation. */
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Reopen')
    /** Prompt body whose blank lines provide nonmatching persisted-query anchors. */
    const editorSelector = promptEditorSelector('persisted-query-reopen-prompt')
    await waitForMonacoEditor(mainWindow, editorSelector)
    /** Folder find input used for reopen and directional navigation assertions. */
    const findInput = mainWindow.locator(FIND_INPUT)

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)

    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowDown')
    /** Original blank-line cursor that reopening and closing must preserve. */
    const cursorBeforeReopen = await getMonacoSelectionState(mainWindow, editorSelector)
    expect(cursorBeforeReopen).toMatchObject({
      selectedText: '',
      startLineNumber: 2,
      startColumn: 1
    })

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 3')
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toEqual(
      cursorBeforeReopen
    )
    await mainWindow.keyboard.press('Escape')
    await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toEqual(
      cursorBeforeReopen
    )

    await mainWindow.keyboard.press('Control+F')
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 3')
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toEqual(
      cursorBeforeReopen
    )
    await findInput.press('Enter')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector))
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)

    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowUp')
    /** Restored blank-line cursor used to verify first backward navigation. */
    const cursorBeforePrevious = await getMonacoSelectionState(mainWindow, editorSelector)
    expect(cursorBeforePrevious).toMatchObject({
      selectedText: '',
      startLineNumber: 2,
      startColumn: 1
    })

    await mainWindow.keyboard.press('Control+F')
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 3')
    await expect.poll(() => getMonacoSelectionState(mainWindow, editorSelector)).toEqual(
      cursorBeforePrevious
    )
    await findInput.press('Shift+Enter')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector))
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 1, startColumn: 1 })
  })

  test('preserves a collapsed Monaco cursor when opening find from its word', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-clicked-word-start-match'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })
    await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, editorSelector)

    await focusMonacoEditor(mainWindow, editorSelector, {
      clickPosition: { x: 28, y: 12 }
    })
    const selectionBeforeFind = await getMonacoSelectionState(mainWindow, editorSelector)
    expect(selectionBeforeFind).toMatchObject({ selectedText: '' })

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          const monacoNode = document.querySelector(`${selector} .monaco-editor`)
          const entry = window.__cthulhuMonacoEditors?.find(
            (item) => item.container === monacoNode || item.container?.contains(monacoNode)
          )
          const controller = (
            entry?.editor as unknown as {
              getContribution: (id: string) => {
                getState: () => { searchString: string; matchesCount: number }
              } | null
            }
          )?.getContribution('editor.contrib.findController')
          const state = controller?.getState()
          return state
            ? { searchString: state.searchString, matchesCount: state.matchesCount }
            : null
        }, editorSelector)
      })
      .toEqual({ searchString: TYPING_ANCHOR_QUERY, matchesCount: 3 })
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toEqual(selectionBeforeFind)
  })

  test('seeds find input from Monaco word at cursor on Ctrl+F', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowRight')

    const cursorWord = await getMonacoWordAtCursor(mainWindow, editorSelector)
    expect(cursorWord && cursorWord.length > 0).toBe(true)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(cursorWord!)
  })

  test('seeds find input from Monaco configured word at numeric boundaries', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-configured-word-boundary'
    await testSetup.setupFilesystem(buildConfiguredWordWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Boundaries')
    const editorSelector = promptEditorSelector('configured-word-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')

    const cursorWord = await getMonacoWordAtCursor(mainWindow, editorSelector)
    expect(cursorWord).toBe('23')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(cursorWord!)
  })

  test('seeds find input from selected title text on Ctrl+F', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const titleSelector = `${promptEditorSelector('dev-2')} ${PROMPT_TITLE_SELECTOR}`
    await mainWindow.waitForSelector(titleSelector, { state: 'attached' })

    const selectedText = await mainWindow.evaluate((selector) => {
      const input = document.querySelector<HTMLInputElement>(selector)
      if (!input) return null
      const start = input.value.indexOf('Analysis')
      if (start < 0) return null
      const end = start + 'Analysis'.length
      input.focus({ preventScroll: true })
      input.setSelectionRange(start, end)
      input.dispatchEvent(new Event('select', { bubbles: true }))
      return input.value.slice(start, end)
    }, titleSelector)
    expect(selectedText).toBe('Analysis')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue('Analysis')
  })

  test('jumps to the first match after the original cursor location while typing', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-typing-anchor'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowDown')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    await findInput.type('h')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: 'h', startLineNumber: 3, startColumn: 1 })

    await findInput.type('e')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: 'he', startLineNumber: 3, startColumn: 1 })

    await findInput.type('llo')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
  })

  test('centers repeated find reveals in a sidebar section too small for the scroll band', async ({
    testSetup
  }) => {
    /** Isolated workspace path for the constrained sidebar find geometry. */
    const workspacePath = '/ws/find-small-sidebar'
    await testSetup.setupFilesystem(buildSmallSidebarFindWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    /** Running application and navigation helpers for the real prompt-folder sidebar. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    /** UI setup result confirming that the generated workspace opened. */
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Small Sidebar')

    /** Active tree viewport constrained below the shared 200px scroll-band requirement. */
    const activeViewport = mainWindow.locator(
      '[data-testid="prompt-tree-active-virtual-window"]'
    )
    /** Backlog sash that shrinks the preceding Active section when dragged upward. */
    const backlogSash = mainWindow.locator(
      '[data-testid="sidebar-prompt-status-accordion-sash-backlog"]'
    )
    /** Accordion bounds used to drag Active to its 100px total minimum height. */
    const accordion = mainWindow.locator('[data-testid="sidebar-prompt-status-accordion"]')
    /** Current sash geometry used as the pointer-drag origin. */
    const backlogSashBox = await backlogSash.boundingBox()
    /** Current accordion geometry used to target Active's minimum boundary. */
    const accordionBox = await accordion.boundingBox()
    expect(backlogSashBox).not.toBeNull()
    expect(accordionBox).not.toBeNull()
    await mainWindow.mouse.move(
      backlogSashBox!.x + backlogSashBox!.width / 2,
      backlogSashBox!.y + backlogSashBox!.height / 2
    )
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(
      backlogSashBox!.x + backlogSashBox!.width / 2,
      accordionBox!.y + 100,
      { steps: 10 }
    )
    await mainWindow.mouse.up()
    await expect
      .poll(async () => Math.abs((await activeViewport.boundingBox())!.height - 64))
      .toBeLessThanOrEqual(2)

    /** Find input whose incremental prefixes repeatedly select the same target prompt. */
    const findInput = mainWindow.locator(FIND_INPUT)
    /** Target tree row whose center must remain stable after every reveal request. */
    const targetTreeRow = mainWindow.locator(
      `[data-testid="prompt-tree-active-prompt-${SMALL_SIDEBAR_TARGET_PROMPT_ID}"]`
    )
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    for (const character of SMALL_SIDEBAR_QUERY.slice(0, 4)) {
      await findInput.pressSequentially(character)
      await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')
      // Let the query-driven navigation and sidebar reveal effects finish before measuring.
      await mainWindow.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
      await expect
        .poll(async () => {
          /** Visible viewport geometry defining the desired center line. */
          const viewportBox = await activeViewport.boundingBox()
          /** Repeatedly revealed row geometry after the latest query update. */
          const targetRowBox = await targetTreeRow.boundingBox()
          if (!viewportBox || !targetRowBox) return Number.POSITIVE_INFINITY
          /** Distance between the target row center and constrained viewport center. */
          const centerDeltaPx =
            targetRowBox.y +
            targetRowBox.height / 2 -
            (viewportBox.y + viewportBox.height / 2)
          return Math.abs(centerDeltaPx)
        })
        .toBeLessThanOrEqual(2)
    }
  })

  test('keeps the original typing anchor when the query is changed or cleared', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-typing-anchor-reset'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowDown')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    await findInput.fill(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })

    await findInput.press('Enter')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 4, startColumn: 1 })

    await findInput.fill('')
    await expect
      .poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 })
      .toBe('No results')

    await findInput.fill(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
  })

  test('focuses the current match after closing the find widget', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })
    await mainWindow.waitForSelector(promptEditorSelector('dev-2'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findClose = mainWindow.locator(FIND_CLOSE)
    const devOneSelector = promptEditorSelector('dev-1')
    const devTwoTitleSelector = `${promptEditorSelector('dev-2')} ${PROMPT_TITLE_SELECTOR}`

    const getMonacoSelectionInfo = async (editorSelector: string) => {
      return await mainWindow.evaluate((selector) => {
        const monacoNode = document.querySelector(`${selector} .monaco-editor`)
        if (!monacoNode) return null

        const active = document.activeElement
        const hasDomFocus = !!active && monacoNode.contains(active)

        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                getSelection: () => any
                getModel: () => {
                  getValueInRange: (range: any) => string
                } | null
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return null

        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })

        if (!entry) return null
        const model = entry.editor.getModel()
        const selection = entry.editor.getSelection()
        if (!model || !selection) return null
        return {
          text: model.getValueInRange(selection),
          hasDomFocus
        }
      }, editorSelector)
    }

    const getTitleSelectionInfo = async () => {
      return await mainWindow.evaluate((selector) => {
        const input = document.querySelector<HTMLInputElement>(selector)
        if (!input) return null
        const start = input.selectionStart ?? 0
        const end = input.selectionEnd ?? 0
        return {
          selectedText: input.value.slice(start, end),
          hasFocus: document.activeElement === input
        }
      }, devTwoTitleSelector)
    }

    const openFind = async () => {
      await mainWindow.keyboard.press('Control+F')
      await expect(findInput).toBeVisible()
    }

    const selectMatch = async (query: string) => {
      await findInput.fill(query)
      await findInput.press('Enter')
    }

    const bodyQuery = 'best practices'

    await openFind()
    await selectMatch(bodyQuery)
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getMonacoSelectionInfo(devOneSelector), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: true })

    await openFind()
    await selectMatch(bodyQuery)
    await findClose.click()
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getMonacoSelectionInfo(devOneSelector), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: true })

    const titleQuery = 'Analysis'

    await openFind()
    await selectMatch(titleQuery)
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getTitleSelectionInfo(), { timeout: 2000 })
      .toEqual({ selectedText: titleQuery, hasFocus: true })

    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-dev-2"]')).toHaveAttribute(
      'data-row-state',
      'active'
    )
  })

  test('restores an unmatched Monaco cursor when closing find', async ({ testSetup }) => {
    const workspacePath = '/ws/find-empty-query-focus-return'
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Focus Return',
          displayName: 'Focus Return',
          promptFolderId: 'find-focus-return-folder',
          prompts: [
            {
              id: 'find-focus-return-prompt',
              title: 'Focus Return Prompt',
              promptText: 'alpha\n'
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Focus Return')
    const editorSelector = promptEditorSelector('find-focus-return-prompt')
    await waitForMonacoEditor(mainWindow, editorSelector)
    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Control+End')

    const cursorBeforeFind = await getMonacoSelectionState(mainWindow, editorSelector)
    expect(cursorBeforeFind).toMatchObject({
      selectedText: '',
      startLineNumber: 2,
      startColumn: 1
    })

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue('')
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector))
      .toEqual(cursorBeforeFind)

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await mainWindow.locator(FIND_CLOSE).click()
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector))
      .toEqual(cursorBeforeFind)
  })

  test('restores focus to the last navigated match when closing with no results', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const bodyQuery = 'best practices'

    const getMonacoSelectionInfo = async () => {
      return await mainWindow.evaluate((selector) => {
        const monacoNode = document.querySelector(`${selector} .monaco-editor`)
        if (!monacoNode) return null

        const active = document.activeElement
        const hasDomFocus = !!active && monacoNode.contains(active)

        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                getSelection: () => any
                getModel: () => {
                  getValueInRange: (range: any) => string
                } | null
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return null

        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })
        if (!entry) return null

        const model = entry.editor.getModel()
        const selection = entry.editor.getSelection()
        if (!model || !selection) return null

        return {
          text: model.getValueInRange(selection),
          hasDomFocus
        }
      }, editorSelector)
    }

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(bodyQuery)
    await findInput.press('Enter')

    await expect
      .poll(async () => getMonacoSelectionInfo(), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: false })

    await findInput.fill('nonmatching-query-0001')
    await expect
      .poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 })
      .toBe('No results')

    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getMonacoSelectionInfo(), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: true })
  })

  CENTER_TRACKING_CASES.forEach((trackingCase) => {
    test(trackingCase.testName, async ({ testSetup }) => {
      /** Isolated workspace path for this centered-row hydration geometry. */
      const workspacePath = `/ws/find-centered-row-${trackingCase.key}`
      await testSetup.setupFilesystem(
        buildCenteredRowHydrationWorkspace(workspacePath, trackingCase)
      )
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })
      expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)

      await mainWindow.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
      await mainWindow.evaluate(() => {
        window.svelteVirtualWindowTestControls?.pauseMonacoHydration()
      })

      try {
        await testHelpers.navigateToPromptFolders(`Center Tracking ${trackingCase.key}`)
        /** Original viewport must remain in place while the distant body is a placeholder. */
        const originalScrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)

        /** Find input that reveals the distant title match while its body remains a placeholder. */
        const findInput = mainWindow.locator(FIND_INPUT)
        await mainWindow.keyboard.press('Control+F')
        await expect(findInput).toBeVisible()
        await findInput.fill(trackingCase.query)
        await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')

        /** Prompt row whose wrapped body changes its height during hydration. */
        const targetSelector = promptEditorSelector(`center-tracking-${trackingCase.key}-30`)
        await mainWindow.waitForSelector(targetSelector, { state: 'attached' })
        await expect(
          mainWindow.locator(`${targetSelector} ${MONACO_PLACEHOLDER_SELECTOR}`)
        ).toHaveCount(1)
        const placeholderHeightPx = await mainWindow
          .locator(targetSelector)
          .evaluate((row) => row.getBoundingClientRect().height)

        expect(await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
          .toBe(originalScrollTop)
        await expect(mainWindow.getByTestId(`prompt-tree-active-prompt-center-tracking-${trackingCase.key}-30`))
          .toHaveAttribute('aria-current', 'true')

        await mainWindow.evaluate(() => {
          window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
        })
        await expect
          .poll(() =>
            mainWindow.locator(`${targetSelector} ${MONACO_PLACEHOLDER_SELECTOR}`).count()
          )
          .toBe(0)

        await expect.poll(() => mainWindow.locator(`${targetSelector} ${PROMPT_TITLE_SELECTOR}`)
          .evaluate((title, hostSelector) => {
            /** Hydrated title and viewport bounds define the exact match placement. */
            const titleRect = title.getBoundingClientRect()
            /** Main virtual viewport stays independent of the complete prompt height. */
            const hostRect = document.querySelector(hostSelector)!.getBoundingClientRect()
            return Math.abs(titleRect.top + titleRect.height / 2 - (hostRect.top + hostRect.height / 2))
          }, PROMPT_FOLDER_HOST_SELECTOR)).toBeLessThanOrEqual(1)
        expect(await mainWindow.locator(targetSelector).evaluate((row) => row.getBoundingClientRect().height))
          .toBeGreaterThan(placeholderHeightPx)
        /** Body sizing preconditions retain distinct fitting, nearly fitting, and oversized coverage. */
        const remainingHeight = await mainWindow.locator(targetSelector).evaluate((row, hostSelector) =>
          document.querySelector(hostSelector)!.getBoundingClientRect().height - row.getBoundingClientRect().height,
        PROMPT_FOLDER_HOST_SELECTOR)
        if (trackingCase.key === 'fits') expect(remainingHeight).toBeGreaterThanOrEqual(100)
        else if (trackingCase.key === 'padding-overflow') {
          expect(remainingHeight).toBeGreaterThanOrEqual(0)
          expect(remainingHeight).toBeLessThan(100)
        } else expect(remainingHeight).toBeLessThan(0)
        await expect(findInput).toBeFocused()
      } finally {
        if (!mainWindow.isClosed()) {
          await mainWindow.evaluate(() => {
            window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
          })
        }
      }
    })
  })

  test('scrolls to a virtualized match and highlights it immediately', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(promptEditorSelector('virtualization-test-1'), {
      state: 'attached'
    })

    const targetSelector = promptEditorSelector(VIRTUAL_FIND_LAST_PROMPT_ID)
    await expect(mainWindow.locator(targetSelector)).toHaveCount(0)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    const uniqueQuery = VIRTUAL_FIND_MARKER
    await findInput.fill(uniqueQuery)
    await expect(mainWindow.locator('[data-testid="prompt-find-widget"]')).not.toContainText(
      'No results'
    )

    const firstSelector = promptEditorSelector(VIRTUAL_FIND_FIRST_PROMPT_ID)
    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ selector, expected }) => {
            const monacoNode = document.querySelector(`${selector} .monaco-editor`)
            if (!monacoNode) return null

            const registry = (
              window as unknown as {
                __cthulhuMonacoEditors?: Array<{
                  container: HTMLElement | null
                  editor: {
                    getSelection: () => any
                    getModel: () => {
                      getValueInRange: (range: any) => string
                    } | null
                  }
                }>
              }
            ).__cthulhuMonacoEditors

            if (!registry?.length) return null

            const entry = registry.find((item) => {
              if (!item?.container) return false
              return item.container === monacoNode || item.container.contains(monacoNode)
            })

            if (!entry) return null
            const model = entry.editor.getModel()
            const selection = entry.editor.getSelection()
            if (!model || !selection) return null
            const text = model.getValueInRange(selection)
            return text === expected
          },
          { selector: firstSelector, expected: uniqueQuery }
        )
      })
      .toBe(true)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          return document.querySelector(selector) != null
        }, `${firstSelector} .monaco-editor .currentFindMatch`)
      })
      .toBe(true)

    await expect(mainWindow.locator(targetSelector)).toHaveCount(0)

    await findInput.press('Enter')
    await mainWindow.waitForSelector(targetSelector, { state: 'attached' })

    const scrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
    expect(scrollTop).toBeGreaterThan(0)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ selector, expected }) => {
            const monacoNode = document.querySelector(`${selector} .monaco-editor`)
            if (!monacoNode) return null

            const registry = (
              window as unknown as {
                __cthulhuMonacoEditors?: Array<{
                  container: HTMLElement | null
                  editor: {
                    getSelection: () => any
                    getModel: () => {
                      getValueInRange: (range: any) => string
                    } | null
                  }
                }>
              }
            ).__cthulhuMonacoEditors

            if (!registry?.length) return null

            const entry = registry.find((item) => {
              if (!item?.container) return false
              return item.container === monacoNode || item.container.contains(monacoNode)
            })

            if (!entry) return null
            const model = entry.editor.getModel()
            const selection = entry.editor.getSelection()
            if (!model || !selection) return null
            const text = model.getValueInRange(selection)
            return text === expected
          },
          { selector: targetSelector, expected: uniqueQuery }
        )
      })
      .toBe(true)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          return document.querySelector(selector) != null
        }, `${targetSelector} .monaco-editor .currentFindMatch`)
      })
      .toBe(true)
  })

  test('restores offscreen focus without scrolling and skips it after virtualization', async ({
    testSetup
  }) => {
    /** Application window and helpers for the long virtualized prompt fixture. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Long')
    /** First prompt row that will unmount after scrolling to the end. */
    const firstPromptSelector = promptEditorSelector(VIRTUAL_FIND_FIRST_PROMPT_ID)
    await focusMonacoEditor(mainWindow, firstPromptSelector)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('End')
    await mainWindow.keyboard.up('Shift')
    await expect.poll(() => getMonacoSelectedText(mainWindow, firstPromptSelector)).toBe(
      VIRTUAL_FIND_MARKER
    )

    /** Folder find input seeded from the selected Monaco text. */
    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveValue(VIRTUAL_FIND_MARKER)

    /** Current virtual scroll position used to calculate an absolute overscan destination. */
    const scrollTopBeforeOverscanMove = await testHelpers.getElementScrollTop(
      PROMPT_FOLDER_HOST_SELECTOR
    )
    /** Scroll position that leaves the hydrated first editor just above the viewport. */
    const overscanScrollTop = await mainWindow.evaluate(
      ({ currentScrollTop, hostSelector, rowSelector }) => {
        /** Virtual window whose visible boundary the target must cross. */
        const host = document.querySelector<HTMLElement>(hostSelector)
        /** Mounted first prompt row being moved into upper overscan. */
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) throw new Error('Missing virtual window or first prompt row')
        return (
          currentScrollTop +
          row.getBoundingClientRect().bottom -
          host.getBoundingClientRect().top +
          20
        )
      },
      {
        currentScrollTop: scrollTopBeforeOverscanMove,
        hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
        rowSelector: firstPromptSelector
      }
    )
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, overscanScrollTop)
    await expect(mainWindow.locator(firstPromptSelector)).toBeAttached()
    await expect(mainWindow.locator(`${firstPromptSelector} .monaco-editor`)).toHaveCount(1)

    /** Geometry proving the mounted Monaco editor is outside the clipped viewport. */
    const geometryBeforeOverscanClose = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        /** Virtual window providing the clipped viewport boundary. */
        const host = document.querySelector<HTMLElement>(hostSelector)!
        /** Mounted overscan row containing the return-focus Monaco editor. */
        const row = document.querySelector<HTMLElement>(rowSelector)!
        return {
          hostTop: host.getBoundingClientRect().top,
          rowBottom: row.getBoundingClientRect().bottom
        }
      },
      { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, rowSelector: firstPromptSelector }
    )
    expect(geometryBeforeOverscanClose.rowBottom).toBeLessThan(
      geometryBeforeOverscanClose.hostTop - 1
    )
    /** Virtual scroll position that offscreen focus restoration must preserve. */
    const scrollTopBeforeOverscanClose = await testHelpers.getElementScrollTop(
      PROMPT_FOLDER_HOST_SELECTOR
    )

    await mainWindow.locator(FIND_CLOSE).click()
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, firstPromptSelector)).toBe(true)
    await mainWindow.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
    /** Stabilized virtual scroll position after restoring offscreen Monaco focus. */
    const scrollTopAfterOverscanClose = await testHelpers.getElementScrollTop(
      PROMPT_FOLDER_HOST_SELECTOR
    )
    expect(
      Math.abs(scrollTopAfterOverscanClose - scrollTopBeforeOverscanClose)
    ).toBeLessThanOrEqual(1)
    /** Geometry after focus restoration, which must remain physically unchanged. */
    const geometryAfterOverscanClose = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        /** Virtual window whose physical position must remain unchanged. */
        const host = document.querySelector<HTMLElement>(hostSelector)!
        /** Focused overscan row whose physical position must remain unchanged. */
        const row = document.querySelector<HTMLElement>(rowSelector)!
        return {
          hostTop: host.getBoundingClientRect().top,
          rowBottom: row.getBoundingClientRect().bottom
        }
      },
      { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, rowSelector: firstPromptSelector }
    )
    expect(
      Math.abs(geometryAfterOverscanClose.hostTop - geometryBeforeOverscanClose.hostTop)
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(geometryAfterOverscanClose.rowBottom - geometryBeforeOverscanClose.rowBottom)
    ).toBeLessThanOrEqual(1)

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveValue(VIRTUAL_FIND_MARKER)

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 1_000_000)
    await expect(mainWindow.locator(firstPromptSelector)).toHaveCount(0)
    /** Bottom scroll position that closing Find must preserve. */
    const scrollTopBeforeClose = await testHelpers.getElementScrollTop(
      PROMPT_FOLDER_HOST_SELECTOR
    )

    await mainWindow.locator(FIND_CLOSE).click()
    await expect(findInput).toHaveCount(0)
    await mainWindow.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
    await expect(mainWindow.locator(firstPromptSelector)).toHaveCount(0)
    /** Stabilized scroll position after closing Find without a ready return target. */
    const scrollTopAfterClose = await testHelpers.getElementScrollTop(
      PROMPT_FOLDER_HOST_SELECTOR
    )
    expect(Math.abs(scrollTopAfterClose - scrollTopBeforeClose)).toBeLessThanOrEqual(1)

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await expect(mainWindow.locator(firstPromptSelector)).toBeAttached()
    await waitForMonacoEditor(mainWindow, firstPromptSelector)
    await mainWindow.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
    expect(await isMonacoEditorFocused(mainWindow, firstPromptSelector)).toBe(false)
  })

  test('cycles correctly across prompt matches including two-digit counters', async ({
    testSetup
  }) => {
    test.setTimeout(180000)
    const workspacePath = '/ws/virtual-find-loop'
    await testSetup.setupFilesystem(buildVirtualFindLoopWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(promptEditorSelector('loop-test-1'), {
      state: 'attached'
    })
    const promptIds = LOOP_MATCH_PROMPT_IDS

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(LOOP_REGRESSION_QUERY)

    const expectedRowIdsByStep = promptIds.map((promptId) => `prompt-editor-${promptId}`)
    const totalMatches = expectedRowIdsByStep.length
    expect(totalMatches).toBe(19)
    await expect
      .poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 })
      .toBe(`1 of ${totalMatches}`)
    await expect
      .poll(() => getCurrentFindMatchRowTestId(mainWindow), { timeout: 5000 })
      .toBe(expectedRowIdsByStep[0])

    const totalPresses = totalMatches * 3
    for (let step = 1; step <= totalPresses; step += 1) {
      await findInput.press('Enter')
      const expectedMatchNumber = (step % totalMatches) + 1
      const expectedLabel = `${expectedMatchNumber} of ${totalMatches}`
      const expectedRowId = expectedRowIdsByStep[expectedMatchNumber - 1]

      await expect
        .poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 })
        .toBe(expectedLabel)
      await expect
        .poll(() => getCurrentFindMatchRowTestId(mainWindow), { timeout: 5000 })
        .toBe(expectedRowId)
    }
  })

  test('keeps next progression stable during rapid enter across virtualized hydration', async ({
    testSetup
  }) => {
    test.setTimeout(180000)
    const workspacePath = '/ws/virtual-find-rapid-loop'
    await testSetup.setupFilesystem(buildVirtualFindRapidWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(promptEditorSelector('rapid-loop-1'), {
      state: 'attached'
    })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(RAPID_LOOP_QUERY)
    await expect.poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 }).toBe('1 of 11')

    await mainWindow.evaluate((selector) => {
      const label = document.querySelector<HTMLElement>(selector)
      if (!label) return

      const captureWindow = window as unknown as {
        __promptFindLabelEvents?: Array<{ current: number; total: number }>
        __promptFindLabelObserver?: MutationObserver
      }
      const events: Array<{ current: number; total: number }> = []
      const captureLabel = () => {
        const text = label.textContent?.trim() ?? ''
        const match = text.match(/^(\d+)\s+of\s+(\d+)$/)
        if (!match) return
        events.push({
          current: Number.parseInt(match[1], 10),
          total: Number.parseInt(match[2], 10)
        })
      }

      captureWindow.__promptFindLabelObserver?.disconnect()
      captureWindow.__promptFindLabelEvents = events
      captureLabel()

      const observer = new MutationObserver(() => {
        captureLabel()
      })
      observer.observe(label, { childList: true, characterData: true, subtree: true })
      captureWindow.__promptFindLabelObserver = observer
    }, FIND_MATCHES_LABEL)

    const totalPresses = 36
    for (let step = 0; step < totalPresses; step += 1) {
      await findInput.press('Enter')
    }

    await expect
      .poll(
        async () =>
          await mainWindow.evaluate(() => {
            const events =
              (
                window as unknown as {
                  __promptFindLabelEvents?: Array<{ current: number; total: number }>
                }
              ).__promptFindLabelEvents ?? []
            const compressed: Array<{ current: number; total: number }> = []
            for (const event of events) {
              const previous = compressed.at(-1)
              if (
                !previous ||
                previous.current !== event.current ||
                previous.total !== event.total
              ) {
                compressed.push(event)
              }
            }
            return compressed.length
          }),
        { timeout: 5000 }
      )
      .toBe(totalPresses + 1)

    const labelEvents = await mainWindow.evaluate(() => {
      const events =
        (
          window as unknown as {
            __promptFindLabelEvents?: Array<{ current: number; total: number }>
          }
        ).__promptFindLabelEvents ?? []
      const compressed: Array<{ current: number; total: number }> = []
      for (const event of events) {
        const previous = compressed.at(-1)
        if (!previous || previous.current !== event.current || previous.total !== event.total) {
          compressed.push(event)
        }
      }
      return compressed
    })
    await mainWindow.evaluate(() => {
      const captureWindow = window as unknown as { __promptFindLabelObserver?: MutationObserver }
      captureWindow.__promptFindLabelObserver?.disconnect()
    })

    expect(labelEvents[0]).toEqual({ current: 1, total: 11 })
    for (let index = 1; index < labelEvents.length; index += 1) {
      const previous = labelEvents[index - 1]
      const next = labelEvents[index]
      const expectedCurrent = previous.current >= previous.total ? 1 : previous.current + 1
      expect(next.current).toBe(expectedCurrent)
      expect(next.total).toBe(previous.total)
    }
  })

  test('does not reselect the active find match after typing at a new cursor location', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const query = 'best practices'

    const getMonacoSelectionInfo = async () => {
      return await mainWindow.evaluate((selector) => {
        const monacoNode = document.querySelector(`${selector} .monaco-editor`)
        if (!monacoNode) return null

        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                getSelection: () => any
                getModel: () => {
                  getValueInRange: (range: any) => string
                  getOffsetAt: (position: any) => number
                } | null
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return null
        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })
        if (!entry) return null

        const model = entry.editor.getModel()
        const selection = entry.editor.getSelection()
        if (!model || !selection) return null

        return {
          selectedText: model.getValueInRange(selection),
          startOffset: model.getOffsetAt(selection.getStartPosition()),
          endOffset: model.getOffsetAt(selection.getEndPosition())
        }
      }, editorSelector)
    }

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(query)
    await findInput.press('Enter')

    await expect
      .poll(async () => getMonacoSelectionInfo(), { timeout: 2000 })
      .toMatchObject({
        selectedText: query
      })

    await focusMonacoEditor(mainWindow, editorSelector, {
      clickPosition: { x: 12, y: 12 }
    })
    await mainWindow.keyboard.type('z')

    await expect
      .poll(
        async () => {
          const info = await getMonacoSelectionInfo()
          if (!info) return false
          return info.selectedText === '' && info.startOffset === info.endOffset
        },
        { timeout: 2000 }
      )
      .toBe(true)
  })
})
