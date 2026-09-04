import type { Locator } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import {
  focusMonacoEditor,
  getMonacoEditorText,
  isMonacoEditorFocused,
  setMonacoSelections,
  typeInMonacoEditor,
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
  checkFileExists,
  checkPersistedPromptFilesExistByTitle,
  readTextFile,
  readPersistedPromptTextById,
  resolvePersistedPromptFilePathsByTitle
} from '../helpers/PromptPersistenceTestHelpers'
import { serializePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'
import { PromptStatus, type PromptPersisted } from '../../src/shared/Prompt'
import {
  beginPromptHandleDrag,
  beginPromptTreeRowDrag,
  finishActiveDrag,
  moveActiveDragToTarget,
  promptTreePromptDropIndicatorSelector,
  readPromptFolderEntries
} from '../helpers/PromptDragDropHelpers'
import { measureEditorCardGeometry } from '../helpers/CardGeometryHelpers'
import { runSqlQuery, runSqlStatement } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

// Resolves palette tokens through Chromium so CSS assertions use the browser's color format.
const resolvePaletteColors = async (locator: Locator, tokens: readonly string[]): Promise<string[]> =>
  await locator.evaluate((element, paletteTokens) => {
    return paletteTokens.map((token) => {
      // The temporary probe asks Chromium to compute one palette token as a color.
      const probe = document.createElement('span')
      probe.style.color = `var(${token})`
      element.appendChild(probe)
      // The computed color is stable across the fill and border properties under test.
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
  }, tokens)

const MOVE_SCROLL_WORKSPACE_PATH = '/ws/move-scroll-anchor'
const FALLBACK_TITLE_WORKSPACE_PATH = '/ws/fallback-title-management'
const COMPLETED_FALLBACK_GAP_WORKSPACE_PATH = '/ws/completed-fallback-gap'
const COPY_WORKSPACE_PATH = '/ws/copy-prompt'
const SAMPLE_WORKSPACE_PATH = '/ws/sample'
const SELF_HEALING_WORKSPACE_PATH = '/ws/completed-self-healing'
const COMPLETED_MODE_WORKSPACE_PATH = '/ws/completed-mode'
/** Workspace dedicated to persisted category semantics during cross-status drops. */
const STATUS_DRAG_CATEGORY_WORKSPACE_PATH = '/ws/status-drag-category'
const COMPLETED_MODE_WORKSPACE_ID = 'completed-mode-workspace'
const COMPLETED_MODE_FOLDER_ID = 'completed-mode-folder'
const NO_COMPLETED_FOLDER_ID = 'no-completed-folder'
/** Primary category retained when an Active prompt is completed. */
const STATUS_DRAG_PRIMARY_CATEGORY_ID = 'status-drag-primary-category'
/** Secondary category adopted at the selected Active-tree destination. */
const STATUS_DRAG_SECONDARY_CATEGORY_ID = 'status-drag-secondary-category'
const MOVE_SCROLL_FOLDER_NAME = 'Move Scroll Anchor'
const FALLBACK_TITLE_FOLDER_NAME = 'Fallback Titles'
const COMPLETED_FALLBACK_GAP_FOLDER_NAME = 'Completed Fallback Gap'
const COMPLETED_FALLBACK_GAP_FOLDER_ID = 'completed-fallback-gap-folder'
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
// Selector targets the quick action that moves an In Progress prompt back to Todo.
const previousStatusSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-previous-status-button"]`
const statusMoreOptionsSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-status-more-options-button"]`
const statusPillSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-status-pill"]`
const statusIndicatorSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-title-status-indicator"]`
/** Returns the accordion content selector for one sidebar prompt status. */
const sidebarPromptStatusContentSelector = (status: 'active' | 'completed' | 'archived') =>
  `[data-testid="sidebar-prompt-status-accordion-content-${status}"]`

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

const getPromptTreePromptRowIds = async (
  page: any,
  status: 'active' | 'completed' | 'archived' = 'active'
): Promise<string[]> => {
  /** Optional status-section root that prevents rows from the sibling tree joining the result. */
  const root = page.locator(sidebarPromptStatusContentSelector(status))
  /** Group prefix distinguishes rows even when multiple status trees are mounted. */
  const prefix = `prompt-tree-${status}-prompt-`
  return await root.locator(`[data-testid^="${prefix}"]`).evaluateAll(
    (elements: HTMLElement[], prefix: string) =>
      elements.map((element) => element.dataset.testid!.replace(prefix, '')),
    prefix
  )
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

const buildCompletedFallbackGapWorkspace = () => {
  const activePrompts = [
    { id: 'fallback-gap-base', fallbackTitle: 'New Prompt' },
    { id: 'fallback-gap-1', fallbackTitle: 'New Prompt 1' },
    { id: 'fallback-gap-2', fallbackTitle: 'New Prompt 2' },
    { id: 'fallback-gap-4', fallbackTitle: 'New Prompt 4' }
  ]
  const completedPrompt: PromptPersisted = {
    id: 'completed-fallback-gap-3',
    title: '',
    fallbackTitle: 'New Prompt 3',
    createdAt: '2023-01-02T00:00:00.000Z',
    modifiedAt: '2023-01-03T00:00:00.000Z',
    status: PromptStatus.Completed,
    finalizedAt: '2023-01-03T00:00:00.000Z',
    promptText: 'Completed prompts do not reserve active fallback titles.'
  }
  const workspace = createWorkspaceWithFolders(COMPLETED_FALLBACK_GAP_WORKSPACE_PATH, [
    {
      folderName: COMPLETED_FALLBACK_GAP_FOLDER_NAME,
      displayName: COMPLETED_FALLBACK_GAP_FOLDER_NAME,
      promptFolderId: COMPLETED_FALLBACK_GAP_FOLDER_ID,
      prompts: activePrompts.map((prompt) => ({
        ...prompt,
        title: '',
        promptText: `${prompt.fallbackTitle} is active.`
      }))
    }
  ])
  const completedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: COMPLETED_FALLBACK_GAP_WORKSPACE_PATH,
    folderName: `${COMPLETED_FALLBACK_GAP_FOLDER_NAME}/Completed`,
    promptId: completedPrompt.id,
    promptTitle: completedPrompt.fallbackTitle
  }).markdownPath

  workspace[
    `${COMPLETED_FALLBACK_GAP_WORKSPACE_PATH}/Prompts/${COMPLETED_FALLBACK_GAP_FOLDER_NAME}/Active/_FolderInfo/FolderOrder.json`
  ] = JSON.stringify(
    {
      categories: [
        {
          categoryId: null,
          entries: activePrompts.map((prompt) => ({ kind: 'prompt', id: prompt.id }))
        }
      ]
    },
    null,
    2
  )

  return {
    ...workspace,
    [`${COMPLETED_FALLBACK_GAP_WORKSPACE_PATH}/Prompts/${COMPLETED_FALLBACK_GAP_FOLDER_NAME}/Completed`]:
      null,
    [completedPath]: serializePromptMarkdown(completedPrompt)
  }
}

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
    finalizedAt: '2023-01-02T00:00:00Z'
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
    folderName: `${folderName}/Completed`,
    promptId: completedPrompt.id,
    promptTitle: completedPrompt.title
  }).markdownPath

  return {
    ...workspace,
    [`${SELF_HEALING_WORKSPACE_PATH}/Prompts/${folderName}/Active/_FolderInfo/FolderOrder.json`]:
      JSON.stringify(
        {
          categories: [
            {
              categoryId: null,
              entries: [{ kind: 'prompt', id: activePrompt.id }]
            }
          ]
        },
        null,
        2
      ),
    [`${SELF_HEALING_WORKSPACE_PATH}/Prompts/${folderName}/Completed`]: null,
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
    finalizedAt: '2023-01-05T00:00:00.000Z'
  }
  const oldestCompletedPrompt: PromptPersisted = {
    id: 'completed-mode-oldest',
    title: 'Oldest Completed',
    fallbackTitle: '',
    createdAt: '2023-01-03T00:00:00.000Z',
    modifiedAt: '2023-01-04T00:00:00.000Z',
    promptText: 'Oldest completed body marker.',
    status: PromptStatus.Completed,
    finalizedAt: '2023-01-04T00:00:00.000Z'
  }
  /** Newest archived prompt used to verify final-status ordering. */
  const newestArchivedPrompt: PromptPersisted = {
    id: 'archived-mode-newest',
    title: 'Newest Archived',
    fallbackTitle: '',
    createdAt: '2023-01-06T00:00:00.000Z',
    modifiedAt: '2023-01-08T00:00:00.000Z',
    promptText: 'Newest archived body marker.',
    status: PromptStatus.Archived,
    finalizedAt: '2023-01-08T00:00:00.000Z'
  }
  /** Oldest archived prompt used to verify final-status ordering. */
  const oldestArchivedPrompt: PromptPersisted = {
    id: 'archived-mode-oldest',
    title: 'Oldest Archived',
    fallbackTitle: '',
    createdAt: '2023-01-06T00:00:00.000Z',
    modifiedAt: '2023-01-07T00:00:00.000Z',
    promptText: 'Oldest archived body marker.',
    status: PromptStatus.Archived,
    finalizedAt: '2023-01-07T00:00:00.000Z'
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
    folderName: `${folderName}/Completed`,
    promptId: newestCompletedPrompt.id,
    promptTitle: newestCompletedPrompt.title
  }).markdownPath
  const oldestCompletedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
    folderName: `${folderName}/Completed`,
    promptId: oldestCompletedPrompt.id,
    promptTitle: oldestCompletedPrompt.title
  }).markdownPath
  /** Persisted path for the newest archived fixture prompt. */
  const newestArchivedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
    folderName: `${folderName}/Archived`,
    promptId: newestArchivedPrompt.id,
    promptTitle: newestArchivedPrompt.title
  }).markdownPath
  /** Persisted path for the oldest archived fixture prompt. */
  const oldestArchivedPath = resolvePersistedPromptFilePathsByTitle({
    workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
    folderName: `${folderName}/Archived`,
    promptId: oldestArchivedPrompt.id,
    promptTitle: oldestArchivedPrompt.title
  }).markdownPath

  workspace[`${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/${folderName}/Active/_FolderInfo/FolderOrder.json`] =
    JSON.stringify(
      {
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'prompt', id: activePrompt.id }]
          }
        ]
      },
      null,
      2
    )

  return {
    ...workspace,
    [`${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/${folderName}/Completed`]: null,
    [`${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/${folderName}/Archived`]: null,
    [newestCompletedPath]: serializePromptMarkdown(newestCompletedPrompt),
    [oldestCompletedPath]: serializePromptMarkdown(oldestCompletedPrompt),
    [newestArchivedPath]: serializePromptMarkdown(newestArchivedPrompt),
    [oldestArchivedPath]: serializePromptMarkdown(oldestArchivedPrompt)
  }
}

/** Builds status-tree drag fixtures with persisted prompts in two non-null categories. */
const buildStatusDragCategoryWorkspace = () => {
  /** Workspace structure populated with Active and Completed categorized prompts. */
  const workspace = createWorkspaceWithFolders(STATUS_DRAG_CATEGORY_WORKSPACE_PATH, [
    {
      folderName: 'Status Drag Categories',
      displayName: 'Status Drag Categories',
      prompts: [
        {
          id: 'status-drag-primary-first',
          title: 'Primary First',
          promptText: 'Primary prompt completed by dragging.',
          category: STATUS_DRAG_PRIMARY_CATEGORY_ID
        },
        {
          id: 'status-drag-primary-second',
          title: 'Primary Second',
          promptText: 'Primary prompt retained in Active.',
          category: STATUS_DRAG_PRIMARY_CATEGORY_ID
        },
        {
          id: 'status-drag-secondary-first',
          title: 'Secondary First',
          promptText: 'Secondary predecessor for restoration.',
          category: STATUS_DRAG_SECONDARY_CATEGORY_ID
        },
        {
          id: 'status-drag-completed',
          title: 'Categorized Completed',
          promptText: 'Completed prompt moved into Secondary.',
          status: PromptStatus.Completed,
          finalizedAt: '2023-01-05T00:00:00.000Z',
          category: STATUS_DRAG_PRIMARY_CATEGORY_ID
        }
      ]
    }
  ])
  workspace[
    `${STATUS_DRAG_CATEGORY_WORKSPACE_PATH}/Prompts/Status Drag Categories/Categories/Primary.category.json`
  ] = JSON.stringify(
    {
      id: STATUS_DRAG_PRIMARY_CATEGORY_ID,
      displayName: 'Primary',
      description: null
    },
    null,
    2
  )
  workspace[
    `${STATUS_DRAG_CATEGORY_WORKSPACE_PATH}/Prompts/Status Drag Categories/Categories/Secondary.category.json`
  ] = JSON.stringify(
    {
      id: STATUS_DRAG_SECONDARY_CATEGORY_ID,
      displayName: 'Secondary',
      description: null
    },
    null,
    2
  )
  return workspace
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

  test('does not let completed prompts reserve active fallback titles', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildCompletedFallbackGapWorkspace())
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(COMPLETED_FALLBACK_GAP_WORKSPACE_PATH)
    ])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(COMPLETED_FALLBACK_GAP_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('fallback-gap-2'))

    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'fallback-gap-2')
    await waitForPromptCount(mainWindow, 5)

    const newPromptId = (await getPromptEditorIds(mainWindow)).find(
      (promptId) => !initialIds.includes(promptId)
    )
    expect(newPromptId).toBeTruthy()
    const titleInput = mainWindow.locator(promptTitleSelector(newPromptId!))
    await expect(titleInput).toHaveAttribute('placeholder', 'New Prompt 3...')

    await expect
      .poll(
        async () => {
          const [firstAvailable, nextAfterVisibleGap] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_FALLBACK_GAP_WORKSPACE_PATH,
              folderName: COMPLETED_FALLBACK_GAP_FOLDER_NAME,
              promptId: newPromptId!,
              promptTitle: 'New Prompt 3'
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: COMPLETED_FALLBACK_GAP_WORKSPACE_PATH,
              folderName: COMPLETED_FALLBACK_GAP_FOLDER_NAME,
              promptId: newPromptId!,
              promptTitle: 'New Prompt 5'
            })
          ])
          return { firstAvailable, nextAfterVisibleGap }
        },
        { timeout: 8000 }
      )
      .toEqual({
        firstAvailable: { markdownExists: true },
        nextAfterVisibleGap: { markdownExists: false }
      })
    await expect(titleInput).toHaveAttribute('placeholder', 'New Prompt 3...')
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

  test('moves focus between the prompt title and Monaco with keyboard shortcuts', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await waitForMonacoEditor(mainWindow, editorSelector)

    const titleInput = mainWindow.locator(promptTitleSelector('dev-1'))
    await titleInput.focus()
    for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) {
      await titleInput.dispatchEvent('keydown', { key: 'Enter', [modifier]: true })
      await expect(titleInput).toBeFocused()
    }

    await mainWindow.keyboard.press('Tab')

    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)

    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.press('Shift+Tab')
    await expect(titleInput).toBeFocused()

    await titleInput.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 2))
    await mainWindow.keyboard.press('Tab')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)
    await mainWindow.keyboard.press('Shift+Tab')
    await expect(titleInput).toBeFocused()
    await expect
      .poll(async () =>
        titleInput.evaluate((input) => [input.selectionStart, input.selectionEnd])
      )
      .toEqual([2, 2])

    await mainWindow.keyboard.press('Tab')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('Shift+Tab')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)

    await setMonacoSelections(mainWindow, editorSelector, [
      {
        selectionStartLineNumber: 1,
        selectionStartColumn: 2,
        positionLineNumber: 1,
        positionColumn: 1
      }
    ])
    await mainWindow.keyboard.press('Shift+Tab')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)

    await setMonacoSelections(mainWindow, editorSelector, [
      {
        selectionStartLineNumber: 1,
        selectionStartColumn: 1,
        positionLineNumber: 1,
        positionColumn: 1
      },
      {
        selectionStartLineNumber: 1,
        selectionStartColumn: 2,
        positionLineNumber: 1,
        positionColumn: 2
      }
    ])
    await mainWindow.keyboard.press('Shift+Tab')
    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)

    await titleInput.focus()
    await mainWindow.keyboard.press('Enter')

    await expect
      .poll(async () => isMonacoEditorFocused(mainWindow, editorSelector), { timeout: 5000 })
      .toBe(true)
  })

  test('opens category creation from the sidebar without leaving Home', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await testHelpers.navigateToHomeScreen()
    const addCategoryButton = mainWindow.locator(
      '[data-testid="sidebar-add-category-button"]'
    )
    await expect(addCategoryButton).toBeEnabled()
    await expect(addCategoryButton).toHaveAttribute('title', 'Add Category')
    await expect(addCategoryButton.locator('svg')).toHaveClass(/lucide-folder-plus/)
    await addCategoryButton.click()

    const categoryDialog = mainWindow.locator('[role="dialog"][aria-label="Create Category"]')
    await expect(categoryDialog).toBeVisible()
    await categoryDialog
      .locator('[data-testid="create-category-name-input"]')
      .fill('Sidebar Category')
    await categoryDialog.locator('[data-testid="create-category-button"]').click()

    await expect(categoryDialog).toBeHidden()
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-category-toggle-button-SidebarCategory"]')
    ).toBeVisible()
  })

  test('does not refocus a created prompt when its virtual row remounts', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))

    await mainWindow.locator('[data-testid="prompt-divider-add-initial"]').click()
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
      mainWindow.locator(`[data-testid="prompt-tree-active-prompt-${newPromptId}"]`)
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

  test('adds prompts from either centered divider separator', async ({ testSetup }) => {
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
    // Read both separator colors for hover and keyboard-focus assertions.
    const readSeparatorColors = async () =>
      await dividerRow
        .locator('.cthulhuUiSeparator')
        .evaluateAll((separators) =>
          separators.map((separator) => getComputedStyle(separator).borderTopColor)
        )
    const separatorColorsBefore = await readSeparatorColors()

    await expect(dividerActions).toHaveCSS('opacity', '0')
    await expect(dividerActions).toHaveCSS('transition-property', 'opacity')
    await expect(dividerActions).toHaveCSS('transition-duration', '0.12s')
    await expect(dividerActions).toHaveCSS('transition-timing-function', 'ease')
    await expect(dividerRow.locator('.cthulhuUiSeparator')).toHaveCount(2)
    await expect(dividerButton).toHaveText('Add Prompt')
    await expect(dividerActions.getByRole('button')).toHaveCount(1)
    expect(dividerButtonBoxBefore).not.toBeNull()
    expect(dividerButtonIconBox).not.toBeNull()
    expect(dividerRowBox).not.toBeNull()
    expect(dividerActionsBox).not.toBeNull()
    expect(dividerButtonBoxBefore!.height).toBe(28)
    expect(dividerButtonIconBox!.height).toBe(13)
    expect(dividerRowBox!.height).toBe(28)
    expect(separatorHeights).toEqual([12, 12])
    const dividerButtonCenter = dividerButtonBoxBefore!.y + dividerButtonBoxBefore!.height / 2
    const dividerRowCenter = dividerRowBox!.y + dividerRowBox!.height / 2
    // Confirm the smaller separator hitboxes remain centered within the unchanged row.
    const separatorCenterOffsets = await dividerSeparators.evaluateAll(
      (separators, rowCenter) =>
        separators.map((separator) => {
          // Read each hitbox once so its center uses one geometry snapshot.
          const bounds = separator.getBoundingClientRect()
          return Math.abs(bounds.y + bounds.height / 2 - rowCenter)
        }),
      dividerRowCenter
    )
    expect(
      separatorCenterOffsets.every(
        (offset) => offset <= MOVE_BUTTON_POSITION_TOLERANCE_PX
      )
    ).toBe(true)
    expect(Math.abs(dividerButtonCenter - dividerRowCenter)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    const dividerActionsCenter = dividerActionsBox!.x + dividerActionsBox!.width / 2
    const dividerRowHorizontalCenter = dividerRowBox!.x + dividerRowBox!.width / 2
    expect(Math.abs(dividerActionsCenter - dividerRowHorizontalCenter)).toBeLessThanOrEqual(
      MOVE_BUTTON_POSITION_TOLERANCE_PX
    )
    await dividerButton.hover()
    await expect(dividerActions).toHaveCSS('opacity', '1')
    const accentSeparatorColor = await dividerRow.evaluate(() => {
      const reference = document.createElement('span')
      reference.style.backgroundColor = 'var(--ui-accent-normal-border)'
      document.body.append(reference)
      const color = getComputedStyle(reference).backgroundColor
      reference.remove()
      return color
    })
    await expect.poll(readSeparatorColors).toEqual([accentSeparatorColor, accentSeparatorColor])

    await dividerSeparators.first().hover()
    await expect.poll(readSeparatorColors).toEqual([accentSeparatorColor, accentSeparatorColor])

    await dividerRow.hover({ position: { x: 2, y: 2 } })
    await expect.poll(readSeparatorColors).toEqual(separatorColorsBefore)

    await dividerSeparators.last().hover()
    await expect.poll(readSeparatorColors).toEqual([accentSeparatorColor, accentSeparatorColor])
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
    await expect.poll(readSeparatorColors).toEqual(separatorColorsBefore)
    await dividerButton.focus()
    await expect(dividerActions).toHaveCSS('opacity', '1')
    await mainWindow.keyboard.press('Tab')
    await expect.poll(readSeparatorColors).toEqual([accentSeparatorColor, accentSeparatorColor])
    await mainWindow.keyboard.press('Shift+Tab')
    await mainWindow.keyboard.press('Shift+Tab')
    await expect(dividerSeparators.first()).toBeFocused()
    await expect.poll(readSeparatorColors).toEqual([accentSeparatorColor, accentSeparatorColor])
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
      const promptTreeRow = mainWindow.locator(`[data-testid="prompt-tree-active-prompt-${promptId}"]`)
      await expect(promptTreeRow).toBeVisible()
      await promptTreeRow.click()
      await expectPromptContent(mainWindow, promptId, expected)
    }
  })

  test('copies prompt text to clipboard', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(COPY_WORKSPACE_PATH, [
        {
          folderName: 'Copy Prompt',
          displayName: 'Copy Prompt',
          prompts: [
            {
              id: 'copy-source',
              title: 'Copy Source',
              promptText: 'Source prompt',
              templates: null
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COPY_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Copy Prompt')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('copy-source'))

    await stubClipboard(mainWindow)
    const sourceIndicator = mainWindow.locator(statusIndicatorSelector('copy-source'))
    await expect(sourceIndicator).toHaveAttribute('data-edited', 'false')
    await mainWindow
      .locator(`${promptEditorSelector('copy-source')} [data-testid="prompt-copy-button"]`)
      .click()
    await expect(mainWindow.locator(statusPillSelector('copy-source'))).toHaveText(
      'In Progress'
    )
    await expect(sourceIndicator).toHaveAttribute('data-edited', 'true')

    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'copy-source')
    await waitForPromptCount(mainWindow, 2)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const newPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))
    expect(newPromptId).toBeTruthy()

    const promptText = 'Copy line 1\nCopy line 2\nCopy line 3'
    await replacePromptText(mainWindow, newPromptId!, promptText)

    const copyButton = mainWindow.locator(
      `${promptEditorSelector(newPromptId!)} [data-testid="prompt-template-and-copy-button"]`
    )
    await copyButton.scrollIntoViewIfNeeded()
    await copyButton.click()
    await mainWindow
      .getByRole('dialog', { name: 'Quick Template Selection' })
      .locator('[data-testid="prompt-template-option-none"]')
      .click()

    // Normalize clipboard line endings so the assertion stays stable on Windows.
    const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, '\n')

    await expect
      .poll(async () => {
        const clipboardText = await mainWindow.evaluate(
          () => (window as any).__testClipboardText ?? ''
        )
        return normalizeNewlines(clipboardText)
      })
      .toBe(promptText)
    await expect(mainWindow.locator(statusPillSelector(newPromptId!))).toHaveText('In Progress')
    await expect(mainWindow.locator(statusPillSelector(newPromptId!))).toHaveAttribute(
      'data-variant',
      'in-progress'
    )
    await expect
      .poll(async () => {
        return await readPersistedPromptTextById(electronApp, {
          workspacePath: COPY_WORKSPACE_PATH,
          folderName: 'Copy Prompt',
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
              folderName: `${COMPLETION_FOLDER_NAME}/Completed`,
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
      folderName: `${COMPLETION_FOLDER_NAME}/Completed`,
      promptId: COMPLETION_PROMPT_ID,
      promptTitle: COMPLETION_PROMPT_TITLE
    })
    expect(completedMarkdown).toContain('status: Completed')
    expect(completedMarkdown).toContain('finalizedAt:')
    expect(completedMarkdown).toContain(completedText)
    expect(
      await readPromptFolderEntries(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/Prompts/${COMPLETION_FOLDER_NAME}/Active/_FolderInfo/FolderOrder.json`
      )
    ).toEqual([{ kind: 'prompt', id: 'dev-2' }])

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders(COMPLETION_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))
    expect(await getPromptEditorIds(mainWindow)).toEqual(['dev-2'])
  })

  test('self-heals status metadata based on folder location', async ({
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
    expect(activeMarkdown).not.toContain('finalizedAt:')
    await expect
      .poll(
        async () =>
          await readPromptFolderEntries(
            electronApp,
            `${SELF_HEALING_WORKSPACE_PATH}/Prompts/${folderName}/Active/_FolderInfo/FolderOrder.json`
          )
      )
      .toEqual([{ kind: 'prompt', id: activePromptId }])
    expect(activeMarkdown).toContain('This regular prompt should keep rendering.')

    const completedMarkdown = await readPersistedPromptTextById(electronApp, {
      workspacePath: SELF_HEALING_WORKSPACE_PATH,
      folderName: `${folderName}/Completed`,
      promptId: completedPromptId,
      promptTitle: completedPromptTitle
    })
    expect(completedMarkdown).toContain('status: Completed')
    expect(completedMarkdown).toContain('finalizedAt:')
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
        return await window.electron.ipcRenderer.invoke('move-prompt', {
          requestId: `test-move-completed-${Date.now()}`,
          clientId: window.ipcClientId,
          payload: {
            command: {
              sourcePromptFolderId: sourcePromptFolder.id,
              destinationPromptFolderId: destinationPromptFolder.id,
              contentId: prompt.id,
              previousEntryId: null,
              categoryId: null
            },
            expectations: [
              {
                entityType: 'promptFolder',
                id: sourcePromptFolder.id,
                expected: 'revision',
                revision: sourcePromptFolder.revision
              },
              {
                entityType: 'promptFolder',
                id: destinationPromptFolder.id,
                expected: 'revision',
                revision: destinationPromptFolder.revision
              },
              {
                entityType: 'prompt',
                id: prompt.id,
                expected: 'revision',
                revision: prompt.revision
              }
            ]
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
      moveResult.payload.snapshots.map(
        (snapshot: { entityType: string; id: string }) =>
          `${snapshot.entityType}:${snapshot.id}`
      )
    ).toEqual([
      `promptFolder:${COMPLETED_MODE_FOLDER_ID}`,
      `promptFolder:${NO_COMPLETED_FOLDER_ID}`,
      'prompt:completed-mode-newest'
    ])
    expect(
      await checkPersistedPromptFilesExistByTitle(electronApp, {
        workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
        folderName: 'Completed Mode/Completed',
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

  test('sets prompt statuses from the status control', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(buildCompletedModeWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMPLETED_MODE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()

    await testHelpers.navigateToPromptFolders('Completed Mode')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('completed-mode-active'))
    const activePromptStatus = mainWindow.locator(statusPillSelector('completed-mode-active'))
    // The selector segment exposes the corner rounding that changes with its adjacent actions.
    const activePromptStatusSelector = activePromptStatus.locator('..')
    const activePromptTreeRow = mainWindow.locator(
      '[data-testid="prompt-tree-active-prompt-completed-mode-active"]'
    )
    // The persistent tree accent exposes status and edited-state presentation for this prompt.
    const promptTreeStatusIndicator = activePromptTreeRow.locator('..').locator(
      '[data-testid="prompt-tree-status-indicator"]'
    )
    await expect(promptTreeStatusIndicator).toHaveAttribute('data-status', 'Todo')
    await expect(promptTreeStatusIndicator).toHaveAttribute('data-edited', 'false')
    await expect(promptTreeStatusIndicator).toHaveCSS('visibility', 'hidden')
    const todoTitleBox = await activePromptTreeRow
      .locator('.sidebarPromptTreeSettingsLabel')
      .boundingBox()
    if (!todoTitleBox) throw new Error('Missing Todo prompt tree title geometry')
    // The initial button geometry must remain unchanged as accent states change.
    const todoPromptTreeButtonBox = await activePromptTreeRow.boundingBox()
    if (!todoPromptTreeButtonBox) throw new Error('Missing Todo prompt tree button geometry')

    await typeInMonacoEditor(
      mainWindow,
      promptEditorSelector('completed-mode-active'),
      'edited tree accent'
    )
    await expect(promptTreeStatusIndicator).toHaveAttribute('data-edited', 'true')
    await expect(promptTreeStatusIndicator).toHaveCSS('visibility', 'visible')
    await expect(promptTreeStatusIndicator).toHaveCSS(
      'background-color',
      (await resolvePaletteColors(promptTreeStatusIndicator, ['--ui-info-strong-border']))[0]!
    )
    await expect
      .poll(async () => {
        return await readPersistedPromptTextById(electronApp, {
          workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
          folderName: 'Completed Mode',
          promptId: 'completed-mode-active',
          promptTitle: 'Active Prompt'
        })
      })
      .toContain('edited tree accent')
    // The Todo Complete button is the only quick action and occupies the trailing segment.
    const todoCompleteButton = mainWindow.locator(completeSelector('completed-mode-active'))
    await expect(todoCompleteButton).toBeVisible()
    await expect(mainWindow.locator(previousStatusSelector('completed-mode-active'))).toHaveCount(0)
    await expect(mainWindow.locator(uncompleteSelector('completed-mode-active'))).toHaveCount(0)
    // Todo segment boxes verify that Forward is directly right of the selector.
    const [todoStatusBox, todoCompleteBox] = await Promise.all([
      activePromptStatusSelector.boundingBox(),
      todoCompleteButton.boundingBox()
    ])
    expect(todoStatusBox).not.toBeNull()
    expect(todoCompleteBox).not.toBeNull()
    expect(
      Math.abs(todoStatusBox!.x + todoStatusBox!.width - todoCompleteBox!.x)
    ).toBeLessThanOrEqual(MOVE_BUTTON_POSITION_TOLERANCE_PX)
    await expect(activePromptStatusSelector).toHaveCSS('border-top-left-radius', '6px')
    await expect(activePromptStatusSelector).toHaveCSS('border-bottom-left-radius', '6px')
    await expect(activePromptStatusSelector).toHaveCSS('border-top-right-radius', '0px')
    await expect(activePromptStatusSelector).toHaveCSS('border-bottom-right-radius', '0px')
    await expect(todoCompleteButton).toHaveCSS('border-top-left-radius', '0px')
    await expect(todoCompleteButton).toHaveCSS('border-bottom-left-radius', '0px')
    await expect(todoCompleteButton).toHaveCSS('border-top-right-radius', '6px')
    await expect(todoCompleteButton).toHaveCSS('border-bottom-right-radius', '6px')
    await activePromptStatus.click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-in-progress"]')).toBeVisible()
    await activePromptStatus.click()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-more-options-menu"]')
    ).toHaveCount(0)
    await activePromptStatus.click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toHaveCount(0)
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
    await expect(promptTreeStatusIndicator).toHaveAttribute('data-status', 'InProgress')
    await expect(promptTreeStatusIndicator).toHaveCSS('visibility', 'visible')
    // The warning token comparison ensures the tree accent exactly matches the editor accent.
    const warningColor = (
      await resolvePaletteColors(promptTreeStatusIndicator, ['--ui-warning-icon-glyph'])
    )[0]!
    await expect(promptTreeStatusIndicator).toHaveCSS('background-color', warningColor)
    // The In Progress presentation verifies the full-row line.
    const inProgressIndicatorPresentation = await promptTreeStatusIndicator.evaluate((element) => {
      // Browser-computed geometry captures the line within its prompt-tree row.
      const indicatorRect = element.getBoundingClientRect()
      const rowRect = element.parentElement!.getBoundingClientRect()
      return {
        height: indicatorRect.height,
        rowHeight: rowRect.height,
        rowLeft: rowRect.left,
        left: indicatorRect.left,
        width: indicatorRect.width
      }
    })
    expect(inProgressIndicatorPresentation.height).toBe(inProgressIndicatorPresentation.rowHeight)
    expect(inProgressIndicatorPresentation.left).toBe(inProgressIndicatorPresentation.rowLeft)
    expect(inProgressIndicatorPresentation.width).toBe(2)
    // In Progress no longer adds a trailing icon or changes the button's clickable geometry.
    const inProgressTitleBox = await activePromptTreeRow
      .locator('.sidebarPromptTreeSettingsLabel')
      .boundingBox()
    const inProgressPromptTreeButtonBox = await activePromptTreeRow.boundingBox()
    if (!inProgressTitleBox) throw new Error('Missing In Progress prompt tree title geometry')
    if (!inProgressPromptTreeButtonBox) {
      throw new Error('Missing In Progress prompt tree button geometry')
    }
    expect(Math.abs(inProgressTitleBox.x - todoTitleBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(inProgressTitleBox.width - todoTitleBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(inProgressPromptTreeButtonBox.x - todoPromptTreeButtonBox.x)).toBeLessThanOrEqual(
      1
    )
    expect(
      Math.abs(inProgressPromptTreeButtonBox.width - todoPromptTreeButtonBox.width)
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(inProgressPromptTreeButtonBox.height - todoPromptTreeButtonBox.height)
    ).toBeLessThanOrEqual(1)
    expect(await getPromptEditorIds(mainWindow)).toEqual(['completed-mode-active'])

    // In Progress places Backward left and Forward right of the selector.
    const inProgressCompleteButton = mainWindow.locator(completeSelector('completed-mode-active'))
    // The previous-status button is the leading segment.
    const inProgressPreviousButton = mainWindow.locator(
      previousStatusSelector('completed-mode-active')
    )
    // Segment boxes verify left-to-right placement within the joined control.
    const [inProgressPreviousBox, inProgressStatusBox, inProgressCompleteBox] = await Promise.all([
      inProgressPreviousButton.boundingBox(),
      activePromptStatusSelector.boundingBox(),
      inProgressCompleteButton.boundingBox()
    ])
    expect(inProgressCompleteBox).not.toBeNull()
    expect(inProgressStatusBox).not.toBeNull()
    expect(inProgressPreviousBox).not.toBeNull()
    expect(
      inProgressPreviousBox!.x + inProgressPreviousBox!.width - inProgressStatusBox!.x
    ).toBeGreaterThan(0)
    expect(
      Math.abs(
        inProgressPreviousBox!.x +
          inProgressPreviousBox!.width -
          inProgressStatusBox!.x -
          1
      )
    ).toBeLessThanOrEqual(MOVE_BUTTON_POSITION_TOLERANCE_PX)
    expect(
      inProgressStatusBox!.x + inProgressStatusBox!.width - inProgressCompleteBox!.x
    ).toBeGreaterThan(0)
    expect(
      Math.abs(
        inProgressStatusBox!.x +
          inProgressStatusBox!.width -
          inProgressCompleteBox!.x -
          1
      )
    ).toBeLessThanOrEqual(MOVE_BUTTON_POSITION_TOLERANCE_PX)
    await expect(activePromptStatusSelector).toHaveCSS('border-top-left-radius', '0px')
    await expect(activePromptStatusSelector).toHaveCSS('border-bottom-left-radius', '0px')
    await expect(activePromptStatusSelector).toHaveCSS('border-top-right-radius', '0px')
    await expect(activePromptStatusSelector).toHaveCSS('border-bottom-right-radius', '0px')
    await expect(inProgressPreviousButton).toHaveCSS('border-top-left-radius', '6px')
    await expect(inProgressPreviousButton).toHaveCSS('border-bottom-left-radius', '6px')
    await expect(inProgressPreviousButton).toHaveCSS('border-top-right-radius', '0px')
    await expect(inProgressPreviousButton).toHaveCSS('border-bottom-right-radius', '0px')
    await expect(activePromptStatusSelector).toHaveCSS('margin-left', '-1px')
    await expect(inProgressCompleteButton).toHaveCSS('border-top-left-radius', '0px')
    await expect(inProgressCompleteButton).toHaveCSS('border-bottom-left-radius', '0px')
    await expect(inProgressCompleteButton).toHaveCSS('border-top-right-radius', '6px')
    await expect(inProgressCompleteButton).toHaveCSS('border-bottom-right-radius', '6px')
    await expect(inProgressCompleteButton).toHaveCSS('margin-left', '-1px')
    // These palette colors verify resting ownership and standard IconButton hover treatments.
    const [
      neutralBorder,
      neutralHoverFill,
      neutralHoverBorder,
      successHoverFill,
      successHoverBorder
    ] = await resolvePaletteColors(activePromptStatusSelector, [
      '--ui-neutral-normal-border',
      '--ui-neutral-action-fill',
      '--ui-neutral-hover-border',
      '--ui-success-action-hover-fill',
      '--ui-success-muted-hover-border'
    ])
    await expect(inProgressPreviousButton).toHaveCSS(
      'border-right-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect(inProgressPreviousButton).toHaveCSS('border-right-style', 'solid')
    await expect(inProgressPreviousButton).toHaveCSS('border-right-width', '1px')
    await expect(activePromptStatusSelector).toHaveCSS('border-left-color', neutralBorder)
    await expect(activePromptStatusSelector).toHaveCSS('border-left-style', 'solid')
    await expect(activePromptStatusSelector).toHaveCSS('border-left-width', '1px')
    await expect(inProgressCompleteButton).toHaveCSS(
      'border-left-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect(inProgressCompleteButton).toHaveCSS('border-left-style', 'solid')
    await expect(inProgressCompleteButton).toHaveCSS('border-left-width', '1px')
    await expect(activePromptStatusSelector).toHaveCSS('border-right-color', neutralBorder)
    await expect(activePromptStatusSelector).toHaveCSS('border-right-style', 'solid')
    await expect(activePromptStatusSelector).toHaveCSS('border-right-width', '1px')
    await inProgressPreviousButton.hover()
    await expect(inProgressPreviousButton).toHaveCSS('background-color', neutralHoverFill)
    await expect(inProgressPreviousButton).toHaveCSS('border-top-color', neutralHoverBorder)
    await expect(inProgressPreviousButton).toHaveCSS('border-right-color', neutralHoverBorder)
    await expect(inProgressPreviousButton).toHaveCSS('border-right-style', 'solid')
    await expect(inProgressPreviousButton).toHaveCSS('border-right-width', '1px')
    await expect(activePromptStatusSelector).toHaveCSS(
      'border-left-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect(activePromptStatusSelector).toHaveCSS('border-left-style', 'solid')
    await expect(activePromptStatusSelector).toHaveCSS('border-left-width', '1px')
    await expect(inProgressPreviousButton).toHaveCSS('z-index', '1')
    await expect(activePromptStatusSelector).toHaveCSS('z-index', 'auto')
    await inProgressCompleteButton.hover()
    await expect(inProgressCompleteButton).toHaveCSS('background-color', successHoverFill)
    await expect(inProgressCompleteButton).toHaveCSS('border-top-color', successHoverBorder)
    await expect(inProgressCompleteButton).toHaveCSS('border-left-color', successHoverBorder)
    await expect(inProgressCompleteButton).toHaveCSS('border-left-style', 'solid')
    await expect(inProgressCompleteButton).toHaveCSS('border-left-width', '1px')
    await expect(activePromptStatusSelector).toHaveCSS(
      'border-right-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect(activePromptStatusSelector).toHaveCSS('border-right-style', 'solid')
    await expect(activePromptStatusSelector).toHaveCSS('border-right-width', '1px')
    await expect(inProgressCompleteButton).toHaveCSS('z-index', '1')
    await expect(activePromptStatusSelector).toHaveCSS('z-index', 'auto')
    await activePromptStatus.hover()
    await expect(activePromptStatusSelector).toHaveCSS('border-left-color', neutralHoverBorder)
    await expect(activePromptStatusSelector).toHaveCSS('border-right-color', neutralHoverBorder)
    await expect(inProgressPreviousButton).toHaveCSS(
      'border-right-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect(inProgressCompleteButton).toHaveCSS(
      'border-left-color',
      'rgba(0, 0, 0, 0)'
    )
    await expect(activePromptStatusSelector).toHaveCSS('z-index', '1')
    await expect(mainWindow.locator(uncompleteSelector('completed-mode-active'))).toHaveCount(0)

    await inProgressPreviousButton.click()
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText('Todo')
    await expect(promptTreeStatusIndicator).toHaveAttribute('data-status', 'Todo')
    await expect(promptTreeStatusIndicator).toHaveCSS(
      'background-color',
      (await resolvePaletteColors(promptTreeStatusIndicator, ['--ui-info-strong-border']))[0]!
    )
    await expect(mainWindow.locator(previousStatusSelector('completed-mode-active'))).toHaveCount(0)
    await expect(activePromptStatusSelector).toHaveCSS('border-top-left-radius', '6px')
    await expect(activePromptStatusSelector).toHaveCSS('border-bottom-left-radius', '6px')
    await expect(activePromptStatusSelector).toHaveCSS('border-top-right-radius', '0px')
    await expect(activePromptStatusSelector).toHaveCSS('border-bottom-right-radius', '0px')
    await expect
      .poll(async () => {
        return await readPersistedPromptTextById(electronApp, {
          workspacePath: COMPLETED_MODE_WORKSPACE_PATH,
          folderName: 'Completed Mode',
          promptId: 'completed-mode-active',
          promptTitle: 'Active Prompt'
        })
      })
      .toContain('status: Todo')

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-status-option-completed"]')).toBeVisible()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()
    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText(
      'In Progress'
    )

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-option-in-progress"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toBeVisible()
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
              folderName: 'Completed Mode/Completed',
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
      folderName: 'Completed Mode/Completed',
      promptId: 'completed-mode-active',
      promptTitle: 'Active Prompt'
    })
    expect(completedFromMenuMarkdown).toContain('status: Completed')
    expect(completedFromMenuMarkdown).toContain('finalizedAt:')

    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-active', 'completed-mode-newest', 'completed-mode-oldest'])
    /** Completion moves the accent into the Completed tree's namespace. */
    const completedTreeStatusIndicator = mainWindow
      .locator('[data-testid="prompt-tree-completed-prompt-completed-mode-active"]')
      .locator('..')
      .locator('[data-testid="prompt-tree-status-indicator"]')
    await expect(completedTreeStatusIndicator).toHaveAttribute('data-status', 'Completed')
    await expect(completedTreeStatusIndicator).toHaveCSS(
      'background-color',
      (await resolvePaletteColors(completedTreeStatusIndicator, ['--ui-success-normal-text']))[0]!
    )

    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(mainWindow.locator('[data-testid="prompt-status-option-completed"]')).toHaveCount(
      0
    )
    await expect(mainWindow.locator('[data-testid="prompt-status-option-todo"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-option-in-progress"]')
    ).toBeVisible()
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
              folderName: 'Completed Mode/Completed',
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
    expect(inProgressMarkdown).not.toContain('finalizedAt:')
  })

  test('restores a finalized prompt into an empty category with unique group row IDs', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildStatusDragCategoryWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(STATUS_DRAG_CATEGORY_WORKSPACE_PATH)])
    /** Window and navigation helpers for the categorized workflow fixture. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Status Drag Categories')
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()

    /** Existing finalized row accepts both prompts so Primary becomes empty. */
    const completedTarget = '[data-testid="prompt-tree-completed-prompt-status-drag-completed"]'
    for (const promptId of ['status-drag-primary-first', 'status-drag-primary-second']) {
      await beginPromptTreeRowDrag(mainWindow, promptId)
      await moveActiveDragToTarget(mainWindow, completedTarget)
      await finishActiveDrag(mainWindow)
      await expect(mainWindow.locator(`[data-testid="prompt-tree-active-prompt-${promptId}"]`)).toHaveCount(0)
      await expect(mainWindow.locator(`[data-testid="prompt-tree-completed-prompt-${promptId}"]`)).toHaveCount(1)
    }

    /** An empty category remains a visible, uniquely identified prompt destination. */
    const primaryCategory = '[data-testid="prompt-tree-active-category-toggle-button-Primary"]'
    await expect(mainWindow.locator(primaryCategory)).toHaveCount(1)
    await beginPromptTreeRowDrag(mainWindow, 'status-drag-completed', 'completed')
    await moveActiveDragToTarget(mainWindow, primaryCategory, 'bottom')
    await finishActiveDrag(mainWindow)
    await expect(mainWindow.locator(completedTarget)).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-status-drag-completed"]')).toHaveCount(1)

    /** Persisted prompt must use the destination group's entry status and category. */
    const restoredPath = `${STATUS_DRAG_CATEGORY_WORKSPACE_PATH}/Prompts/Status Drag Categories/Active/Categorized Completed.prompt.md`
    await expect.poll(() => readTextFile(electronApp, restoredPath)).toContain('status: Todo')
    await expect.poll(() => readTextFile(electronApp, restoredPath)).toContain(`category: ${STATUS_DRAG_PRIMARY_CATEGORY_ID}`)
    /** Empty destination gets exactly the restored prompt as its first ordered entry. */
    const orderPath = `${STATUS_DRAG_CATEGORY_WORKSPACE_PATH}/Prompts/Status Drag Categories/Active/_FolderInfo/FolderOrder.json`
    await expect.poll(async () => {
      /** Saved category order proves the transfer used the category target. */
      const order = JSON.parse(await readTextFile(electronApp, orderPath)) as {
        categories: Array<{ categoryId: string | null; entries: Array<{ kind: string; id: string }> }>
      }
      return order.categories.find((category) => category.categoryId === STATUS_DRAG_PRIMARY_CATEGORY_ID)?.entries
    }).toEqual([{ kind: 'prompt', id: 'status-drag-completed' }])
  })

  test('persists category and exact order changes across status-tree drops', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildStatusDragCategoryWorkspace())
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(STATUS_DRAG_CATEGORY_WORKSPACE_PATH)
    ])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Status Drag Categories')
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()

    /** Completed row accepting a category-preserving completion drop. */
    const completedTargetSelector = `${sidebarPromptStatusContentSelector('completed')} [data-testid="prompt-tree-completed-prompt-status-drag-completed"]`
    await beginPromptTreeRowDrag(mainWindow, 'status-drag-primary-first')
    await moveActiveDragToTarget(mainWindow, completedTargetSelector)
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'completed'))
      .toEqual(['status-drag-primary-first', 'status-drag-completed'])
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () =>
        await readPersistedPromptTextById(electronApp, {
          workspacePath: STATUS_DRAG_CATEGORY_WORKSPACE_PATH,
          folderName: 'Status Drag Categories/Completed',
          promptId: 'status-drag-primary-first',
          promptTitle: 'Primary First'
        })
      )
      .toContain(`category: ${STATUS_DRAG_PRIMARY_CATEGORY_ID}`)

    /** Secondary prompt row whose bottom edge defines the restored prompt's predecessor. */
    const secondaryTargetSelector = `${sidebarPromptStatusContentSelector('active')} [data-testid="prompt-tree-active-prompt-status-drag-secondary-first"]`
    await beginPromptTreeRowDrag(mainWindow, 'status-drag-completed', 'completed')
    await moveActiveDragToTarget(mainWindow, secondaryTargetSelector, 'bottom')
    await finishActiveDrag(mainWindow)

    /** Persisted category order used to verify both ownership and exact predecessor placement. */
    const categoryOrderPath = `${STATUS_DRAG_CATEGORY_WORKSPACE_PATH}/Prompts/Status Drag Categories/Active/_FolderInfo/FolderOrder.json`
    await expect
      .poll(async () => {
        /** Current persisted groups after the Completed-to-Active transaction settles. */
        const categoryOrder = JSON.parse(await readTextFile(electronApp, categoryOrderPath)) as {
          categories: Array<{
            categoryId: string | null
            entries: Array<{ kind: 'prompt'; id: string }>
          }>
        }
        return {
          primary: categoryOrder.categories.find(
            (category) => category.categoryId === STATUS_DRAG_PRIMARY_CATEGORY_ID
          )?.entries,
          secondary: categoryOrder.categories.find(
            (category) => category.categoryId === STATUS_DRAG_SECONDARY_CATEGORY_ID
          )?.entries
        }
      })
      .toEqual({
        primary: [{ kind: 'prompt', id: 'status-drag-primary-second' }],
        secondary: [
          { kind: 'prompt', id: 'status-drag-secondary-first' },
          { kind: 'prompt', id: 'status-drag-completed' }
        ]
      })
    await expect
      .poll(async () =>
        await readPersistedPromptTextById(electronApp, {
          workspacePath: STATUS_DRAG_CATEGORY_WORKSPACE_PATH,
          folderName: 'Status Drag Categories',
          promptId: 'status-drag-completed',
          promptTitle: 'Categorized Completed'
        })
      )
      .toContain(`category: ${STATUS_DRAG_SECONDARY_CATEGORY_ID}`)
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('drags prompt rows and editor cards between expanded status trees', async ({
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
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()
    await waitForMonacoEditor(mainWindow, promptEditorSelector('completed-mode-newest'))

    /** Active accordion header used to verify headers and collapsed sections reject drops. */
    const activeHeader = mainWindow.locator(
      '[data-testid="sidebar-prompt-status-accordion-header-active"]'
    )
    /** Active section content containing the destination tree but excluding its header. */
    const activeContent = mainWindow.locator(sidebarPromptStatusContentSelector('active'))
    /** Completed row used as an order-independent completion target. */
    const completedPromptRowSelector = `${sidebarPromptStatusContentSelector('completed')} [data-testid="prompt-tree-completed-prompt-completed-mode-oldest"]`

    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-drag-handle"]`
      )
    ).toBeVisible()
    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-move-up"]`
      )
    ).toHaveCount(0)
    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-move-down"]`
      )
    ).toHaveCount(0)

    await beginPromptTreeRowDrag(mainWindow, 'completed-mode-oldest', 'completed')
    await moveActiveDragToTarget(
      mainWindow,
      `${sidebarPromptStatusContentSelector('completed')} [data-testid="prompt-tree-completed-prompt-completed-mode-newest"]`
    )
    await finishActiveDrag(mainWindow)
    expect(await getPromptTreePromptRowIds(mainWindow, 'completed')).toEqual([
      'completed-mode-newest',
      'completed-mode-oldest'
    ])

    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'false')
    await beginPromptHandleDrag(mainWindow, 'completed-mode-newest')
    await moveActiveDragToTarget(
      mainWindow,
      '[data-testid="sidebar-prompt-status-accordion-header-active"]'
    )
    await expect(mainWindow.locator('[data-drop-indicator-active="true"]')).toHaveCount(0)
    await finishActiveDrag(mainWindow)
    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')

    await beginPromptHandleDrag(mainWindow, 'completed-mode-newest')
    await moveActiveDragToTarget(
      mainWindow,
      '[data-testid="sidebar-prompt-status-accordion-header-active"]'
    )
    /** First-row indicator snapped through the expanded accordion header. */
    const activeIndicator = activeContent.locator(
      `${promptTreePromptDropIndicatorSelector('completed-mode-active')}[data-edge="top"]`
    )
    await expect(activeIndicator).toBeVisible()
    const [activeIndicatorBox, activeContentBox, activeHeaderBox] = await Promise.all([
      activeIndicator.boundingBox(),
      activeContent.boundingBox(),
      activeHeader.boundingBox()
    ])
    expect(activeIndicatorBox).not.toBeNull()
    expect(activeContentBox).not.toBeNull()
    expect(activeHeaderBox).not.toBeNull()
    expect(activeIndicatorBox!.y).toBeLessThan(activeContentBox!.y)
    expect(activeIndicatorBox!.y).toBeGreaterThanOrEqual(activeHeaderBox!.y)
    await expect(activeContent).toHaveCSS('overflow', 'visible')
    await expect(activeContent).toHaveCSS('z-index', '2')
    await finishActiveDrag(mainWindow)

    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'active'))
      .toEqual(['completed-mode-newest', 'completed-mode-active'])
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () =>
        await readPromptFolderEntries(
          electronApp,
          `${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/Completed Mode/Active/_FolderInfo/FolderOrder.json`
        )
      )
      .toEqual([
        { kind: 'prompt', id: 'completed-mode-newest' },
        { kind: 'prompt', id: 'completed-mode-active' }
      ])

    await beginPromptTreeRowDrag(mainWindow, 'completed-mode-active')
    await moveActiveDragToTarget(mainWindow, completedPromptRowSelector)
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'active'))
      .toEqual(['completed-mode-newest'])
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'completed'))
      .toEqual(['completed-mode-active', 'completed-mode-oldest'])
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')

    await mainWindow.locator('[data-testid="prompt-folder-active-filter"]').click()
    await waitForMonacoEditor(mainWindow, promptEditorSelector('completed-mode-newest'))
    await beginPromptHandleDrag(mainWindow, 'completed-mode-newest')
    await moveActiveDragToTarget(mainWindow, completedPromptRowSelector)
    await finishActiveDrag(mainWindow)
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-active-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-empty-status"]')
    ).toBeVisible()
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'completed'))
      .toEqual([
        'completed-mode-newest',
        'completed-mode-active',
        'completed-mode-oldest'
      ])

    await beginPromptTreeRowDrag(mainWindow, 'completed-mode-oldest', 'completed')
    await moveActiveDragToTarget(
      mainWindow,
      '[data-testid="prompt-tree-active-empty-status"]'
    )
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'active'))
      .toEqual(['completed-mode-oldest'])
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-active-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.locator(statusPillSelector('completed-mode-oldest'))).toHaveText('Todo')
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
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-section-completed"]')
    ).toHaveCount(0)
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-active"]')
        .locator('.cthulhuUiAccordionCount')
    ).toHaveText('1')

    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    /** Rendered status sections in their required Completed-before-Active order. */
    const statusSections = mainWindow.locator(
      '[data-testid^="sidebar-prompt-status-accordion-section-"]'
    )
    await expect(statusSections).toHaveCount(2)
    expect(
      await statusSections.evaluateAll((sections) =>
        sections.map((section) => section.dataset.testid)
      )
    ).toEqual([
      'sidebar-prompt-status-accordion-section-completed',
      'sidebar-prompt-status-accordion-section-active'
    ])
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-completed"]')
        .locator('.cthulhuUiAccordionCount')
    ).toHaveText('2')
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-active"]')
        .locator('.cthulhuUiAccordionCount')
    ).toHaveText('1')
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-completed"]')
        .locator('.cthulhuUiAccordionIcon')
    ).toHaveClass(/lucide-circle-check-big/)
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-active"]')
        .locator('.cthulhuUiAccordionIcon')
    ).toHaveClass(/lucide-list-todo/)
    // The selected root folder is not duplicated as a category in completed mode.
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-category-toggle-button-CompletedMode"]')
    ).toHaveCount(0)
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-newest', 'completed-mode-oldest'])
    expect(await getPromptTreePromptRowIds(mainWindow, 'completed')).toEqual([
      'completed-mode-newest',
      'completed-mode-oldest'
    ])
    /** Active row used to verify status-tree mode navigation. */
    const activeTreePrompt = mainWindow.locator(
      `${sidebarPromptStatusContentSelector('active')} [data-testid="prompt-tree-active-prompt-completed-mode-active"]`
    )
    /** Completed row used to verify status-tree mode navigation. */
    const completedTreePrompt = mainWindow.locator(
      `${sidebarPromptStatusContentSelector('completed')} [data-testid="prompt-tree-completed-prompt-completed-mode-newest"]`
    )

    await activeTreePrompt.click()
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    await expect(mainWindow.locator('[data-testid][data-row-state="active"]')).toHaveCount(1)
    await completedTreePrompt.click()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.locator('[data-testid][data-row-state="active"]')).toHaveCount(1)

    await expect(mainWindow.locator('[data-testid="prompt-folder-header-section"]')).toHaveText(
      'Completed'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-category"]')).toHaveCount(0)
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
      mainWindow.locator('[data-testid="category-editor-settings-toggle"]')
    ).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid^="category-description-section"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid^="prompt-divider-add"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-drag-handle"]')).toHaveCount(2)
    await expect(mainWindow.locator('[data-testid="prompt-move-up"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-move-down"]')).toHaveCount(0)
    await expect(mainWindow.locator(completeSelector('completed-mode-newest'))).toHaveCount(0)
    await expect(mainWindow.locator(uncompleteSelector('completed-mode-newest'))).toBeVisible()
    await expect(mainWindow.locator(previousStatusSelector('completed-mode-newest'))).toHaveCount(0)
    // With Uncomplete leading, the Completed selector owns the rounded right edge.
    const completedStatusSelector = mainWindow
      .locator(statusPillSelector('completed-mode-newest'))
      .locator('..')
    // The Uncomplete segment must touch the selector's left edge.
    const completedUncompleteButton = mainWindow.locator(
      uncompleteSelector('completed-mode-newest')
    )
    // Joined segment boxes verify that Uncomplete is on the left without a gap.
    const [completedUncompleteBox, completedStatusBox] = await Promise.all([
      completedUncompleteButton.boundingBox(),
      completedStatusSelector.boundingBox()
    ])
    expect(completedStatusBox).not.toBeNull()
    expect(completedUncompleteBox).not.toBeNull()
    expect(
      Math.abs(
        completedUncompleteBox!.x + completedUncompleteBox!.width - completedStatusBox!.x
      )
    ).toBeLessThanOrEqual(MOVE_BUTTON_POSITION_TOLERANCE_PX)
    await expect(completedStatusSelector).toHaveCSS('border-top-left-radius', '0px')
    await expect(completedStatusSelector).toHaveCSS('border-bottom-left-radius', '0px')
    await expect(completedStatusSelector).toHaveCSS('border-top-right-radius', '6px')
    await expect(completedStatusSelector).toHaveCSS('border-bottom-right-radius', '6px')
    await expect(completedUncompleteButton).toHaveCSS('border-top-left-radius', '6px')
    await expect(completedUncompleteButton).toHaveCSS('border-bottom-left-radius', '6px')
    await expect(completedUncompleteButton).toHaveCSS('border-top-right-radius', '0px')
    await expect(completedUncompleteButton).toHaveCSS('border-bottom-right-radius', '0px')
    await expect(mainWindow.locator(statusPillSelector('completed-mode-newest'))).toHaveText(
      'Completed'
    )
    await expect(mainWindow.locator(statusPillSelector('completed-mode-newest'))).toHaveAttribute(
      'data-variant',
      'completed'
    )
    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-archive-button"]`
      )
    ).toBeVisible()
    await expect(
      mainWindow.locator(
        `${promptEditorSelector('completed-mode-newest')} [data-testid="prompt-finalized-time"]`
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
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-active"]')
        .locator('.cthulhuUiAccordionCount')
    ).toHaveText('2')
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-completed"]')
        .locator('.cthulhuUiAccordionCount')
    ).toHaveText('1')

    await mainWindow.locator('[data-testid="prompt-folder-active-filter"]').click()
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-newest', 'completed-mode-active'])
    await expect(mainWindow.locator(statusPillSelector('completed-mode-newest'))).toHaveText('Todo')
    expect(await getPromptTreePromptRowIds(mainWindow, 'active')).toEqual([
      'completed-mode-newest',
      'completed-mode-active'
    ])
    await mainWindow
      .locator(
        `${sidebarPromptStatusContentSelector('completed')} [data-testid="prompt-tree-completed-prompt-completed-mode-oldest"]`
      )
      .click()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-section-completed"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['completed-mode-newest', 'completed-mode-active'])
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
              folderName: 'Completed Mode/Completed',
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
    expect(activeMarkdown).not.toContain('finalizedAt:')
    await expect
      .poll(
        async () =>
          await readPromptFolderEntries(
            electronApp,
            `${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/Completed Mode/Active/_FolderInfo/FolderOrder.json`
          )
      )
      .toEqual([
        { kind: 'prompt', id: 'completed-mode-newest' },
        { kind: 'prompt', id: 'completed-mode-active' }
      ])

    await testHelpers.navigateToPromptFolders('No Completed')
    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect(mainWindow.locator('[data-testid="sidebar-add-category-button"]')).toBeEnabled()
    // The selected root folder is not duplicated as a category in completed mode.
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-category-toggle-button-NoCompleted"]')
    ).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-completed-empty-status"]')
    ).toHaveText('No completed prompts. Click to view.')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-completed-virtual-window"]')
    ).toHaveCount(0)
    await mainWindow.locator('[data-testid="prompt-folder-active-filter"]').click()
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    await mainWindow.locator('[data-testid="prompt-tree-completed-empty-status"]').click()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toContainText(
      'No completed prompts were found in this folder.'
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
      mainWindow.locator('[data-testid="category-editor-settings-toggle"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).not.toContainText(
      'Click the Add Prompt button'
    )
    /** Active sash used to persist a non-default workspace-wide status-tree split. */
    const activeAccordionSash = mainWindow.locator(
      '[data-testid="sidebar-prompt-status-accordion-sash-active"]'
    )
    /** Completed section height before the workspace-wide split changes. */
    const initialCompletedHeightPx = await mainWindow
      .locator('[data-testid="sidebar-prompt-status-accordion-section-completed"]')
      .evaluate((section) => section.getBoundingClientRect().height)
    /** Active section height before the workspace-wide split changes. */
    const initialActiveHeightPx = await mainWindow
      .locator('[data-testid="sidebar-prompt-status-accordion-section-active"]')
      .evaluate((section) => section.getBoundingClientRect().height)
    /** Sash geometry used to perform a 30px split resize. */
    const activeAccordionSashBox = await activeAccordionSash.boundingBox()
    expect(activeAccordionSashBox).not.toBeNull()
    await mainWindow.mouse.move(
      activeAccordionSashBox!.x + activeAccordionSashBox!.width / 2,
      activeAccordionSashBox!.y + activeAccordionSashBox!.height / 2
    )
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(
      activeAccordionSashBox!.x + activeAccordionSashBox!.width / 2,
      activeAccordionSashBox!.y + activeAccordionSashBox!.height / 2 + 30
    )
    await mainWindow.mouse.up()
    /** Completed section height after resizing in the No Completed root folder. */
    const resizedCompletedHeightPx = await mainWindow
      .locator('[data-testid="sidebar-prompt-status-accordion-section-completed"]')
      .evaluate((section) => section.getBoundingClientRect().height)
    /** Active section height after resizing in the No Completed root folder. */
    const resizedActiveHeightPx = await mainWindow
      .locator('[data-testid="sidebar-prompt-status-accordion-section-active"]')
      .evaluate((section) => section.getBoundingClientRect().height)
    expect(Math.abs(resizedCompletedHeightPx - initialCompletedHeightPx - 30)).toBeLessThanOrEqual(
      2
    )
    expect(Math.abs(resizedActiveHeightPx - initialActiveHeightPx + 30)).toBeLessThanOrEqual(2)
    await testHelpers.navigateToPromptFolders('Completed Mode')
    /** Status section heights after navigating to another root prompt folder. */
    const navigatedStatusHeightsPx = await Promise.all([
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-section-completed"]')
        .evaluate((section) => section.getBoundingClientRect().height),
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-section-active"]')
        .evaluate((section) => section.getBoundingClientRect().height)
    ])
    expect(Math.abs(navigatedStatusHeightsPx[0] - resizedCompletedHeightPx)).toBeLessThanOrEqual(2)
    expect(Math.abs(navigatedStatusHeightsPx[1] - resizedActiveHeightPx)).toBeLessThanOrEqual(2)

    /** Completed header whose shared persisted state should survive root-folder navigation. */
    const completedAccordionHeader = mainWindow.locator(
      '[data-testid="sidebar-prompt-status-accordion-header-completed"]'
    )
    await completedAccordionHeader.click()
    await expect(completedAccordionHeader).toHaveAttribute('aria-expanded', 'false')
    await testHelpers.navigateToPromptFolders('No Completed')
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-header-completed"]')
    ).toHaveAttribute('aria-expanded', 'false')
  })

  test('archives prompts and exposes archived status views and drag targets', async ({
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

    /** Populated active prompt whose primary destructive action must be Archive. */
    const activeEditor = mainWindow.locator(promptEditorSelector('completed-mode-active'))
    /** Primary archive action whose label and glyph must both follow the default action. */
    const archiveButton = activeEditor.locator('[data-testid="prompt-archive-button"]')
    await expect(archiveButton).toHaveAttribute('aria-label', 'Archive prompt')
    await expect(archiveButton.locator('.lucide-archive')).toBeVisible()
    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    await expect(
      mainWindow.locator('[data-testid="prompt-status-more-options-menu"]').getByText('Archived', {
        exact: true
      })
    ).toHaveCount(0)
    await mainWindow.keyboard.press('Escape')
    await activeEditor.locator('[data-testid="prompt-delete-more-options-button"]').click()
    await expect(mainWindow.locator('[data-testid="prompt-delete-menu-item"]')).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await archiveButton.click()

    /** Archived path receiving the prompt without a confirmation dialog. */
    const archivedActivePromptPath =
      `${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/Completed Mode/Archived/Active Prompt.prompt.md`
    await expect.poll(() => checkFileExists(electronApp, archivedActivePromptPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, archivedActivePromptPath)).toContain(
      'status: Archived'
    )
    await expect(mainWindow.locator('[role="dialog"][aria-label="Delete Prompt"]')).toHaveCount(0)

    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()
    await mainWindow.locator('[data-testid="prompt-folder-archived-filter"]').click()
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-section"]')).toHaveText(
      'Archived'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-category"]')).toHaveCount(0)
    /** Rendered status sections in required Completed, Archived, Active order. */
    const statusSections = mainWindow.locator(
      '[data-testid^="sidebar-prompt-status-accordion-section-"]'
    )
    await expect(statusSections).toHaveCount(3)
    expect(
      await statusSections.evaluateAll((sections) =>
        sections.map((section) => section.getAttribute('data-testid'))
      )
    ).toEqual([
      'sidebar-prompt-status-accordion-section-completed',
      'sidebar-prompt-status-accordion-section-archived',
      'sidebar-prompt-status-accordion-section-active'
    ])
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-status-accordion-header-archived"]')
        .locator('.cthulhuUiAccordionIcon')
    ).toHaveClass(/lucide-archive/)
    await expect(
      mainWindow.locator('[data-testid="toggle-archived-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-folder-archived-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow))
      .toEqual(['completed-mode-active', 'archived-mode-newest', 'archived-mode-oldest'])
    expect(await getPromptTreePromptRowIds(mainWindow, 'archived')).toEqual([
      'completed-mode-active',
      'archived-mode-newest',
      'archived-mode-oldest'
    ])

    /** Sidebar toggle that hides Archived and returns the active screen to Active. */
    const archivedToggle = mainWindow.locator('[data-testid="toggle-archived-prompts-button"]')
    await archivedToggle.click()
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-section-archived"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await archivedToggle.click()
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-status-accordion-section-archived"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-folder-archived-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await expect(mainWindow.locator(statusPillSelector('completed-mode-active'))).toHaveText(
      'Archived'
    )
    await expect(mainWindow.locator(completeSelector('completed-mode-active'))).toHaveCount(0)
    await expect(mainWindow.locator(uncompleteSelector('completed-mode-active'))).toHaveCount(0)
    await expect(mainWindow.locator(previousStatusSelector('completed-mode-active'))).toHaveCount(0)
    await mainWindow.locator(statusMoreOptionsSelector('completed-mode-active')).click()
    /** Archived status menu that deliberately omits Archived as a destination. */
    const archivedStatusMenu = mainWindow.locator('[data-testid="prompt-status-more-options-menu"]')
    await expect(archivedStatusMenu.getByText('Archived', { exact: true })).toHaveCount(0)
    await mainWindow.keyboard.press('Escape')
    await expect(
      activeEditor.locator('[data-testid="prompt-finalized-time"]')
    ).toContainText('Archived')
    await expect(activeEditor.locator('[data-testid="prompt-delete-more-options-button"]')).toHaveCount(0)
    await activeEditor.locator('[data-testid="prompt-delete-button"]').click()
    await expect(mainWindow.locator('[role="dialog"][aria-label="Delete Prompt"]')).toBeVisible()
    await mainWindow.getByRole('button', { name: 'Cancel' }).click()

    await beginPromptTreeRowDrag(mainWindow, 'archived-mode-newest', 'archived')
    await moveActiveDragToTarget(mainWindow, '[data-testid="prompt-tree-active-empty-status"]')
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'active'))
      .toEqual(['archived-mode-newest'])
    /** Restored active path proving Archived supports outbound status drops. */
    const restoredPromptPath =
      `${COMPLETED_MODE_WORKSPACE_PATH}/Prompts/Completed Mode/Active/Newest Archived.prompt.md`
    await expect.poll(() => readTextFile(electronApp, restoredPromptPath)).toContain('status: Todo')

    await beginPromptTreeRowDrag(mainWindow, 'archived-mode-newest')
    await moveActiveDragToTarget(
      mainWindow,
      `${sidebarPromptStatusContentSelector('archived')} [data-testid="prompt-tree-archived-prompt-archived-mode-oldest"]`
    )
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await getPromptTreePromptRowIds(mainWindow, 'archived'))
      .toEqual(['archived-mode-newest', 'completed-mode-active', 'archived-mode-oldest'])
    await expect.poll(() => checkFileExists(electronApp, restoredPromptPath)).toBe(false)
  })

  test('deletes prompts and keeps deletion after navigation', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))
    /** Workspace ID owning the SQLite editor state inserted for delete-handler coverage. */
    const workspaceId = (
      await runSqlQuery(
        electronApp,
        'SELECT workspace_id AS workspaceId FROM workspace_ui_state LIMIT 1'
      )
    ).rows?.[0]?.workspaceId as string
    await runSqlStatement(
      electronApp,
      `INSERT INTO markdown_content_ui_state (workspace_id, content_id, editor_view_state_json)
       VALUES ('${workspaceId}', 'dev-1', '{}'), ('${workspaceId}', 'dev-2', '{}')
       ON CONFLICT(workspace_id, content_id) DO UPDATE SET editor_view_state_json = excluded.editor_view_state_json`
    )
    expect(
      (
        await runSqlQuery(
          electronApp,
          `SELECT content_id AS contentId FROM markdown_content_ui_state
           WHERE workspace_id = '${workspaceId}' AND content_id IN ('dev-1', 'dev-2')
           ORDER BY content_id`
        )
      ).rows
    ).toEqual([{ contentId: 'dev-1' }, { contentId: 'dev-2' }])

    // Create an empty prompt, then delete it without the confirmation dialog.
    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, testHelpers, 'dev-1')
    await waitForPromptCount(mainWindow, 3)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const emptyPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))
    expect(emptyPromptId).toBeTruthy()

    /** Empty prompt editor whose primary action remains immediate Delete. */
    const emptyPromptEditor = mainWindow.locator(promptEditorSelector(emptyPromptId!))
    const emptyDeleteSelector = `${promptEditorSelector(emptyPromptId!)} [data-testid="prompt-delete-button"]`
    await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, emptyDeleteSelector)
    const emptyDeleteButton = mainWindow.locator(emptyDeleteSelector)
    await expect(emptyDeleteButton).toHaveAttribute('aria-label', 'Delete prompt')
    await expect(emptyDeleteButton.locator('.lucide-trash-2')).toBeVisible()
    await expect(
      emptyPromptEditor.locator('[data-testid="prompt-delete-more-options-button"]')
    ).toBeVisible()
    await emptyPromptEditor.locator('[data-testid="prompt-delete-more-options-button"]').click()
    await expect(mainWindow.locator('[data-testid="prompt-archive-menu-item"]')).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await emptyDeleteButton.click()
    await expect(mainWindow.locator('text=Delete Prompt')).toHaveCount(0)
    await expect(mainWindow.locator(promptEditorSelector(emptyPromptId!))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 2)

    // Delete a populated prompt and confirm the dialog flow.
    const deleteSelector = `${promptEditorSelector('dev-1')} [data-testid="prompt-delete-more-options-button"]`
    await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, deleteSelector)
    const deleteButton = mainWindow.locator(deleteSelector)
    await deleteButton.click()
    await mainWindow.locator('[data-testid="prompt-delete-menu-item"]').click()

    const dialog = mainWindow.locator('[role="dialog"][aria-label="Delete Prompt"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('text=Delete Prompt')).toBeVisible()

    await dialog.locator('button:has-text("Delete")').click()
    await expect(mainWindow.locator(promptEditorSelector('dev-1'))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 1)
    expect(
      (
        await runSqlQuery(
          electronApp,
          `SELECT content_id FROM markdown_content_ui_state
           WHERE workspace_id = '${workspaceId}' AND content_id IN ('dev-1', 'dev-2')
           ORDER BY content_id`
        )
      ).rows
    ).toEqual([{ content_id: 'dev-2' }])

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
