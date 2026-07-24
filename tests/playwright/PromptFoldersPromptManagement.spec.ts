import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import {
  focusMonacoEditor,
  getMonacoEditorText,
  isMonacoEditorFocused,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { heightTestPrompts } from '../fixtures/TestData'
import {
  checkPersistedPromptFilesExistByTitle,
  readPersistedPromptTextById,
  resolvePersistedPromptFilePathsByTitle
} from '../helpers/PromptPersistenceTestHelpers'
import { serializePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'
import { PromptStatus, type PromptPersisted } from '../../src/shared/Prompt'
import { readPromptFolderEntries } from '../helpers/PromptDragDropHelpers'
import { measureEditorCardGeometry } from '../helpers/CardGeometryHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const MOVE_SCROLL_WORKSPACE_PATH = '/ws/move-scroll-anchor'
const FALLBACK_TITLE_WORKSPACE_PATH = '/ws/fallback-title-management'
const COPY_PREFIX_SUFFIX_WORKSPACE_PATH = '/ws/copy-prefix-suffix'
const SAMPLE_WORKSPACE_PATH = '/ws/sample'
const SELF_HEALING_WORKSPACE_PATH = '/ws/completed-self-healing'
const COMPLETED_MODE_WORKSPACE_PATH = '/ws/completed-mode'
const COMPLETED_MODE_WORKSPACE_ID = 'completed-mode-workspace'
const COMPLETED_MODE_FOLDER_ID = 'completed-mode-folder'
const NO_COMPLETED_FOLDER_ID = 'no-completed-folder'
const MOVE_SCROLL_FOLDER_NAME = 'Move Scroll Anchor'
const FALLBACK_TITLE_FOLDER_NAME = 'Fallback Titles'
const COMPLETION_FOLDER_NAME = 'Development'
const COMPLETION_PROMPT_ID = 'dev-1'
const COMPLETION_PROMPT_TITLE = 'Code Review'
const BOUNDARY_1_ID = 'boundary-1'
const BOUNDARY_2_ID = 'boundary-2'
const MOVE_ANCHOR_1_ID = 'move-anchor-1'
const MOVE_ANCHOR_2_ID = 'move-anchor-2'
const MOVE_ANCHOR_3_ID = 'move-anchor-3'
const MOVE_BUTTON_POSITION_TOLERANCE_PX = 1
const MINIMAL_SCROLL_POSITION_TOLERANCE_PX = 2

const promptTitleSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} ${PROMPT_TITLE_SELECTOR}`
const dividerAddSelector = (promptId: string) =>
  `[data-testid="prompt-divider-add-after-${promptId}"]`
const dividerSeparatorSelector = (promptId: string, side: 'left' | 'right') =>
  `[data-testid="prompt-divider-add-after-${promptId}-separator-${side}"]`
const moveUpSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-move-up"]`
const moveDownSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-move-down"]`
const completeSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-complete-button"]`
const uncompleteSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-uncomplete-button"]`
const statusMoreOptionsSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-status-more-options-button"]`
const statusPillSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-status-pill"]`
const statusIndicatorSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-title-status-indicator"]`
const PROMPT_TREE_PROMPT_ROW_PREFIX = 'prompt-tree-prompt-'

const expectEditedIndicator = async (page: any, promptId: string) => {
  const indicator = page.locator(statusIndicatorSelector(promptId))
  await expect(indicator).toHaveAttribute('data-edited', 'true')
  await expect(indicator).toHaveCSS('visibility', 'visible')
  const colors = await indicator.evaluate((element) => {
    const reference = document.createElement('span')
    reference.style.backgroundColor = 'var(--ui-info-strong-border)'
    document.body.append(reference)
    const expected = getComputedStyle(reference).backgroundColor
    reference.remove()
    return { actual: getComputedStyle(element).backgroundColor, expected }
  })
  expect(colors.actual).toBe(colors.expected)
}

const getPromptEditorIds = async (page: any): Promise<string[]> => {
  return await page.evaluate((selector: string) => {
    return Array.from(document.querySelectorAll(selector))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .filter((testId) => testId.startsWith('prompt-editor-'))
      .map((testId) => testId.replace('prompt-editor-', ''))
  }, PROMPT_EDITOR_PREFIX_SELECTOR)
}

const getPromptTreePromptRowIds = async (page: any): Promise<string[]> => {
  return await page.evaluate((prefix: string) => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid]'))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .filter((testId) => testId.startsWith(prefix))
      .map((testId) => testId.replace(prefix, ''))
  }, PROMPT_TREE_PROMPT_ROW_PREFIX)
}

const waitForPromptCount = async (page: any, count: number) => {
  await expect
    .poll(async () => (await getPromptEditorIds(page)).length, { timeout: 5000 })
    .toBe(count)
}

const clickAddAfter = async (
  page: any,
  testHelpers: {
    scrollVirtualElementIntoView: (
      hostSelector: string,
      elementSelector: string,
      topOffsetPx?: number
    ) => Promise<void>
  },
  promptId: string
) => {
  const buttonSelector = dividerAddSelector(promptId)
  await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, buttonSelector, 120)
  const button = page.locator(buttonSelector)
  await expect(button).toBeEnabled()
  await button.click()
}

const clickMoveUp = async (page: any, promptId: string) => {
  const button = page.locator(moveUpSelector(promptId))
  await expect(button).toBeEnabled()
  await button.evaluate((element: HTMLButtonElement) => element.click())
}

const clickMoveDown = async (page: any, promptId: string) => {
  const button = page.locator(moveDownSelector(promptId))
  await expect(button).toBeEnabled()
  await button.evaluate((element: HTMLButtonElement) => element.click())
}

const setPromptTitle = async (page: any, promptId: string, title: string) => {
  const input = page.locator(promptTitleSelector(promptId))
  await input.waitFor({ state: 'visible' })
  await input.fill(title)
}

const replacePromptText = async (page: any, promptId: string, text: string) => {
  const editorSelector = promptEditorSelector(promptId)
  await focusMonacoEditor(page, editorSelector)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text, { delay: 20 })
  // Monaco text helper collapses whitespace, so normalize the expected text to match.
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  await expect.poll(async () => getMonacoEditorText(page, editorSelector)).toContain(normalizedText)
}

const expectPromptContent = async (
  page: any,
  promptId: string,
  expected: { title: string; text: string }
) => {
  const editorSelector = promptEditorSelector(promptId)
  await waitForMonacoEditor(page, editorSelector)
  await expect(page.locator(promptTitleSelector(promptId))).toHaveValue(expected.title)
  const text = await getMonacoEditorText(page, editorSelector)
  expect(text).toContain(expected.text)
}

const getElementTop = async (page: any, selector: string): Promise<number> => {
  return await page.locator(selector).evaluate((element: HTMLElement) => {
    return element.getBoundingClientRect().top
  })
}

type ElementRectSnapshot = {
  top: number
  bottom: number
  height: number
}

const getElementRect = async (page: any, selector: string): Promise<ElementRectSnapshot> => {
  return await page.locator(selector).evaluate((element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height
    }
  })
}

const alignElementBottomInPromptFolder = async (
  page: any,
  testHelpers: { scrollVirtualWindowBy: (selector: string, deltaPx: number) => Promise<void> },
  targetSelector: string,
  bottomPaddingPx: number
) => {
  const targetRect = await getElementRect(page, targetSelector)
  const hostRect = await getElementRect(page, PROMPT_FOLDER_HOST_SELECTOR)
  const deltaPx = Math.round(targetRect.bottom - (hostRect.bottom - bottomPaddingPx))

  if (Math.abs(deltaPx) <= MINIMAL_SCROLL_POSITION_TOLERANCE_PX) return

  await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, deltaPx)
}

const scrollUntilMounted = async (
  page: any,
  testHelpers: { scrollVirtualWindowBy: (selector: string, deltaPx: number) => Promise<void> },
  selector: string
): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await page.locator(selector).count()) > 0) return
    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, 600)
  }

  throw new Error(`Element did not become mounted: ${selector}`)
}

const scrollPromptEditorIntoView = async (
  page: any,
  testHelpers: {
    scrollVirtualWindowBy: (selector: string, deltaPx: number) => Promise<void>
    scrollVirtualWindowTo: (selector: string, scrollTop: number) => Promise<void>
    scrollVirtualElementIntoView: (
      hostSelector: string,
      elementSelector: string,
      topOffsetPx?: number
    ) => Promise<void>
  },
  promptId: string
) => {
  const editorSelector = promptEditorSelector(promptId)
  await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
  await scrollUntilMounted(page, testHelpers, editorSelector)
  await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, editorSelector)
  await waitForMonacoEditor(page, editorSelector)
}

const buildMoveScrollWorkspace = () => {
  const shortPrompt = heightTestPrompts.singleLine
  const tallPrompt = heightTestPrompts.twoHundredLine

  return createWorkspaceWithFolders(MOVE_SCROLL_WORKSPACE_PATH, [
    {
      folderName: MOVE_SCROLL_FOLDER_NAME,
      displayName: MOVE_SCROLL_FOLDER_NAME,
      prompts: [
        { ...tallPrompt, id: BOUNDARY_1_ID, title: 'Boundary One' },
        { ...shortPrompt, id: BOUNDARY_2_ID, title: 'Boundary Two' },
        { ...tallPrompt, id: MOVE_ANCHOR_1_ID, title: 'Move Anchor One' },
        { ...tallPrompt, id: MOVE_ANCHOR_2_ID, title: 'Move Anchor Two' },
        { ...tallPrompt, id: MOVE_ANCHOR_3_ID, title: 'Move Anchor Three' }
      ]
    }
  ])
}

const buildFallbackTitleWorkspace = () =>
  createWorkspaceWithFolders(FALLBACK_TITLE_WORKSPACE_PATH, [
    {
      folderName: FALLBACK_TITLE_FOLDER_NAME,
      displayName: FALLBACK_TITLE_FOLDER_NAME,
      prompts: [
        {
          id: 'active-new-prompt',
          title: 'New Prompt',
          promptText: 'Active titles do not reserve fallback names.'
        },
        {
          id: 'fallback-new-prompt',
          title: '',
          promptText: 'Fallback prompt already reserves New Prompt.'
        },
        {
          id: 'clear-title-target',
          title: 'Clear Me',
          promptText: 'Clearing this title should choose the next fallback.'
        }
      ]
    }
  ])

const buildCompletedSelfHealingWorkspace = () => {
  const folderName = 'Self Healing'
  const activePrompt: PromptPersisted = {
    id: 'active-with-completed-flags',
    title: 'Active Bad Flags',
    fallbackTitle: '',
    createdAt: '2023-01-01T00:00:00.000Z',
    modifiedAt: '2023-01-01T00:00:00.000Z',
    promptText: 'This regular prompt should keep rendering.',
    status: PromptStatus.Completed,
    completedAt: '2023-01-02T00:00:00Z'
  }
  const completedPrompt: PromptPersisted = {
    id: 'completed-without-flags',
    title: 'Completed Missing Flags',
    fallbackTitle: '',
    createdAt: '2023-01-03T00:00:00.000Z',
    modifiedAt: '2023-01-03T00:00:00.000Z',
    status: PromptStatus.Todo,
    promptText: 'This completed prompt should stay hidden.'
  }
  const workspace = createWorkspaceWithFolders(SELF_HEALING_WORKSPACE_PATH, [
    {
      folderName,
      displayName: folderName,
      prompts: [
        {
          id: activePrompt.id,
          title: activePrompt.title,
          promptText: activePrompt.promptText,
          createdAt: activePrompt.createdAt
        }
      ]
    }
  ])
  const activePath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: SELF_HEALING_WORKSPACE_PATH,
    folderName,
    promptId: activePrompt.id,
    promptTitle: activePrompt.title
  }).markdownPath
  const completedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: SELF_HEALING_WORKSPACE_PATH,
    folderName: `${folderName}/_Completed`,
    promptId: completedPrompt.id,
    promptTitle: completedPrompt.title
  }).markdownPath

  return {
    ...workspace,
    [`${SELF_HEALING_WORKSPACE_PATH}/Prompts/${folderName}/_FolderInfo/FolderOrder.json`]:
      JSON.stringify(
        {
          entries: [completedPrompt.id, activePrompt.id].map((id) => ({
            kind: 'prompt',
            id
          }))
        },
        null,
        2
      ),
    [`${SELF_HEALING_WORKSPACE_PATH}/Prompts/${folderName}/_Completed`]: null,
    [activePath]: serializePromptMarkdown(activePrompt),
    [completedPath]: serializePromptMarkdown(completedPrompt)
  }
}

const buildCompletedModeWorkspace = () => {
  const folderName = 'Completed Mode'
  const activePrompt: PromptPersisted = {
    id: 'completed-mode-active',
    title: 'Active Prompt',
    fallbackTitle: '',
    createdAt: '2023-01-01T00:00:00.000Z',
    modifiedAt: '2023-01-01T00:00:00.000Z',
    status: PromptStatus.Todo,
    promptText: 'This active prompt should be visible by default.'
  }
  const newestCompletedPrompt: PromptPersisted = {
    id: 'completed-mode-newest',
    title: 'Newest Completed',
    fallbackTitle: '',
    createdAt: '2023-01-02T00:00:00.000Z',
    modifiedAt: '2023-01-05T00:00:00.000Z',
    promptText: 'Newest completed body marker.',
    status: PromptStatus.Completed,
    completedAt: '2023-01-05T00:00:00.000Z'
  }
  const oldestCompletedPrompt: PromptPersisted = {
    id: 'completed-mode-oldest',
    title: 'Oldest Completed',
    fallbackTitle: '',
    createdAt: '2023-01-03T00:00:00.000Z',
    modifiedAt: '2023-01-04T00:00:00.000Z',
    promptText: 'Oldest completed body marker.',
    status: PromptStatus.Completed,
    completedAt: '2023-01-04T00:00:00.000Z'
  }
  const workspace = createWorkspaceWithFolders(
    COMPLETED_MODE_WORKSPACE_PATH,
    [
      {
        folderName,
        displayName: folderName,
        promptFolderId: COMPLETED_MODE_FOLDER_ID,
        prompts: [
          {
            id: activePrompt.id,
            title: activePrompt.title,
            promptText: activePrompt.promptText,
            createdAt: activePrompt.createdAt
          }
        ]
      },
      {
        folderName: 'No Completed',
        displayName: 'No Completed',
        promptFolderId: NO_COMPLETED_FOLDER_ID,
        prompts: [
          {
            id: 'no-completed-active',
            title: 'Only Active',
            promptText: 'This folder has no completed prompts.'
          }
        ]
      }
    ],
    {
      settings: { workspaceId: COMPLETED_MODE_WORKSPACE_ID }
    }
  )
  const newestCompletedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
    folderName: `${folderName}/_Completed`,
    promptId: newestCompletedPrompt.id,
    promptTitle: newestCompletedPrompt.title
  }).markdownPath
  const oldestCompletedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
    folderName: `${folderName}/_Completed`,
    promptId: oldestCompletedPrompt.id,
    promptTitle: oldestCompletedPrompt.title
  }).markdownPath

  workspace[`${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/${folderName}/_FolderInfo/FolderOrder.json`] =
    JSON.stringify(
      {
        entries: [newestCompletedPrompt.id, oldestCompletedPrompt.id, activePrompt.id].map(
          (id) => ({ kind: 'prompt', id })
        )
      },
      null,
      2
    )

  return {
    ...workspace,
    [`${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/${folderName}/_Completed`]: null,
    [newestCompletedPath]: serializePromptMarkdown(newestCompletedPrompt),
    [oldestCompletedPath]: serializePromptMarkdown(oldestCompletedPrompt)
  }
}

describe('Prompt folder prompt management', () => {
  test('names a new untitled prompt with the first available fallback title', async ({
    testSetup
  }) => {
    await testSetup.setupFilesystem(buildFallbackTitleWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(FALLBACK_TITLE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(FALLBACK_TITLE_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('active-new-prompt'))

    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'active-new-prompt')
    await waitForPromptCount(mainWindow, 4)

    const newPromptId = (await getPromptEditorIds(mainWindow)).find(
      (promptId) => !initialIds.includes(promptId)
    )
    expect(newPromptId).toBeTruthy()
    await expect(mainWindow.locator(promptTitleSelector(newPromptId!))).toHaveAttribute(
      'placeholder',
      'New Prompt 1...'
    )
    await expectEditedIndicator(mainWindow, newPromptId!)
  })

  test('regenerates the fallback title when an active title is cleared', async ({ testSetup }) => {
    await testSetup.setupFilesystem(buildFallbackTitleWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(FALLBACK_TITLE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(FALLBACK_TITLE_FOLDER_NAME)
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'clear-title-target')

    await setPromptTitle(mainWindow, 'clear-title-target', '')
    await expect(mainWindow.locator(promptTitleSelector('clear-title-target'))).toHaveAttribute(
      'placeholder',
      'New Prompt 1...'
    )
  })

  test('tabs from the prompt title to the Monaco editor', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await waitForMonacoEditor(mainWindow, editorSelector)

    await mainWindow.locator(promptTitleSelector('dev-1')).focus()
    await mainWindow.keyboard.press('Tab')

    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)
  })

  test('adds a prompt at the start from the sidebar and focuses it', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    const initialIds = await getPromptEditorIds(mainWindow)

    await testHelpers.navigateToHomeScreen()
    const addPromptButton = mainWindow.locator('[data-testid="sidebar-add-prompt-button"]')
    await expect(addPromptButton).toBeEnabled()
    await addPromptButton.click()

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await waitForPromptCount(mainWindow, initialIds.length + 1)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const newPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))
    expect(newPromptId).toBeTruthy()
    expect(idsAfterAdd).toEqual([newPromptId, ...initialIds])

    const newEditorSelector = promptEditorSelector(newPromptId!)
    await waitForMonacoEditor(mainWindow, newEditorSelector)
    await expect(
      mainWindow.locator(`[data-testid="prompt-tree-prompt-${newPromptId}"]`)
    ).toHaveAttribute('aria-current', 'true')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, newEditorSelector), { timeout: 5000 })
      .toBe(true)
  })

  test('does not refocus a created prompt when its virtual row remounts', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))

    await mainWindow.locator('[data-testid="sidebar-add-prompt-button"]').click()
    await expect
      .poll(async () => (await getPromptEditorIds(mainWindow)).some((id) => !id.startsWith('short-')))
      .toBe(true)

    const newPromptId = (await getPromptEditorIds(mainWindow)).find(
      (id) => !id.startsWith('short-')
    )!
    const newEditorSelector = promptEditorSelector(newPromptId)
    await waitForMonacoEditor(mainWindow, newEditorSelector)
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, newEditorSelector))
      .toBe(true)

    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(
      PROMPT_FOLDER_HOST_SELECTOR
    )
    const viewportHeight = await testHelpers.getPromptRowHeight(PROMPT_FOLDER_HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(
      PROMPT_FOLDER_HOST_SELECTOR,
      scrollHeight - viewportHeight
    )
    await expect(mainWindow.locator(newEditorSelector)).toHaveCount(0)

    const headerSection = mainWindow.locator('[data-testid="prompt-folder-header-section"]')
    await headerSection.focus()
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await waitForMonacoEditor(mainWindow, newEditorSelector)
    await mainWindow.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )

    await expect(headerSection).toBeFocused()
  })

  test('adds a prompt from a divider with minimal scroll and focuses it', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-2')

    const button = mainWindow.locator(dividerAddSelector('dev-2'))
    await button.scrollIntoViewIfNeeded()
    await alignElementBottomInPromptFolder(mainWindow, testHelpers, dividerAddSelector('dev-2'), 8)
    await expect(button).toBeEnabled()

    const initialPromptTreeIds = await getPromptTreePromptRowIds(mainWindow)
    await button.click()

    await expect
      .poll(async () => (await getPromptTreePromptRowIds(mainWindow)).length, { timeout: 5000 })
      .toBe(initialPromptTreeIds.length + 1)

    const promptTreeIdsAfterAdd = await getPromptTreePromptRowIds(mainWindow)
    const newPromptId = promptTreeIdsAfterAdd.find((id) => !initialPromptTreeIds.includes(id))
    expect(newPromptId).toBeTruthy()

    const newEditorSelector = promptEditorSelector(newPromptId!)
    await waitForMonacoEditor(mainWindow, newEditorSelector)
    await expect(
      mainWindow.locator(`[data-testid="prompt-tree-prompt-${newPromptId}"]`)
    ).toHaveAttribute('aria-current', 'true')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, newEditorSelector), { timeout: 5000 })
      .toBe(true)

    const hostRect = await getElementRect(mainWindow, PROMPT_FOLDER_HOST_SELECTOR)
    const editorRect = await getElementRect(mainWindow, newEditorSelector)
    const hostCenter = hostRect.top + hostRect.height / 2
    const editorCenter = editorRect.top + editorRect.height / 2

    expect(editorRect.top).toBeGreaterThanOrEqual(
      hostRect.top - MINIMAL_SCROLL_POSITION_TOLERANCE_PX
    )
    expect(editorRect.bottom).toBeLessThanOrEqual(
      hostRect.bottom + MINIMAL_SCROLL_POSITION_TOLERANCE_PX
    )
    expect(editorCenter).toBeGreaterThan(hostCenter + MINIMAL_SCROLL_POSITION_TOLERANCE_PX)
  })

  test('adds prompts from either full-height divider separator', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    let expectedPromptCount = (await getPromptTreePromptRowIds(mainWindow)).length

    for (const [promptId, side] of [
      ['dev-1', 'left'],
      ['dev-2', 'right']
    ] as const) {
      const separatorSelector = dividerSeparatorSelector(promptId, side)
      await testHelpers.scrollVirtualElementIntoView(
        PROMPT_FOLDER_HOST_SELECTOR,
        separatorSelector,
        120
      )
      await mainWindow.locator(separatorSelector).click()
      expectedPromptCount += 1
      await expect
        .poll(async () => (await getPromptTreePromptRowIds(mainWindow)).length)
        .toBe(expectedPromptCount)
    }
  })

  test('reveals prompt row controls without shifting their reserved space', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-2')

    const editor = mainWindow.locator(promptEditorSelector('dev-2'))
    const rail = editor.locator('.prompt-editor-sidebar')
    const moveUpButton = editor.locator('[data-testid="prompt-move-up"]')
    const moveDownButton = editor.locator('[data-testid="prompt-move-down"]')
    const dragHandle = editor.locator('[data-testid="prompt-drag-handle"]')
    const moveUpIcon = moveUpButton.locator('svg')
    const moveDownIcon = moveDownButton.locator('svg')
    const dragIcon = dragHandle.locator('svg')
    const moveUpBoxBefore = await moveUpButton.boundingBox()

    await expect(moveUpIcon).toHaveCSS('opacity', '0')
    await expect(moveDownIcon).toHaveCSS('opacity', '0')
    await expect(dragIcon).toHaveCSS('opacity', '1')
    await expect(moveUpButton).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
    await expect(dragHandle).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)')
    await expect(moveUpIcon).toHaveCSS('transition-property', 'opacity')
    await expect(moveUpIcon).toHaveCSS('transition-duration', '0.05s')
    await expect(moveUpIcon).toHaveCSS('transition-timing-function', 'ease-out')

    await rail.hover()
    await expect(moveUpIcon).toHaveCSS('opacity', '1')
    await expect(moveDownIcon).toHaveCSS('opacity', '1')
    await expect(moveDownButton).toHaveCSS('opacity', '0.5')
    await expect
      .poll(
        async () =>
          await moveUpButton.evaluate((button) => getComputedStyle(button).borderBottomColor)
      )
      .not.toBe('rgba(0, 0, 0, 0)')
    await expect
      .poll(
        async () =>
          await dragHandle.evaluate((button) => getComputedStyle(button).borderBottomColor)
      )
      .not.toBe('rgba(0, 0, 0, 0)')

    const moveUpBoxAfter = await moveUpButton.boundingBox()
    expect(moveUpBoxBefore).not.toBeNull()
    expect(moveUpBoxAfter).not.toBeNull()
    expect(Math.abs(moveUpBoxAfter!.x - moveUpBoxBefore!.x)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    expect(Math.abs(moveUpBoxAfter!.y - moveUpBoxBefore!.y)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    await mainWindow.locator(promptTitleSelector('dev-2')).hover()
    await moveUpButton.focus()
    await expect(moveUpIcon).toHaveCSS('opacity', '1')
    await mainWindow.locator(promptTitleSelector('dev-2')).focus()
    await expect(moveUpIcon).toHaveCSS('opacity', '0')

    const dividerButton = mainWindow.locator(dividerAddSelector('dev-2'))
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      dividerAddSelector('dev-2'),
      120
    )
    await mainWindow.mouse.move(0, 0)
    const dividerActions = dividerButton.locator('..')
    const dividerRow = dividerButton.locator(
      'xpath=ancestor::div[contains(@class, "promptDividerRow")]'
    )
    const dividerButtonBoxBefore = await dividerButton.boundingBox()
    const dividerButtonIconBox = await dividerButton.locator('svg').boundingBox()
    const dividerRowBox = await dividerRow.boundingBox()
    const dividerActionsBox = await dividerActions.boundingBox()
    const dividerSeparators = dividerRow.locator('.promptDividerSeparatorButton')
    const separatorHeights = await dividerSeparators.evaluateAll((separators) =>
      separators.map((separator) => separator.getBoundingClientRect().height)
    )
    const separatorColorsBefore = await dividerRow
      .locator('.cthulhuUiSeparator')
      .evaluateAll((separators) =>
        separators.map((separator) => getComputedStyle(separator).backgroundColor)
      )

    await expect(dividerActions).toHaveCSS('opacity', '0')
    await expect(dividerActions).toHaveCSS('transition-property', 'opacity')
    await expect(dividerActions).toHaveCSS('transition-duration', '0.12s')
    await expect(dividerActions).toHaveCSS('transition-timing-function', 'ease')
    await expect(dividerRow.locator('.cthulhuUiSeparator')).toHaveCount(2)
    await expect(dividerButton).toHaveText('Add Prompt')
    await expect(dividerActions.getByRole('button')).toHaveCount(2)
    expect(dividerButtonBoxBefore).not.toBeNull()
    expect(dividerButtonIconBox).not.toBeNull()
    expect(dividerRowBox).not.toBeNull()
    expect(dividerActionsBox).not.toBeNull()
    expect(dividerButtonBoxBefore!.height).toBe(28)
    expect(dividerButtonIconBox!.height).toBe(13)
    expect(dividerRowBox!.height).toBe(28)
    expect(separatorHeights).toEqual([28, 28])
    const dividerButtonCenter = dividerButtonBoxBefore!.y + dividerButtonBoxBefore!.height / 2
    const dividerRowCenter = dividerRowBox!.y + dividerRowBox!.height / 2
    expect(Math.abs(dividerButtonCenter - dividerRowCenter)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    const dividerActionsCenter = dividerActionsBox!.x + dividerActionsBox!.width / 2
    const dividerRowHorizontalCenter = dividerRowBox!.x + dividerRowBox!.width / 2
    expect(Math.abs(dividerActionsCenter - dividerRowHorizontalCenter)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    await dividerRow.hover()
    await expect(dividerActions).toHaveCSS('opacity', '1')
    const separatorColorsAfter = await dividerRow
      .locator('.cthulhuUiSeparator')
      .evaluateAll((separators) =>
        separators.map((separator) => getComputedStyle(separator).backgroundColor)
      )
    const accentSeparatorColor = await dividerRow.evaluate(() => {
      const reference = document.createElement('span')
      reference.style.backgroundColor = 'var(--ui-accent-normal-border)'
      document.body.append(reference)
      const color = getComputedStyle(reference).backgroundColor
      reference.remove()
      return color
    })
    expect(separatorColorsAfter[0]).toBe(separatorColorsAfter[1])
    expect(separatorColorsAfter[0]).toBe(accentSeparatorColor)
    expect(accentSeparatorColor).not.toBe(separatorColorsBefore[0])

    const dividerButtonBoxAfter = await dividerButton.boundingBox()
    expect(dividerButtonBoxAfter).not.toBeNull()
    expect(Math.abs(dividerButtonBoxAfter!.x - dividerButtonBoxBefore!.x)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    expect(Math.abs(dividerButtonBoxAfter!.y - dividerButtonBoxBefore!.y)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    await mainWindow.mouse.move(0, 0)
    await dividerButton.focus()
    await expect(dividerActions).toHaveCSS('opacity', '1')
  })

  test('reorders prompts with move buttons', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-1')
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-2')

    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'dev-2')
    await waitForPromptCount(mainWindow, 3)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const newPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))!
    expect(newPromptId).toBeTruthy()

    // Step 1-2: move the second prompt to the top.
    await clickMoveUp(mainWindow, 'dev-2')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['dev-2', 'dev-1', newPromptId])

    // Step 3-4: move the current second prompt to the third slot.
    await clickMoveDown(mainWindow, 'dev-1')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['dev-2', newPromptId, 'dev-1'])

    // Step 5-6: boundary buttons are disabled when the prompt cannot move farther.
    await expect(mainWindow.locator(moveUpSelector('dev-2'))).toBeDisabled()
    await expect(mainWindow.locator(moveDownSelector('dev-1'))).toBeDisabled()
    expect(await getPromptEditorIds(mainWindow)).toEqual(['dev-2', newPromptId, 'dev-1'])
  })

  // The pixel-exact anchor polls below fail with an opaque offset when a card
  // clips content inside its own overflow:hidden box (the browser then scrolls
  // the card internally on click). Diagnose that directly after each click.
  const expectNoCardInternalScroll = async (mainWindow: any, promptId: string): Promise<void> => {
    const geometry = await measureEditorCardGeometry(mainWindow, promptEditorSelector(promptId))
    expect(
      geometry?.internalScrollTopPx,
      `${promptId} card scrolled internally after a move click — its content likely overflows the card (height constants out of sync with CSS)`
    ).toBe(0)
    expect(
      geometry?.hiddenOverflowPx,
      `${promptId} card content is taller than the card (height constants out of sync with CSS)`
    ).toBe(0)
  }

  test('keeps moved prompt buttons under the cursor when move buttons reorder prompts', async ({
    testSetup
  }) => {
    await testSetup.setupFilesystem(buildMoveScrollWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(MOVE_SCROLL_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(MOVE_SCROLL_FOLDER_NAME)
    await scrollPromptEditorIntoView(mainWindow, testHelpers, BOUNDARY_2_ID)

    await mainWindow.locator(moveUpSelector(BOUNDARY_2_ID)).click()
    await expectNoCardInternalScroll(mainWindow, BOUNDARY_2_ID)

    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow))
      .toEqual([BOUNDARY_2_ID, BOUNDARY_1_ID, MOVE_ANCHOR_1_ID, MOVE_ANCHOR_2_ID, MOVE_ANCHOR_3_ID])

    const moveAnchorUpSelector = moveUpSelector(MOVE_ANCHOR_2_ID)
    await scrollUntilMounted(mainWindow, testHelpers, moveAnchorUpSelector)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      moveAnchorUpSelector,
      120
    )
    const moveUpTopBefore = await getElementTop(mainWindow, moveAnchorUpSelector)
    await mainWindow.locator(moveAnchorUpSelector).click()
    await expectNoCardInternalScroll(mainWindow, MOVE_ANCHOR_2_ID)

    await expect
      .poll(async () =>
        Math.abs(
          (await getElementTop(mainWindow, moveUpSelector(MOVE_ANCHOR_2_ID))) - moveUpTopBefore
        )
      )
      .toBeLessThanOrEqual(MOVE_BUTTON_POSITION_TOLERANCE_PX)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow))
      .toEqual([BOUNDARY_2_ID, BOUNDARY_1_ID, MOVE_ANCHOR_2_ID, MOVE_ANCHOR_1_ID, MOVE_ANCHOR_3_ID])

    const moveAnchorDownSelector = moveDownSelector(MOVE_ANCHOR_2_ID)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      moveAnchorDownSelector,
      120
    )

    const moveDownTopBefore = await getElementTop(mainWindow, moveAnchorDownSelector)
    await mainWindow.locator(moveAnchorDownSelector).click()
    await expectNoCardInternalScroll(mainWindow, MOVE_ANCHOR_2_ID)

    await expect
      .poll(async () =>
        Math.abs((await getElementTop(mainWindow, moveAnchorDownSelector)) - moveDownTopBefore)
      )
      .toBeLessThanOrEqual(MOVE_BUTTON_POSITION_TOLERANCE_PX)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow))
      .toEqual([BOUNDARY_2_ID, BOUNDARY_1_ID, MOVE_ANCHOR_1_ID, MOVE_ANCHOR_2_ID, MOVE_ANCHOR_3_ID])
  })

  test('preserves prompt order after navigating away', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-1')
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-2')

    // Step 1: add after first prompt, edit it.
    let expectedCount = 2
    const addPromptAfter = async (promptId: string) => {
      await clickAddAfter(mainWindow, testHelpers, promptId)
      expectedCount += 1
      await waitForPromptCount(mainWindow, expectedCount)
    }

    await addPromptAfter('dev-1')
    const orderAfterFirstAdd = await getPromptEditorIds(mainWindow)
    const firstNewPromptId = orderAfterFirstAdd.find((id) => id !== 'dev-1' && id !== 'dev-2')
    expect(firstNewPromptId).toBeTruthy()

    const firstPromptContent = { title: 'Inserted A', text: 'Inserted A text' }
    await setPromptTitle(mainWindow, firstNewPromptId!, firstPromptContent.title)
    await replacePromptText(mainWindow, firstNewPromptId!, firstPromptContent.text)

    // Steps 2-3: navigate away and back, confirm location + content.
    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-1')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    const orderAfterReturn = await getPromptEditorIds(mainWindow)
    expect(orderAfterReturn).toEqual(['dev-1', firstNewPromptId, 'dev-2'])
    await expectPromptContent(mainWindow, firstNewPromptId!, firstPromptContent)

    // Step 4: add three after the third prompt, then two between the first/second new prompts.
    await addPromptAfter('dev-2')
    await addPromptAfter('dev-2')
    await addPromptAfter('dev-2')

    const orderAfterThreeAdds = await getPromptEditorIds(mainWindow)
    const baseIds = new Set(['dev-1', 'dev-2', firstNewPromptId])
    const threeNewIds = orderAfterThreeAdds.filter((id) => !baseIds.has(id))
    expect(threeNewIds).toHaveLength(3)

    const firstOfThreeId = threeNewIds[0]
    await addPromptAfter(firstOfThreeId)
    await addPromptAfter(firstOfThreeId)

    const orderAfterFiveAdds = await getPromptEditorIds(mainWindow)
    const fiveNewIds = orderAfterFiveAdds.filter((id) => !baseIds.has(id))
    expect(fiveNewIds).toHaveLength(5)

    // Step 5: label each new prompt by its on-page order.
    const expectedById = new Map<string, { title: string; text: string }>()
    for (let i = 0; i < fiveNewIds.length; i += 1) {
      const promptId = fiveNewIds[i]
      const title = `Order ${i + 1}`
      const text = `Order text ${i + 1}`
      expectedById.set(promptId, { title, text })
      await setPromptTitle(mainWindow, promptId, title)
      await replacePromptText(mainWindow, promptId, text)
    }

    // Step 6: navigate away and back, verify order + contents.
    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await scrollPromptEditorIntoView(mainWindow, testHelpers, 'dev-2')

    const promptTreePromptIds = await getPromptTreePromptRowIds(mainWindow)
    const finalPromptTreeOrder = promptTreePromptIds.filter((promptId) =>
      fiveNewIds.includes(promptId)
    )
    expect(finalPromptTreeOrder).toEqual(fiveNewIds)

    for (const promptId of fiveNewIds) {
      const expected = expectedById.get(promptId)!
      const promptTreeRow = mainWindow.locator(`[data-testid="prompt-tree-prompt-${promptId}"]`)
      await expect(promptTreeRow).toBeVisible()
      await promptTreeRow.click()
      await expectPromptContent(mainWindow, promptId, expected)
    }
  })

  test('copies prompt text to clipboard', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(COPY_PREFIX_SUFFIX_WORKSPACE_PATH, [
        {
          folderName: 'Copy Prefix Suffix',
          displayName: 'Copy Prefix Suffix',
          folderSettings: {
            folderPrefix: 'Folder prefix text',
            folderSuffix: 'Folder suffix text'
          },
          prompts: [
            {
              id: 'copy-prefix-source',
              title: 'Copy Source',
              promptText: 'Source prompt'
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COPY_PREFIX_SUFFIX_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Copy Prefix Suffix')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('copy-prefix-source'))

    await stubClipboard(mainWindow)
    const sourceIndicator = mainWindow.locator(statusIndicatorSelector('copy-prefix-source'))
    await expect(sourceIndicator).toHaveAttribute('data-edited', 'false')
    await mainWindow
      .locator(`${promptEditorSelector('copy-prefix-source')} [data-testid="prompt-copy-button"]`)
      .click()
    await expect(mainWindow.locator(statusPillSelector('copy-prefix-source'))).toHaveText(
      'In Progress'
    )
    await expect(sourceIndicator).toHaveAttribute('data-edited', 'true')

    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'copy-prefix-source')
    await waitForPromptCount(mainWindow, 2)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const newPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))
    expect(newPromptId).toBeTruthy()

    const promptText = 'Copy line 1\nCopy line 2\nCopy line 3'
    await replacePromptText(mainWindow, newPromptId!, promptText)

    const copyButton = mainWindow.locator(
      `${promptEditorSelector(newPromptId!)} [data-testid="prompt-copy-button"]`
    )
    await copyButton.scrollIntoViewIfNeeded()
    await copyButton.click()

    // Normalize clipboard line endings so the assertion stays stable on Windows.
    const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, '\n')

    await expect
      .poll(async () => {
        const clipboardText = await mainWindow.evaluate(
          () => (window as any).__testClipboardText ?? ''
        )
        return normalizeNewlines(clipboardText)
      })
      .toBe(`Folder prefix text\n\n${promptText}\n\nFolder suffix text`)
    await expect(mainWindow.locator(statusPillSelector(newPromptId!))).toHaveText('In Progress')
    await expect(mainWindow.locator(statusPillSelector(newPromptId!))).toHaveAttribute(
      'data-variant',
      'in-progress'
    )
    await expect
      .poll(async () => {
        return await readPersistedPromptTextById(electronApp, {
          workspacePath: COPY_PREFIX_SUFFIX_WORKSPACE_PATH,
          folderName: 'Copy Prefix Suffix',
          promptId: newPromptId!,
          promptTitle: 'New Prompt'
        })
      })
      .toContain('status: InProgress')
  })

  test('completes a prompt by moving it into the completed folder', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(COMPLETION_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(COMPLETION_PROMPT_ID))

    const completedText = 'Completed prompt text saved from the latest draft.'
    await replacePromptText(mainWindow, COMPLETION_PROMPT_ID, completedText)
    await expectEditedIndicator(mainWindow, COMPLETION_PROMPT_ID)

    const completeButton = mainWindow.locator(completeSelector(COMPLETION_PROMPT_ID))
    await completeButton.scrollIntoViewIfNeeded()
    await completeButton.click()

    await expect(mainWindow.locator(promptEditorSelector(COMPLETION_PROMPT_ID))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 1)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow), { timeout: 5000 })
      .toEqual(['dev-2'])

    await expect
      .poll(
        async () => {
          const [originalFiles, completedFiles] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: SAMPLE_WORKSPACE_PATH,
              folderName: COMPLETION_FOLDER_NAME,
              promptId: COMPLETION_PROMPT_ID,
              promptTitle: COMPLETION_PROMPT_TITLE
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: SAMPLE_WORKSPACE_PATH,
              folderName: `${COMPLETION_FOLDER_NAME}/_Completed`,
              promptId: COMPLETION_PROMPT_ID,
              promptTitle: COMPLETION_PROMPT_TITLE
            })
          ])

          return { originalFiles, completedFiles }
        },
        { timeout: 8000 }
      )
      .toEqual({
        originalFiles: { markdownExists: false },
        completedFiles: { markdownExists: true }
      })

    const completedMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: SAMPLE_WORKSPACE_PATH,
      folderName: `${COMPLETION_FOLDER_NAME}/_Completed`,
      promptId: COMPLETION_PROMPT_ID,
      promptTitle: COMPLETION_PROMPT_TITLE
    })
    expect(completedMarkdown).toContain('status: Completed')
    expect(completedMarkdown).toContain('completedAt:')
    expect(completedMarkdown).toContain(completedText)
    expect(
      await readPromptFolderEntries(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/Prompts/${COMPLETION_FOLDER_NAME}/_FolderInfo/FolderOrder.json`
      )
    ).toEqual([{ kind: 'prompt', id: 'dev-2' }])

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(COMPLETION_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))
    expect(await getPromptEditorIds(mainWindow)).toEqual(['dev-2'])
  })

  test('self-heals completed frontmatter based on folder location', async ({
    testSetup,
    electronApp
  }) => {
    const folderName = 'Self Healing'
    const activePromptId = 'active-with-completed-flags'
    const activePromptTitle = 'Active Bad Flags'
    const completedPromptId = 'completed-without-flags'
    const completedPromptTitle = 'Completed Missing Flags'

    await testSetup.setupFilesystem(buildCompletedSelfHealingWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(SELF_HEALING_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(folderName)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(activePromptId))

    expect(await getPromptEditorIds(mainWindow)).toEqual([activePromptId])
    await expect(mainWindow.locator(promptEditorSelector(completedPromptId))).toHaveCount(0)
    expect(await getPromptTreePromptRowIds(mainWindow)).toEqual([activePromptId])

    const activeMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: SELF_HEALING_WORKSPACE_PATH,
      folderName,
      promptId: activePromptId,
      promptTitle: activePromptTitle
    })
    expect(activeMarkdown).toContain('status: Todo')
    expect(activeMarkdown).not.toContain('completedAt:')
    await expect
      .poll(
        async () =>
          await readPromptFolderEntries(
            electronApp,
            `${SELF_HEALING_WORKSPACE_PATH}/Prompts/${folderName}/_FolderInfo/FolderOrder.json`
          )
      )
      .toEqual([{ kind: 'prompt', id: activePromptId }])
    expect(activeMarkdown).toContain('This regular prompt should keep rendering.')

    const completedMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: SELF_HEALING_WORKSPACE_PATH,
      folderName: `${folderName}/_Completed`,
      promptId: completedPromptId,
      promptTitle: completedPromptTitle
    })
    expect(completedMarkdown).toContain('status: Completed')
    expect(completedMarkdown).toContain('completedAt:')
    expect(completedMarkdown).toContain('This completed prompt should stay hidden.')
  })

  test('rejects moving a completed prompt through IPC', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(buildCompletedModeWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMPLETED_MODE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()

    const moveResult = await mainWindow.evaluate(
      async ({ workspaceId, sourceFolderId, destinationFolderId, promptId }) => {
        const loadFolder = async (promptFolderId: string) => {
          return await window.electron.ipcRenderer.invoke('load-prompt-folder-initial', {
            requestId: `test-load-${promptFolderId}-${Date.now()}`,
            clientId: window.ipcClientId,
            payload: { workspaceId, promptFolderId }
          })
        }
        const sourceLoad = await loadFolder(sourceFolderId)
        const destinationLoad = await loadFolder(destinationFolderId)
        const sourcePromptFolder = sourceLoad.promptFolders.find(
          (folder: { id: string }) => folder.id === sourceFolderId
        )
        const destinationPromptFolder = destinationLoad.promptFolders.find(
          (folder: { id: string }) => folder.id === destinationFolderId
        )
        const prompt = sourceLoad.prompts.find(
          (candidate: { id: string }) => candidate.id === promptId
        )
        const toPayloadEntity = (snapshot: { id: string; revision: number; data: unknown }) => ({
          id: snapshot.id,
          expectedRevision: snapshot.revision,
          data: snapshot.data
        })

        return await window.electron.ipcRenderer.invoke('move-prompt', {
          requestId: `test-move-completed-${Date.now()}`,
          clientId: window.ipcClientId,
          payload: {
            sourcePromptFolder: toPayloadEntity(sourcePromptFolder),
            destinationPromptFolder: toPayloadEntity(destinationPromptFolder),
            content: toPayloadEntity(prompt),
            previousEntryId: null
          }
        })
      },
      {
        workspaceId: COMPLETED_MODE_WORKSPACE_ID,
        sourceFolderId: COMPLETED_MODE_FOLDER_ID,
        destinationFolderId: NO_COMPLETED_FOLDER_ID,
        promptId: 'completed-mode-newest'
      }
    )

    expect(moveResult.success).toBe(false)
    expect(moveResult.conflict).toBe(true)
    expect(
      await checkPersistedPromptFilesExistByTitle(electronApp, {
        workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
        folderName: 'Completed Mode/_Completed',
        promptId: 'completed-mode-newest',
        promptTitle: 'Newest Completed'
      })
    ).toEqual({ markdownExists: true })
    expect(
      await checkPersistedPromptFilesExistByTitle(electronApp, {
        workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
        folderName: 'No Completed',
        promptId: 'completed-mode-newest',
        promptTitle: 'Newest Completed'
      })
    ).toEqual({ markdownExists: false })
  })

  test('sets prompt statuses from the more options menu', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(buildCompletedModeWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMPLETED_MODE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()

    await testHelpers.navigateToPromptFolders('Completed Mode')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('completed-mode-active'))
    const activePromptStatus = mainWindow.locator(statusPillSelector('completed-mode-active'))
    await activePromptStatus.click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-in-progress"]')).toBeVisible()
    await activePromptStatus.click()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-more-options-menu"]')
    ).toHaveCount(0)
    await activePromptStatus.click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-option-in-progress"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-completed"]')).toBeVisible()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()

    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText(
      'In Progress'
    )
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveAttribute(
      'data-variant',
      'in-progress'
    )
    expect(await getPromptEditorIds(mainWindow)).toEqual(['completed-mode-active'])

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-option-in-progress"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toBeVisible()
    await mainWindow.locator('[data-testid="prompt-status-option-todo"]').click()
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText('Todo')

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toBeVisible()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText(
      'In Progress'
    )

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await mainWindow.locator('[data-testid="prompt-status-option-completed"]').click()
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual([])

    await expect
      .poll(
        async () => {
          const [activeFiles, completedFiles] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
              folderName: 'Completed Mode',
              promptId: 'completed-mode-active',
              promptTitle: 'Active Prompt'
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
              folderName: 'Completed Mode/_Completed',
              promptId: 'completed-mode-active',
              promptTitle: 'Active Prompt'
            })
          ])

          return { activeFiles, completedFiles }
        },
        { timeout: 8000 }
      )
      .toEqual({
        activeFiles: { markdownExists: false },
        completedFiles: { markdownExists: true }
      })
    const completedFromMenuMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
      folderName: 'Completed Mode/_Completed',
      promptId: 'completed-mode-active',
      promptTitle: 'Active Prompt'
    })
    expect(completedFromMenuMarkdown).toContain('status: Completed')
    expect(completedFromMenuMarkdown).toContain('completedAt:')

    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-active', 'completed-mode-newest', 'completed-mode-oldest'])

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-completed"]')).toBeVisible()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-newest', 'completed-mode-oldest'])

    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-active'])
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText(
      'In Progress'
    )

    await expect
      .poll(
        async () => {
          const [activeFiles, completedFiles] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
              folderName: 'Completed Mode',
              promptId: 'completed-mode-active',
              promptTitle: 'Active Prompt'
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
              folderName: 'Completed Mode/_Completed',
              promptId: 'completed-mode-active',
              promptTitle: 'Active Prompt'
            })
          ])

          return { activeFiles, completedFiles }
        },
        { timeout: 8000 }
      )
      .toEqual({
        activeFiles: { markdownExists: true },
        completedFiles: { markdownExists: false }
      })

    await expect
      .poll(async () => {
        return await readPersistedPromptTextById(electronApp, {
          workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
          folderName: 'Completed Mode',
          promptId: 'completed-mode-active',
          promptTitle: 'Active Prompt'
        })
      })
      .toContain('status: InProgress')
    const inProgressMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
      folderName: 'Completed Mode',
      promptId: 'completed-mode-active',
      promptTitle: 'Active Prompt'
    })
    expect(inProgressMarkdown).not.toContain('completedAt:')
  })

  test('shows completed prompts and uncompletes them back to the active folder', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildCompletedModeWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMPLETED_MODE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()

    await testHelpers.navigateToPromptFolders('Completed Mode')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('completed-mode-active'))
    expect(await getPromptEditorIds(mainWindow)).toEqual(['completed-mode-active'])
    expect(await getPromptTreePromptRowIds(mainWindow)).toEqual(['completed-mode-active'])
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText('Todo')
    const rootHeader = mainWindow.locator('[data-testid="prompt-folder-root-header"]')
    await expect(rootHeader).toContainText('Completed Mode')
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"] span')).toHaveText(
      '1'
    )
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"] span')
    ).toHaveText('2')
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-toggle-button-CompletedMode"]')
    ).toHaveCount(0)
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-newest', 'completed-mode-oldest'])
    expect(await getPromptTreePromptRowIds(mainWindow)).toEqual([
      'completed-mode-newest',
      'completed-mode-oldest'
    ])

    await expect(mainWindow.locator('[data-testid="prompt-folder-header-section"]')).toHaveText(
      'Completed Prompts'
    )
    const completedFolderTitle = mainWindow.locator('[data-testid="prompt-folder-root-header"]')
    await expect(completedFolderTitle).toBeVisible()
    await expect(completedFolderTitle).toContainText('Completed Mode')
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"] span')
    ).toHaveText('2')
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    const completedFolderTitleBox = await completedFolderTitle.boundingBox()
    const newestCompletedPromptBox = await mainWindow
      .locator(promptEditorSelector('completed-mode-newest'))
      .boundingBox()
    expect(completedFolderTitleBox).not.toBeNull()
    expect(newestCompletedPromptBox).not.toBeNull()
    expect(completedFolderTitleBox!.y + completedFolderTitleBox!.height).toBeLessThanOrEqual(
      newestCompletedPromptBox!.y + MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-new-prompt-button"]')
    ).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-editor-settings-toggle"]')
    ).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid^="prompt-folder-settings-section-"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid^="prompt-divider-add"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-drag-handle"]')).toHaveCount(0)
    await expect(mainWindow.locator(completeSelector('completed-mode-newest'))).toHaveCount(0)
    await expect(mainWindow.locator(uncompleteSelector('completed-mode-newest'))).toBeVisible()
    await expect(mainWindow.locator(statusPillSelector('completed-mode-newest'))).toHaveText(
      'Completed'
    )
    await expect(mainWindow.locator(statusPillSelector('completed-mode-newest'))).toHaveAttribute(
      'data-variant',
      'completed'
    )
    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-delete-button"]`
      )
    ).toBeVisible()
    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-completed-time"]`
      )
    ).toContainText('Completed')

    await mainWindow.locator('[data-testid="prompt-folder-find-button"]').click()
    await mainWindow
      .locator('[data-testid="prompt-find-input"]')
      .fill('Newest completed body marker')
    await expect(
      mainWindow.locator('[data-testid="prompt-find-widget"] .prompt-find-widget__matches')
    ).toHaveText('1 of 1')
    await mainWindow.keyboard.press('Escape')

    await mainWindow.locator(uncompleteSelector('completed-mode-newest')).click()
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-oldest'])
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"] span')).toHaveText(
      '2'
    )
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"] span')
    ).toHaveText('1')

    await mainWindow.locator('[data-testid="prompt-folder-active-filter"]').click()
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'false')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-newest', 'completed-mode-active'])
    await expect(mainWindow.locator(statusPillSelector('completed-mode-newest'))).toHaveText('Todo')
    expect(await getPromptTreePromptRowIds(mainWindow)).toEqual([
      'completed-mode-newest',
      'completed-mode-active'
    ])

    await expect
      .poll(
        async () => {
          const [activeFiles, completedFiles] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
              folderName: 'Completed Mode',
              promptId: 'completed-mode-newest',
              promptTitle: 'Newest Completed'
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
              folderName: 'Completed Mode/_Completed',
              promptId: 'completed-mode-newest',
              promptTitle: 'Newest Completed'
            })
          ])

          return { activeFiles, completedFiles }
        },
        { timeout: 8000 }
      )
      .toEqual({
        activeFiles: { markdownExists: true },
        completedFiles: { markdownExists: false }
      })

    const activeMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
      folderName: 'Completed Mode',
      promptId: 'completed-mode-newest',
      promptTitle: 'Newest Completed'
    })
    expect(activeMarkdown).toContain('status: Todo')
    expect(activeMarkdown).not.toContain('completedAt:')
    await expect
      .poll(
        async () =>
          await readPromptFolderEntries(
            electronApp,
            `${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/Completed Mode/_FolderInfo/FolderOrder.json`
          )
      )
      .toEqual([
        { kind: 'prompt', id: 'completed-mode-newest' },
        { kind: 'prompt', id: 'completed-mode-active' }
      ])

    await testHelpers.navigateToPromptFolders('No Completed')
    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect(mainWindow.locator('[data-testid="sidebar-add-prompt-button"]')).toBeDisabled()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-toggle-button-NoCompleted"]')
    ).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-empty-state"]')).toHaveText(
      'No completed prompts found in this folder'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toContainText(
      'No completed prompts found in this folder'
    )
    const emptyCompletedFolderTitle = mainWindow.locator(
      '[data-testid="prompt-folder-root-header"]'
    )
    await expect(emptyCompletedFolderTitle).toBeVisible()
    await expect(emptyCompletedFolderTitle).toContainText('No Completed')
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"] span')
    ).toHaveText('0')
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-editor-settings-toggle"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).not.toContainText(
      'Click the Add Prompt button'
    )
  })

  test('deletes prompts and keeps deletion after navigation', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    // Create an empty prompt, then delete it without the confirmation dialog.
    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'dev-1')
    await waitForPromptCount(mainWindow, 3)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const emptyPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))
    expect(emptyPromptId).toBeTruthy()

    const emptyDeleteSelector = `${promptEditorSelector(emptyPromptId!)} [data-testid="prompt-delete-button"]`
    await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, emptyDeleteSelector)
    const emptyDeleteButton = mainWindow.locator(emptyDeleteSelector)
    await emptyDeleteButton.click()
    await expect(mainWindow.locator('text=Delete Prompt')).toHaveCount(0)
    await expect(mainWindow.locator(promptEditorSelector(emptyPromptId!))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 2)

    // Delete a populated prompt and confirm the dialog flow.
    const deleteSelector = `${promptEditorSelector('dev-1')} [data-testid="prompt-delete-button"]`
    await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, deleteSelector)
    const deleteButton = mainWindow.locator(deleteSelector)
    await deleteButton.click()

    const dialog = mainWindow.locator('[role="dialog"][aria-label="Delete Prompt"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('text=Delete Prompt')).toBeVisible()

    await dialog.locator('button:has-text("Delete")').click()
    await expect(mainWindow.locator(promptEditorSelector('dev-1'))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 1)

    // Navigate away and back to ensure deletions persist.
    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    const idsAfterReturn = await getPromptEditorIds(mainWindow)
    expect(idsAfterReturn).toEqual(['dev-2'])
  })
})
