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
import { getPromptEditorIds } from '../helpers/PromptDragDropHelpers'
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
/** Unique query present only in the category-description find fixture. */
const CATEGORY_DESCRIPTION_FIND_QUERY = 'cthulhu-category-description-find-marker'
/** Stable category identity used by the category-description find fixture. */
const CATEGORY_DESCRIPTION_FIND_ID = 'find-category-description-category'
const TRACKED_ROW_TOP_PADDING_PX = 100
const CENTER_TRACKING_CASES = [
  {
    key: 'fits',
    testName: 'keeps a fully fitting prompt row centered while its placeholder hydrates',
    query: 'cthulhu-centered-row-fits-marker',
    promptText: 'W'.repeat(1500),
    expectedPlacement: 'centered'
  },
  {
    key: 'padding-overflow',
    testName: 'top-aligns a prompt row whose padding would overflow the viewport',
    query: 'cthulhu-centered-row-padding-overflow-marker',
    promptText: 'W'.repeat(2600),
    expectedPlacement: 'top-padded-fits'
  },
  {
    key: 'row-overflow',
    testName: 'top-aligns a prompt row taller than the viewport',
    query: 'cthulhu-centered-row-overflow-marker',
    promptText: 'W'.repeat(10000),
    expectedPlacement: 'top-padded-overflow'
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

/** Builds one category whose description is the only source of its find query. */
const buildCategoryDescriptionFindWorkspace = (
  workspacePath: string
): Record<string, string | null> => {
  /** Uncategorized prompts that place the category outside the initial virtual window. */
  const precedingPrompts = Array.from({ length: 40 }, (_, index) => ({
    id: `category-description-preceding-${index + 1}`,
    title: `Preceding Prompt ${index + 1}`,
    promptText: 'Ordinary prompt text.'
  }))
  /** Base prompt-folder fixture with one categorized prompt. */
  const filesystem = createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Category Find',
      displayName: 'Category Find',
      promptFolderId: 'category-description-find-folder',
      prompts: [
        ...precedingPrompts,
        {
          id: 'category-description-find-prompt',
          title: 'Ordinary Prompt',
          promptText: 'This prompt does not contain the category description query.',
          category: CATEGORY_DESCRIPTION_FIND_ID
        }
      ]
    }
  ])
  /** Persisted category metadata containing the unique query. */
  const categoryPath = `${workspacePath}/Prompts/Category Find/Categories/Searchable.category.json`
  filesystem[categoryPath] = JSON.stringify(
    {
      id: CATEGORY_DESCRIPTION_FIND_ID,
      displayName: 'Searchable',
      description: `Expanded description: ${CATEGORY_DESCRIPTION_FIND_QUERY}`
    },
    null,
    2
  )
  return filesystem
}

describe('Prompt folder find dialog', () => {
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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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

  test('searches category descriptions only while their settings are expanded', async ({
    testSetup
  }) => {
    test.setTimeout(120000)
    /** Isolated workspace path for category-description scope changes. */
    const workspacePath = '/ws/find-category-description'
    await testSetup.setupFilesystem(buildCategoryDescriptionFindWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])

    /** Application window and helpers for the isolated workspace. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    /** Workspace setup result confirms the folder is ready for navigation. */
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Category Find')

    /** Category row containing the collapsible description editor. */
    const categorySelector = `[data-testid="category-editor-${CATEGORY_DESCRIPTION_FIND_ID}"]`
    /** Settings toggle that controls category-description find scope. */
    const settingsToggle = mainWindow.locator(
      `${categorySelector} [data-testid="category-editor-settings-toggle"]`
    )
    /** Folder-level find input whose query persists across scope changes. */
    const findInput = mainWindow.locator(FIND_INPUT)

    await expect(mainWindow.locator(categorySelector)).toHaveCount(0)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 1_000_000)
    await mainWindow.waitForSelector(categorySelector, { state: 'attached' })
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      categorySelector,
      120
    )
    await settingsToggle.click()
    await waitForMonacoEditor(mainWindow, categorySelector)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await expect(mainWindow.locator(categorySelector)).toHaveCount(0)

    await mainWindow.keyboard.press('Control+F')
    await findInput.fill(CATEGORY_DESCRIPTION_FIND_QUERY)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')
    await expect.poll(() => getCurrentFindMatchRowTestId(mainWindow)).toBe(
      `category-editor-${CATEGORY_DESCRIPTION_FIND_ID}`
    )

    await settingsToggle.click()
    await expect(mainWindow.locator(`${categorySelector} .monaco-editor`)).toHaveCount(0)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('No results')

    await settingsToggle.click()
    await waitForMonacoEditor(mainWindow, categorySelector)
    await expect.poll(() => getFindMatchesLabelText(mainWindow)).toBe('1 of 1')
    await mainWindow.locator(FIND_CLOSE).click()
    await expect(findInput).toHaveCount(0)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, categorySelector)).toBe(true)
    await expect.poll(() => getMonacoSelectedText(mainWindow, categorySelector)).toBe(
      CATEGORY_DESCRIPTION_FIND_QUERY
    )
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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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

        /** Every estimated placeholder is small enough to begin centered. */
        await expect
          .poll(() =>
            mainWindow.evaluate(
              ({ hostSelector, targetSelector }) => {
                const host = document.querySelector<HTMLElement>(hostSelector)
                const target = document.querySelector<HTMLElement>(targetSelector)
                if (!host || !target) return Number.POSITIVE_INFINITY
                const hostRect = host.getBoundingClientRect()
                const targetRect = target.getBoundingClientRect()
                return Math.abs(
                  targetRect.top + targetRect.height / 2 - (hostRect.top + hostRect.height / 2)
                )
              },
              {
                hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
                targetSelector
              }
            )
          )
          .toBeLessThanOrEqual(1)

        await mainWindow.evaluate(() => {
          window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
        })
        await expect
          .poll(() =>
            mainWindow.locator(`${targetSelector} ${MONACO_PLACEHOLDER_SELECTOR}`).count()
          )
          .toBe(0)

        const hydratedGeometry = await mainWindow
          .locator(targetSelector)
          .evaluate((row, hostSelector) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            if (!host) return null
            const hostRect = host.getBoundingClientRect()
            const rowRect = row.getBoundingClientRect()
            return {
              centerDeltaPx:
                rowRect.top + rowRect.height / 2 - (hostRect.top + hostRect.height / 2),
              topOffsetPx: rowRect.top - hostRect.top,
              bottomOverflowPx: rowRect.bottom - hostRect.bottom,
              rowHeightPx: rowRect.height,
              viewportHeightPx: hostRect.height
            }
          }, PROMPT_FOLDER_HOST_SELECTOR)
        expect(hydratedGeometry).not.toBeNull()
        expect(hydratedGeometry!.rowHeightPx).toBeGreaterThan(placeholderHeightPx)

        const remainingViewportHeightPx =
          hydratedGeometry!.viewportHeightPx - hydratedGeometry!.rowHeightPx
        if (trackingCase.expectedPlacement === 'centered') {
          expect(remainingViewportHeightPx).toBeGreaterThanOrEqual(TRACKED_ROW_TOP_PADDING_PX)
          expect(Math.abs(hydratedGeometry!.centerDeltaPx)).toBeLessThanOrEqual(1)
        } else if (trackingCase.expectedPlacement === 'top-padded-fits') {
          expect(remainingViewportHeightPx).toBeGreaterThanOrEqual(0)
          expect(remainingViewportHeightPx).toBeLessThan(TRACKED_ROW_TOP_PADDING_PX)
          expect(hydratedGeometry!.bottomOverflowPx).toBeGreaterThan(0)
          expect(
            Math.abs(hydratedGeometry!.topOffsetPx - TRACKED_ROW_TOP_PADDING_PX)
          ).toBeLessThanOrEqual(1)
        } else {
          expect(remainingViewportHeightPx).toBeLessThan(0)
          expect(hydratedGeometry!.bottomOverflowPx).toBeGreaterThan(0)
          expect(
            Math.abs(hydratedGeometry!.topOffsetPx - TRACKED_ROW_TOP_PADDING_PX)
          ).toBeLessThanOrEqual(1)
        }
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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
