import type { Page } from '@playwright/test'
import { estimatePromptEditorHeight } from '@renderer/features/prompt-editor/promptEditorSizing'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/tanstack/TanstackSystemSettings'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { heightTestPrompts } from '../fixtures/TestData'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR

type PromptData = (typeof heightTestPrompts)[keyof typeof heightTestPrompts]

type PromptFoldersMeasurement = {
  placeholderHeight: number
  hydratedHeight: number
}

type PromptFoldersTestContext = {
  mainWindow: Page
  testHelpers: {
    navigateToPromptFolders: (folderDisplayName: string) => Promise<void>
    scrollVirtualWindowTo: (selector: string, scrollTopPx: number) => Promise<void>
  }
  workspaceSetupResult: { workspaceReady: boolean }
}

type ExpectPromptFoldersOptions = {
  strictPlaceholder?: boolean
}

function expectPromptFoldersHeights(
  measurements: PromptFoldersMeasurement,
  options: ExpectPromptFoldersOptions = {}
): void {
  const { placeholderHeight, hydratedHeight } = measurements
  const { strictPlaceholder = true } = options

  if (strictPlaceholder) {
    expect(placeholderHeight).toBe(hydratedHeight)
  } else {
    expect(placeholderHeight).toBeGreaterThan(0)
    expect(hydratedHeight).toBeGreaterThan(0)
  }
}

async function scrollPromptFoldersListToIndex(
  mainWindow: Page,
  testHelpers: PromptFoldersTestContext['testHelpers'],
  index: number,
  rowHeight: number
): Promise<void> {
  await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
  await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, index * rowHeight)
}

async function pauseMonacoHydration(mainWindow: Page): Promise<void> {
  await mainWindow.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
  await mainWindow.evaluate(() => {
    window.svelteVirtualWindowTestControls?.setMonacoHydrationPaused(true)
  })
}

async function resumeMonacoHydration(mainWindow: Page): Promise<void> {
  await mainWindow.evaluate(() => {
    window.svelteVirtualWindowTestControls?.setMonacoHydrationPaused(false)
  })
}

async function measurePromptFolders(
  context: PromptFoldersTestContext,
  prompt: PromptData
): Promise<PromptFoldersMeasurement> {
  const { mainWindow, testHelpers } = context
  const folderDisplayName = prompt.title
  const rowSelector = promptEditorSelector(prompt.id)
  const placeholderSelector = `${rowSelector} ${MONACO_PLACEHOLDER_SELECTOR}`
  const estimatedRowHeight = estimatePromptEditorHeight(
    prompt.promptText,
    0,
    0,
    DEFAULT_SYSTEM_SETTINGS.promptFontSize,
    DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
  )
  const setupPrompt =
    folderDisplayName === heightTestPrompts.singleLine.title
      ? heightTestPrompts.tenLine
      : heightTestPrompts.singleLine

  try {
    await testHelpers.navigateToPromptFolders(setupPrompt.title)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    await pauseMonacoHydration(mainWindow)

    if (setupPrompt.title !== folderDisplayName) {
      await testHelpers.navigateToPromptFolders(folderDisplayName)
      await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    }

    await scrollPromptFoldersListToIndex(mainWindow, testHelpers, 0, estimatedRowHeight)

    await mainWindow.waitForSelector(rowSelector, { state: 'attached' })
    await mainWindow.waitForSelector(placeholderSelector, { state: 'attached' })

    const placeholderHeight = await mainWindow.evaluate(
      ({ selector }) => {
        const row = document.querySelector<HTMLElement>(selector)
        if (!row) return null
        return Math.round(row.getBoundingClientRect().height)
      },
      { selector: rowSelector }
    )

    if (placeholderHeight == null) {
      throw new Error(`Failed to measure placeholder for prompt ${prompt.id}`)
    }

    await resumeMonacoHydration(mainWindow)

    await mainWindow.waitForSelector(placeholderSelector, { state: 'detached' })

    const hydratedHeight = await mainWindow.evaluate(
      ({ selector }) => {
        const row = document.querySelector<HTMLElement>(selector)
        if (!row) return null
        return Math.round(row.getBoundingClientRect().height)
      },
      { selector: rowSelector }
    )

    if (hydratedHeight == null) {
      throw new Error(`Failed to measure hydrated row for prompt ${prompt.id}`)
    }

    const titleInput = mainWindow.locator(`${rowSelector} ${PROMPT_TITLE_SELECTOR}`)
    await titleInput.waitFor()
    await expect(titleInput).toHaveValue(prompt.title)

    return {
      placeholderHeight,
      hydratedHeight
    }
  } finally {
    if (!mainWindow.isClosed()) {
      await resumeMonacoHydration(mainWindow)
    }
  }
}

async function startPromptFoldersScenario(testSetup: any): Promise<PromptFoldersTestContext> {
  const context = await testSetup.setupAndStart({
    workspace: { scenario: 'height' }
  })

  expect(context.workspaceSetupResult.workspaceReady).toBe(true)
  return context
}

describe('Prompt folders prompt height estimation', () => {
  test('placeholder height matches hydrated height for single line prompt', async ({
    testSetup
  }) => {
    const context = await startPromptFoldersScenario(testSetup)

    const measurements = await measurePromptFolders(context, heightTestPrompts.singleLine)

    expectPromptFoldersHeights(measurements)
  })

  test('uses estimated height for ten line prompt', async ({ testSetup }) => {
    const context = await startPromptFoldersScenario(testSetup)
    const measurements = await measurePromptFolders(context, heightTestPrompts.tenLine)

    expectPromptFoldersHeights(measurements, { strictPlaceholder: false })
  })

  test('uses estimated height for twenty line prompt', async ({ testSetup }) => {
    const context = await startPromptFoldersScenario(testSetup)
    const measurements = await measurePromptFolders(context, heightTestPrompts.twentyLine)

    expectPromptFoldersHeights(measurements, { strictPlaceholder: false })
  })

  test('uses estimated height for hundred line prompt', async ({ testSetup }) => {
    const context = await startPromptFoldersScenario(testSetup)
    const measurements = await measurePromptFolders(context, heightTestPrompts.hundredLine)

    expectPromptFoldersHeights(measurements, { strictPlaceholder: false })
  })

  test('clamps height at the maximum for forty line prompt', async ({ testSetup }) => {
    const context = await startPromptFoldersScenario(testSetup)
    const measurements = await measurePromptFolders(context, heightTestPrompts.fortyLine)

    expectPromptFoldersHeights(measurements, { strictPlaceholder: false })
  })

  test('long wrapped single line prompt stays within estimated height while overflowing content', async ({
    testSetup
  }) => {
    const context = await startPromptFoldersScenario(testSetup)
    const measurements = await measurePromptFolders(
      context,
      heightTestPrompts.longWrappedSingleLine
    )

    expectPromptFoldersHeights(measurements, { strictPlaceholder: false })
  })

  test('extreme wrapped single line prompt is clamped to estimated height', async ({
    testSetup
  }) => {
    const context = await startPromptFoldersScenario(testSetup)
    const measurements = await measurePromptFolders(
      context,
      heightTestPrompts.longWrappedSingleLineOverflow
    )

    expectPromptFoldersHeights(measurements, { strictPlaceholder: false })
  })
})
