import type { Page } from '@playwright/test'
import { estimatePromptEditorHeight } from '@renderer/features/prompt-editor/promptEditorSizing'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/domain/settings/SystemSettings'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_COLLECTION_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptCollectionSelectors'
import { heightTestPrompts } from '../fixtures/TestData'
import { measureEditorCardGeometry } from '../helpers/CardGeometryHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_COLLECTION_HOST_SELECTOR
const CARD_FILL_TOLERANCE_PX = 1

type PromptData = (typeof heightTestPrompts)[keyof typeof heightTestPrompts]

type PromptCollectionsMeasurement = {
  placeholderHeight: number
  hydratedHeight: number
}

type PromptCollectionsTestContext = {
  mainWindow: Page
  testHelpers: {
    navigateToPromptCollections: (collectionDisplayName: string) => Promise<void>
    scrollVirtualWindowTo: (selector: string, scrollTopPx: number) => Promise<void>
  }
  workspaceSetupResult: { workspaceReady: boolean }
}

type ExpectPromptCollectionsOptions = {
  strictPlaceholder?: boolean
}

function expectPromptCollectionsHeights(
  measurements: PromptCollectionsMeasurement,
  options: ExpectPromptCollectionsOptions = {}
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

// The card pins its height to the virtual row height, so comparing rects can
// never catch constants drifting from the CSS. Assert against real geometry:
// the content must exactly fill the card with no hidden internal overflow.
async function expectCardContentFillsRow(mainWindow: Page, rowSelector: string): Promise<void> {
  await expect
    .poll(async () => {
      const geometry = await measureEditorCardGeometry(mainWindow, rowSelector)
      if (!geometry) return Number.POSITIVE_INFINITY
      return Math.max(
        geometry.hiddenOverflowPx,
        geometry.internalScrollTopPx,
        Math.abs(geometry.promptBodyFillGapPx ?? Number.POSITIVE_INFINITY),
        Math.abs(geometry.promptSidebarFillGapPx ?? Number.POSITIVE_INFINITY)
      )
    })
    .toBeLessThanOrEqual(CARD_FILL_TOLERANCE_PX)

  const geometry = (await measureEditorCardGeometry(mainWindow, rowSelector))!
  expect(
    geometry.hiddenOverflowPx,
    `card ${rowSelector} clips content inside overflow:hidden`
  ).toBe(0)
}

async function scrollPromptCollectionsListToIndex(
  mainWindow: Page,
  testHelpers: PromptCollectionsTestContext['testHelpers'],
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

async function measurePromptCollections(
  context: PromptCollectionsTestContext,
  prompt: PromptData
): Promise<PromptCollectionsMeasurement> {
  const { mainWindow, testHelpers } = context
  const collectionDisplayName = prompt.title
  const rowSelector = promptEditorSelector(prompt.id)
  const placeholderSelector = `${rowSelector} ${MONACO_PLACEHOLDER_SELECTOR}`
  const estimatedRowHeight = estimatePromptEditorHeight(prompt.promptText, 0, 0, {
    fontSize: DEFAULT_SYSTEM_SETTINGS.promptFontSize,
    minLines: DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines,
    maxLines: DEFAULT_SYSTEM_SETTINGS.promptEditorMaxLines
  })
  const setupPrompt =
    collectionDisplayName === heightTestPrompts.singleLine.title
      ? heightTestPrompts.tenLine
      : heightTestPrompts.singleLine

  try {
    await testHelpers.navigateToPromptCollections(setupPrompt.title)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    await pauseMonacoHydration(mainWindow)

    if (setupPrompt.title !== collectionDisplayName) {
      await testHelpers.navigateToPromptCollections(collectionDisplayName)
      await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    }

    await scrollPromptCollectionsListToIndex(mainWindow, testHelpers, 0, estimatedRowHeight)

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

    await expectCardContentFillsRow(mainWindow, rowSelector)

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

async function startPromptCollectionsScenario(testSetup: any): Promise<PromptCollectionsTestContext> {
  const context = await testSetup.setupAndStart({
    workspace: { scenario: 'height' }
  })

  expect(context.workspaceSetupResult!.workspaceReady).toBe(true)
  return context
}

describe('Prompt collections prompt height estimation', () => {
  test('placeholder height matches hydrated height for single line prompt', async ({
    testSetup
  }) => {
    const context = await startPromptCollectionsScenario(testSetup)

    const measurements = await measurePromptCollections(context, heightTestPrompts.singleLine)

    expectPromptCollectionsHeights(measurements)
  })

  test('uses estimated height for ten line prompt', async ({ testSetup }) => {
    const context = await startPromptCollectionsScenario(testSetup)
    const measurements = await measurePromptCollections(context, heightTestPrompts.tenLine)

    expectPromptCollectionsHeights(measurements, { strictPlaceholder: false })
  })

  test('uses estimated height for twenty line prompt', async ({ testSetup }) => {
    const context = await startPromptCollectionsScenario(testSetup)
    const measurements = await measurePromptCollections(context, heightTestPrompts.twentyLine)

    expectPromptCollectionsHeights(measurements, { strictPlaceholder: false })
  })

  test('uses estimated height for hundred line prompt', async ({ testSetup }) => {
    const context = await startPromptCollectionsScenario(testSetup)
    const measurements = await measurePromptCollections(context, heightTestPrompts.hundredLine)

    expectPromptCollectionsHeights(measurements, { strictPlaceholder: false })
  })

  test('clamps height at the maximum for forty line prompt', async ({ testSetup }) => {
    const context = await startPromptCollectionsScenario(testSetup)
    const measurements = await measurePromptCollections(context, heightTestPrompts.fortyLine)

    expectPromptCollectionsHeights(measurements, { strictPlaceholder: false })
  })

  test('long wrapped single line prompt stays within estimated height while overflowing content', async ({
    testSetup
  }) => {
    const context = await startPromptCollectionsScenario(testSetup)
    const measurements = await measurePromptCollections(
      context,
      heightTestPrompts.longWrappedSingleLine
    )

    expectPromptCollectionsHeights(measurements, { strictPlaceholder: false })
  })

  test('extreme wrapped single line prompt is clamped to estimated height', async ({
    testSetup
  }) => {
    const context = await startPromptCollectionsScenario(testSetup)
    const measurements = await measurePromptCollections(
      context,
      heightTestPrompts.longWrappedSingleLineOverflow
    )

    expectPromptCollectionsHeights(measurements, { strictPlaceholder: false })
  })
})
