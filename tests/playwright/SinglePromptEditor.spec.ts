import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { getMonacoEditorText, isMonacoEditorFocused, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { getPromptEditorIds } from '../helpers/PromptCollectionHelpers'
import {
  PROMPT_COLLECTION_HOST_SELECTOR,
  promptEditorSelector,
  promptTreePromptSelector
} from '../helpers/PromptCollectionSelectors'
import { readWorkspaceUiState } from '../helpers/UserPersistenceHelpers'

/** Real application coverage for the full-screen single-prompt editor. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Isolated workspace used by every single-prompt scenario. */
const WORKSPACE_PATH = '/ws/single-prompt-editor'
/** Stable identity for persisted screen-selection assertions. */
const WORKSPACE_ID = 'single-prompt-editor-workspace'
/** Query present in two prompts so collection-wide and prompt-only find differ. */
const FIND_QUERY = 'singlefindmarker'
const SCREEN = '[data-testid="single-prompt-screen"]'
/** Body editor of the open prompt, excluding its attached note. */
const BODY = `${SCREEN} .prompt-editor-body-editor-section`
const NOTE = `${SCREEN} [data-testid="attached-note-editor"]`

/** Opens thirty multi-line prompts so the collection view has room to scroll, optionally replacing p1's text. */
const startWorkspace = async (testSetup: TestSetup, p1Text?: string) => {
  await testSetup.setupFilesystem(createWorkspaceWithCollections(WORKSPACE_PATH, [{
    folderName: 'Content',
    displayName: 'Content',
    prompts: Array.from({ length: 30 }, (_, index) => ({
      id: `p${index}`,
      title: `Prompt ${index}`,
      promptText: index === 1 && p1Text !== undefined ? p1Text : `Body ${index}\nSecond line${index === 0 || index === 1 ? ` ${FIND_QUERY}` : ''}\nThird line`
    }))
  }], { settings: { workspaceId: WORKSPACE_ID } }))
  await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
  const started = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await started.testHelpers.setupWorkspaceViaUI()
  await started.testHelpers.navigateToPromptCollections('Content')
  await waitForMonacoEditor(started.mainWindow, promptEditorSelector('p0'))
  return started
}

/** Sidebar tree viewport for the Active status group. */
const ACTIVE_TREE = '[data-testid="prompt-tree-active-virtual-window"]'

/** Opens one rendered prompt card in the single-prompt editor. */
const openPrompt = async (page: Page, promptId: string) => {
  await page.locator(promptEditorSelector(promptId)).getByTestId('prompt-open-button').click()
  await expect(page.locator(SCREEN)).toBeVisible()
  await expect(page.getByTestId('prompt-collection-virtual-window')).toHaveCount(0)
  await waitForMonacoEditor(page, BODY)
}

/** Returns rendered prompt IDs whose cards are fully inside the collection viewport. */
const getPromptIdsInViewport = async (page: Page): Promise<string[]> => {
  const hostBox = (await page.locator(PROMPT_COLLECTION_HOST_SELECTOR).boundingBox())!
  const ids: string[] = []
  for (const id of await getPromptEditorIds(page)) {
    const box = await page.locator(promptEditorSelector(id)).boundingBox()
    if (box && box.y >= hostBox.y && box.y + box.height <= hostBox.y + hostBox.height) ids.push(id)
  }
  return ids
}

/** Reads whether a sidebar row is fully inside its tree viewport. */
const isTreeRowInViewport = (page: Page, rowSelector: string, group: string) =>
  page.evaluate(({ rowSelector, group }) => {
    const row = document.querySelector(rowSelector)?.getBoundingClientRect()
    const host = document.querySelector(`[data-testid="prompt-tree-${group}-virtual-window"]`)?.getBoundingClientRect()
    return Boolean(row && host && row.top >= host.top - 1 && row.bottom <= host.bottom + 1)
  }, { rowSelector, group })

/** Measures a hydrated Monaco viewport and its rendered line height. */
const measureEditor = (page: Page, selector: string) =>
  page.locator(selector).evaluate((section) => {
    const root = section.querySelector<HTMLElement>('.monaco-editor:has(.view-lines)')!
    return {
      height: root.getBoundingClientRect().height,
      lineHeight: section.querySelector('.view-line')!.getBoundingClientRect().height
    }
  })

/** Drags the note split handle to just inside the top or bottom edge of the screen. */
const dragSplitHandle = async (page: Page, edge: 'top' | 'bottom') => {
  const box = (await page.getByTestId('attached-note-split-handle').boundingBox())!
  const screen = (await page.locator(SCREEN).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, edge === 'top' ? screen.y + 10 : screen.y + screen.height - 10, { steps: 4 })
  await page.mouse.up()
}

/** Reads the first prompt card fully inside the collection viewport once one is rendered. */
const getFirstPromptIdInViewport = async (page: Page): Promise<string> => {
  await expect.poll(async () => (await getPromptIdsInViewport(page)).length).toBeGreaterThan(0)
  return (await getPromptIdsInViewport(page))[0]!
}

describe('Single prompt editor', () => {
  test('opens from the button bar and returns to the saved collection scroll position', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await startWorkspace(testSetup)
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST_SELECTOR, 900)
    const savedScrollTop = await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)
    const promptId = await getFirstPromptIdInViewport(mainWindow)

    await openPrompt(mainWindow, promptId)
    await expect(mainWindow.locator('.prompt-collection-header-breadcrumb button')).toHaveText([
      'Content', 'Active', `Prompt ${promptId.slice(1)}`
    ])
    await expect(mainWindow.getByTestId('prompt-collection-find-button')).toHaveAttribute('title', 'Find in Prompt (Control + F)')
    expect(await getMonacoEditorText(mainWindow, BODY)).toBe(`Body ${promptId.slice(1)} Second line Third line`)
    await expect(mainWindow.locator(SCREEN).getByTestId('prompt-open-button')).toHaveCount(0)
    await expect(mainWindow.locator(SCREEN).getByTestId('prompt-close-button')).toBeVisible()
    await expect(mainWindow.locator(promptTreePromptSelector(promptId))).toHaveAttribute('aria-current', 'true')
    // Without a note, the body editor fills the screen down to its bottom padding.
    const screenBottom = await mainWindow.locator(SCREEN).evaluate((screen) => screen.getBoundingClientRect().bottom)
    const bodyBottom = await mainWindow.locator(BODY).evaluate((section) => section.getBoundingClientRect().bottom)
    expect(Math.abs(screenBottom - bodyBottom)).toBeLessThanOrEqual(1)

    await mainWindow.getByTestId('single-prompt-return-button').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)).toBe(savedScrollTop)
  })

  test('returns to the collection view at path segments and sidebar entries', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await startWorkspace(testSetup)
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST_SELECTOR, 600)
    const promptId = await getFirstPromptIdInViewport(mainWindow)
    await openPrompt(mainWindow, promptId)
    await mainWindow.getByTestId('prompt-collection-header-collection').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)).toBe(0)

    await openPrompt(mainWindow, 'p1')
    await testHelpers.scrollVirtualWindowTo(ACTIVE_TREE, 12 * 32)
    await mainWindow.locator(promptTreePromptSelector('p12')).click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect.poll(() => getPromptIdsInViewport(mainWindow)).toContain('p12')
    /** Card offset produced by the standard sidebar prompt reveal. */
    const readCardOffset = async () => {
      const host = (await mainWindow.locator(PROMPT_COLLECTION_HOST_SELECTOR).boundingBox())!
      const card = await mainWindow.locator(promptEditorSelector('p12')).boundingBox()
      return card ? card.y - host.y : Infinity
    }
    const sidebarRevealOffset = await readCardOffset()

    // The prompt segment reveals its card where a sidebar click does, not at the shifted saved offset.
    await testHelpers.scrollVirtualWindowBy(PROMPT_COLLECTION_HOST_SELECTOR, 150)
    await expect.poll(async () => Math.abs((await readCardOffset()) - sidebarRevealOffset)).toBeGreaterThan(100)
    await openPrompt(mainWindow, 'p12')
    await mainWindow.getByTestId('prompt-collection-header-prompt').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect.poll(async () => Math.abs((await readCardOffset()) - sidebarRevealOffset)).toBeLessThanOrEqual(1)

    await openPrompt(mainWindow, 'p12')
    await mainWindow.getByTestId('sidebar-collection-overview-button').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)).toBe(0)
  })

  test('renames the collection from the sidebar actions menu on both project screens', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    const renameDialog = mainWindow.getByRole('dialog', { name: 'Rename Collection' })
    const nameInput = mainWindow.getByTestId('rename-prompt-collection-name-input')
    const submitButton = mainWindow.getByTestId('rename-prompt-collection-button')
    /** Opens rename through the menu; closing the menu must leave focus in the name field. */
    const openRenameFromMenu = async (): Promise<void> => {
      await mainWindow.getByTestId('selected-prompt-collection-actions-button').click()
      await mainWindow.getByTestId('rename-selected-prompt-collection-menu-item').click()
      await expect(renameDialog).toBeVisible()
      await expect(nameInput).toBeFocused()
    }

    await openRenameFromMenu()
    await expect(nameInput).toHaveValue('Content')
    await nameInput.fill('Renamed Content')
    await submitButton.click()
    await expect(renameDialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Renamed Content')

    /** The single-prompt screen has no title action, and renaming must not navigate away from it. */
    await openPrompt(mainWindow, 'p0')
    await openRenameFromMenu()
    await expect(nameInput).toHaveValue('Renamed Content')
    await nameInput.fill('Content Again')
    await submitButton.click()
    await expect(renameDialog).toHaveCount(0)
    await expect(mainWindow.locator(SCREEN)).toBeVisible()
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('Content Again')
  })

  test('limits find to the open prompt', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    await openPrompt(mainWindow, 'p0')
    await mainWindow.getByTestId('prompt-collection-find-button').click()
    await mainWindow.getByTestId('prompt-find-input').fill(FIND_QUERY)
    await expect(mainWindow.locator('[data-testid="prompt-find-widget"] .prompt-find-widget__matches')).toHaveText('1 of 1')
  })

  test('follows Active and Backlog moves without changing accordion sections and closes when finalized or deleted', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    const backlogHeader = mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog')
    const activeHeader = mainWindow.getByTestId('sidebar-prompt-status-accordion-header-active')
    await expect(backlogHeader).toHaveAttribute('aria-expanded', 'true')
    await openPrompt(mainWindow, 'p2')

    await mainWindow.locator(SCREEN).getByTestId('prompt-backlog-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Backlog')
    await expect(mainWindow.locator(SCREEN)).toBeVisible()
    await expect(mainWindow.locator(promptTreePromptSelector('p2', 'backlog'))).toHaveAttribute('aria-current', 'true')
    await expect.poll(() => isTreeRowInViewport(mainWindow, promptTreePromptSelector('p2', 'backlog'), 'backlog')).toBe(true)
    await expect(backlogHeader).toHaveAttribute('aria-expanded', 'true')

    // A collapsed destination section stays collapsed while the editor follows the prompt.
    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'false')
    await mainWindow.locator(SCREEN).getByTestId('prompt-todo-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Active')
    await expect(mainWindow.locator(SCREEN)).toBeVisible()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'false')

    await mainWindow.locator(SCREEN).getByTestId('prompt-complete-button').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect(mainWindow.getByTestId('prompt-collection-virtual-window')).toBeVisible()

    await openPrompt(mainWindow, 'p3')
    await mainWindow.locator(SCREEN).getByTestId('prompt-delete-more-options-button').click()
    await mainWindow.getByTestId('prompt-delete-menu-item').click()
    await mainWindow.getByTestId('prompt-confirm-delete-button').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect(mainWindow.locator(promptEditorSelector('p3'))).toHaveCount(0)
  })

  test('restores the open prompt after a renderer reload', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    await openPrompt(mainWindow, 'p1')
    await expect.poll(async () => {
      const state = await readWorkspaceUiState(electronApp, WORKSPACE_ID)
      return state.selectedScreenData && 'openPromptId' in state.selectedScreenData ? state.selectedScreenData.openPromptId : null
    }).toBe('p1')

    await mainWindow.reload()
    await expect(mainWindow.locator(SCREEN)).toBeVisible()
    await waitForMonacoEditor(mainWindow, BODY)
    await expect(mainWindow.getByTestId('prompt-collection-header-prompt')).toHaveText('Prompt 1')
    await expect(mainWindow.locator(promptTreePromptSelector('p1'))).toHaveAttribute('aria-current', 'true')

    await mainWindow.getByTestId('single-prompt-return-button').click()
    await expect.poll(async () => {
      const state = await readWorkspaceUiState(electronApp, WORKSPACE_ID)
      return state.selectedScreenData && 'openPromptId' in state.selectedScreenData ? state.selectedScreenData.openPromptId : 'missing'
    }).toBeNull()
  })

  test('ignores move shortcuts', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    await openPrompt(mainWindow, 'p1')
    await mainWindow.locator(SCREEN).getByTestId('prompt-title').focus()
    await mainWindow.keyboard.press('Control+Shift+ArrowDown')
    // An optimistic move would reorder the collection before these frames finish.
    await mainWindow.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    // The button bar's close button replaces Open while the prompt is shown full screen.
    await mainWindow.locator(SCREEN).getByTestId('prompt-close-button').click()
    await expect(mainWindow.locator(SCREEN)).toHaveCount(0)
    await expect.poll(async () => (await getPromptEditorIds(mainWindow)).slice(0, 3)).toEqual(['p0', 'p1', 'p2'])
  })

  test('resizes the attached note with one-line minimums and shares its visibility', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(testSetup)
    await openPrompt(mainWindow, 'p1')
    await mainWindow.locator(SCREEN).getByTestId('attached-note-button').click()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
    await mainWindow.keyboard.insertText('Note text')

    // The note sits at the bottom of the screen in both directions of the split.
    const expectNoteFillsScreen = () => expect.poll(async () => {
      const screenBottom = await mainWindow.locator(SCREEN).evaluate((screen) => screen.getBoundingClientRect().bottom)
      const noteBottom = await mainWindow.locator(NOTE).evaluate((section) => section.getBoundingClientRect().bottom)
      return Math.abs(screenBottom - noteBottom)
    }).toBeLessThanOrEqual(1)
    await expectNoteFillsScreen()

    await dragSplitHandle(mainWindow, 'top')
    await expect.poll(async () => {
      const body = await measureEditor(mainWindow, BODY)
      return Math.abs(body.height - body.lineHeight)
    }).toBeLessThanOrEqual(1)
    await expectNoteFillsScreen()

    await dragSplitHandle(mainWindow, 'bottom')
    await expect.poll(async () => {
      const note = await measureEditor(mainWindow, NOTE)
      return Math.abs(note.height - note.lineHeight)
    }).toBeLessThanOrEqual(1)
    await expectNoteFillsScreen()

    await mainWindow.locator(SCREEN).getByTestId('attached-note-header').click()
    await expect(mainWindow.getByTestId('attached-note-split-handle')).toHaveCount(0)
    await mainWindow.getByTestId('single-prompt-return-button').click()
    await expect(mainWindow.locator(promptEditorSelector('p1')).getByTestId('attached-note-header')).toHaveAttribute('aria-expanded', 'false')
    await openPrompt(mainWindow, 'p1')
    await expect(mainWindow.locator(SCREEN).getByTestId('attached-note-header')).toHaveAttribute('aria-expanded', 'false')
  })

  test('keeps the body editor anchored while the attached note collapses and expands', async ({ testSetup }) => {
    const { mainWindow } = await startWorkspace(
      testSetup,
      Array.from({ length: 200 }, (_, index) => `Line ${index}`).join('\n')
    )
    await openPrompt(mainWindow, 'p1')
    await mainWindow.locator(SCREEN).getByTestId('attached-note-button').click()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, NOTE)).toBe(true)
    await mainWindow.keyboard.insertText('Note text')
    /** Body editor's on-screen top edge and its internal scroll offset. */
    const readBody = () => mainWindow.locator(BODY).evaluate((section) => ({
      top: Math.round(section.getBoundingClientRect().top),
      scrollTop: window.__cthulhuMonacoEditors!.find((entry) => section.contains(entry.container))!.editor.getScrollTop()
    }))
    // Place the caret in the body and wheel-scroll it, as a user would before toggling the note.
    await mainWindow.locator(BODY).click({ position: { x: 40, y: 30 } })
    const bodyBox = (await mainWindow.locator(BODY).boundingBox())!
    await mainWindow.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2)
    await mainWindow.mouse.wheel(0, 500)
    await expect.poll(async () => (await readBody()).scrollTop).toBeGreaterThan(0)
    const anchored = await readBody()

    for (const expanded of ['false', 'true']) {
      await mainWindow.locator(SCREEN).getByTestId('attached-note-header').click()
      await expect(mainWindow.locator(SCREEN).getByTestId('attached-note-header')).toHaveAttribute('aria-expanded', expanded)
      // Settle layout and Monaco relayout before comparing.
      await mainWindow.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      expect(await readBody()).toEqual(anchored)
    }
  })
})
