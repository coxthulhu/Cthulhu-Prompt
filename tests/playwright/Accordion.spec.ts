import type { Locator, Page } from '@playwright/test'
import { getWorkspaceInfoPath, setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  readWorkspaceUiState,
  seedUserPersistence,
  seedWorkspaceUiState,
  type AccordionUiStateSeedEntry
} from '../helpers/UserPersistenceHelpers'

/** Playwright fixtures and assertions configured for the Electron application. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Test Screen accordion persistence ID shared with its demo component. */
const TEST_ACCORDION_PERSISTENCE_ID = 'test-screen-prompt-status'
/** Fixed displayed height for collapsed accordion sections. */
const COLLAPSED_HEIGHT_PX = 36
/** Completed demo section minimum including its fixed header and configured content minimum. */
const COMPLETED_MINIMUM_EXPANDED_HEIGHT_PX = 136

/** Creates fixture-stable entity IDs using the workspace fixture algorithm. */
const createDeterministicId = (seed: string): string => {
  /** Incremental unsigned hash for the fixture seed. */
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  /** Fixed-width suffix used by deterministic workspace fixture IDs. */
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

/** Creates complete persisted section state with independently configurable expanded heights. */
const createAccordionSections = (
  states: Array<{ id: string; isExpanded: boolean; configuredExpandedHeightPx: number }>
): AccordionUiStateSeedEntry['sections'] => states

/** Reads a required locator box for section layout and drag assertions. */
const readBox = async (locator: Locator) => {
  /** Current element box returned by Playwright. */
  const box = await locator.boundingBox()
  if (!box) throw new Error('Accordion element has no bounding box')
  return box
}

/** Asserts geometry using the repository's explicit one- or two-pixel tolerance. */
const expectWithinPx = (actualPx: number, expectedPx: number, tolerancePx = 2): void => {
  expect(Math.abs(actualPx - expectedPx)).toBeLessThanOrEqual(tolerancePx)
}

/** Drags one sash from its center by the requested vertical pointer distance. */
const dragSashBy = async (
  mainWindow: Page,
  sash: Locator,
  deltaYPx: number,
  beforeRelease?: () => Promise<void>
): Promise<void> => {
  await sash.scrollIntoViewIfNeeded()
  /** Four-pixel sash hitbox used to choose a stable pointer-down coordinate. */
  const sashBox = await readBox(sash)
  /** Horizontal center of the full-width sash. */
  const pointerX = sashBox.x + sashBox.width / 2
  /** Vertical center of the four-pixel sash hitbox. */
  const pointerY = sashBox.y + sashBox.height / 2
  await mainWindow.mouse.move(pointerX, pointerY)
  await mainWindow.mouse.down()
  await mainWindow.mouse.move(pointerX, pointerY + deltaYPx)
  await beforeRelease?.()
  await mainWindow.mouse.up()
}

describe('Accordion', () => {
  test('distributes configured heights and renders sashes only between expanded sections', async ({
    testSetup
  }) => {
    /** Running Test Screen with the accordion demo mounted. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.clickNavButton('Test Screen')

    /** Accordion root and ordered resizable sections. */
    const accordion = mainWindow.locator('[data-testid="test-screen-accordion"]')
    /** Research section using the default configured height. */
    const research = mainWindow.locator('[data-testid="test-screen-accordion-section-research"]')
    /** Active section using the default configured height. */
    const active = mainWindow.locator('[data-testid="test-screen-accordion-section-active"]')
    /** Completed section with a higher configured content minimum. */
    const completed = mainWindow.locator(
      '[data-testid="test-screen-accordion-section-completed"]'
    )
    /** Clickable research section header. */
    const researchHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-research"]'
    )
    /** Clickable active section header. */
    const activeHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-active"]'
    )
    /** Clickable completed section header. */
    const completedHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-completed"]'
    )
    /** Active-section sash rendered below the first expanded section. */
    const activeSash = mainWindow.locator('[data-testid="test-screen-accordion-sash-active"]')
    /** Completed-section sash rendered below another expanded section. */
    const completedSash = mainWindow.locator(
      '[data-testid="test-screen-accordion-sash-completed"]'
    )

    await expect(researchHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(researchHeader.locator('.cthulhuUiAccordionChevron')).toHaveCSS(
      'transform',
      'matrix(0, 1, -1, 0, 0, 0)'
    )
    await expect(researchHeader.locator('.cthulhuUiAccordionIcon')).toHaveClass(/lucide-search/)
    await expect(activeHeader.locator('.cthulhuUiAccordionIcon')).toHaveClass(/lucide-list-todo/)
    await expect(completedHeader.locator('.cthulhuUiAccordionIcon')).toHaveClass(
      /lucide-circle-check-big/
    )
    await expect(researchHeader.locator('.cthulhuUiAccordionCount')).toHaveText('8')
    await expect(activeHeader.locator('.cthulhuUiAccordionCount')).toHaveText('20')
    await expect(completedHeader.locator('.cthulhuUiAccordionCount')).toHaveText('5')

    /** Initially equal section boxes produced by the shared 200px configured defaults. */
    const initialBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    /** Total section height used for equal proportional expectations. */
    const totalHeightPx = initialBoxes.reduce((sum, box) => sum + box.height, 0)
    for (const box of initialBoxes) {
      expect(Math.abs(box.height - totalHeightPx / 3)).toBeLessThanOrEqual(2)
    }
    /** Active header position before toggling its content. */
    const initialActiveHeaderBox = await readBox(activeHeader)
    /** Active header offset within the accordion before viewport scrolling caused by its click. */
    const initialActiveHeaderOffsetPx = initialActiveHeaderBox.y - (await readBox(accordion)).y

    await expect(
      mainWindow.locator('[data-testid="test-screen-accordion-sash-research"]')
    ).toHaveCount(0)
    await expect(activeSash).toHaveCSS('height', '4px')
    await expect(completedSash).toHaveCSS('height', '4px')

    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'false')
    /** Root box used as the fixed section-stack origin. */
    const accordionBox = await readBox(accordion)
    /** Collapsed active box fixed between two expanded sections. */
    const collapsedActiveBox = await readBox(active)
    /** Research box proving a section above the clicked header did not grow. */
    const researchBoxAfterActiveCollapse = await readBox(research)
    /** Completed box receiving all height released by the collapsed active section. */
    const completedBoxAfterActiveCollapse = await readBox(completed)
    /** Active header position after collapsing its content. */
    const collapsedActiveHeaderBox = await readBox(activeHeader)
    expectWithinPx(collapsedActiveBox.height, COLLAPSED_HEIGHT_PX, 1)
    expectWithinPx(researchBoxAfterActiveCollapse.height, initialBoxes[0]!.height, 1)
    expectWithinPx(
      completedBoxAfterActiveCollapse.height,
      initialBoxes[2]!.height + initialBoxes[1]!.height - COLLAPSED_HEIGHT_PX,
      1
    )
    expectWithinPx(collapsedActiveHeaderBox.y - accordionBox.y, initialActiveHeaderOffsetPx, 1)
    await expect(activeSash).toHaveCount(0)
    await expect(completedSash).toHaveCount(1)

    await activeHeader.click()
    /** Restored boxes after the bottom section returns the active section's expansion height. */
    const restoredBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    for (const [index, box] of restoredBoxes.entries()) {
      expectWithinPx(box.height, initialBoxes[index]!.height, 1)
    }
    expectWithinPx(
      (await readBox(activeHeader)).y - (await readBox(accordion)).y,
      initialActiveHeaderOffsetPx,
      1
    )

    await completedHeader.click()
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')
    /** Bottom section collapsed in place against the accordion's bottom edge. */
    const collapsedCompletedBox = await readBox(completed)
    expectWithinPx(collapsedCompletedBox.height, COLLAPSED_HEIGHT_PX, 1)
    expectWithinPx(
      collapsedCompletedBox.y,
      accordionBox.y + accordionBox.height - COLLAPSED_HEIGHT_PX,
      1
    )
    expectWithinPx((await readBox(research)).height, initialBoxes[0]!.height, 1)
    expectWithinPx((await readBox(active)).height, initialBoxes[1]!.height, 1)

    await completedHeader.click()
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'true')
    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'false')
    await completedHeader.click()
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')
    /** Trailing collapsed sections chained together at the accordion's bottom edge. */
    const trailingCollapsedBoxes = await Promise.all([readBox(active), readBox(completed)])
    for (const [index, box] of trailingCollapsedBoxes.entries()) {
      expectWithinPx(box.height, COLLAPSED_HEIGHT_PX, 1)
      expectWithinPx(
        box.y,
        accordionBox.y + accordionBox.height - (2 - index) * COLLAPSED_HEIGHT_PX,
        1
      )
    }
    expectWithinPx((await readBox(research)).height, initialBoxes[0]!.height, 1)

    await completedHeader.click()
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'true')
    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')
    /** Restored section boxes after reversing the trailing collapse sequence. */
    const restoredTrailingBoxes = await Promise.all([
      readBox(research),
      readBox(active),
      readBox(completed)
    ])
    for (const [index, box] of restoredTrailingBoxes.entries()) {
      expectWithinPx(box.height, initialBoxes[index]!.height, 1)
    }

    await activeHeader.click()
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'false')

    await dragSashBy(mainWindow, completedSash, -20)
    /** Active box after cross-collapsed-section dragging remains fixed at 36px. */
    const activeBoxAfterSkippedDrag = await readBox(active)
    expectWithinPx(activeBoxAfterSkippedDrag.height, COLLAPSED_HEIGHT_PX, 1)

    await researchHeader.click()
    await expect(researchHeader).toHaveAttribute('aria-expanded', 'false')
    /** Collapsed research box proving the first header stays at the root's top edge. */
    const collapsedResearchBox = await readBox(research)
    expectWithinPx(collapsedResearchBox.height, COLLAPSED_HEIGHT_PX, 1)
    expectWithinPx(collapsedResearchBox.y, accordionBox.y, 1)
    await expect(completedSash).toHaveCount(0)

    await completedHeader.click()
    /** Fully collapsed section boxes that collect at the top without flexible gaps. */
    const collapsedBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    for (const [index, box] of collapsedBoxes.entries()) {
      expectWithinPx(box.height, COLLAPSED_HEIGHT_PX, 1)
      expectWithinPx(box.y, accordionBox.y + index * COLLAPSED_HEIGHT_PX, 1)
    }
  })

  test('cascades expansion bottom-up before moving the clicked header', async ({
    electronApp,
    testSetup
  }) => {
    /** Workspace whose collapsed top section forces a multi-section expansion cascade. */
    const workspacePath = '/ws/accordion-toggle-cascade'
    /** Stable workspace persistence identifier for the seeded accordion state. */
    const workspaceId = createDeterministicId(workspacePath)
    /** Initial state with both sections below research sharing all expanded space. */
    const seededSections = createAccordionSections([
      { id: 'research', isExpanded: false, configuredExpandedHeightPx: 200 },
      { id: 'active', isExpanded: true, configuredExpandedHeightPx: 200 },
      { id: 'completed', isExpanded: true, configuredExpandedHeightPx: 200 }
    ])

    await testSetup.setupFilesystem(setupWorkspaceScenario(workspacePath, 'minimal'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [],
      accordionViewEntries: [
        { persistenceId: TEST_ACCORDION_PERSISTENCE_ID, sections: seededSections }
      ]
    })

    /** Running seeded accordion used to exercise toggle-only height cascades. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.clickNavButton('Test Screen')

    /** Accordion root whose height remains fixed throughout the toggle sequence. */
    const accordion = mainWindow.locator('[data-testid="test-screen-accordion"]')
    /** Research section above the clicked active header. */
    const research = mainWindow.locator('[data-testid="test-screen-accordion-section-research"]')
    /** Active section expanded after the bottom section reaches its minimum. */
    const active = mainWindow.locator('[data-testid="test-screen-accordion-section-active"]')
    /** Completed section with the larger configured expanded minimum. */
    const completed = mainWindow.locator(
      '[data-testid="test-screen-accordion-section-completed"]'
    )
    /** Research header expanded to trigger bottom-up shrinking below it. */
    const researchHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-research"]'
    )
    /** Active header whose fallback movement is measured. */
    const activeHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-active"]'
    )

    await expect(researchHeader).toHaveAttribute('aria-expanded', 'false')
    /** Fixed section-stack height used for proportional expansion targets. */
    const accordionHeightPx = (await readBox(accordion)).height
    /** Initial layout with the two expanded lower sections sharing available height. */
    const initialBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    expectWithinPx(initialBoxes[0]!.height, COLLAPSED_HEIGHT_PX, 1)
    expectWithinPx(initialBoxes[1]!.height, (accordionHeightPx - COLLAPSED_HEIGHT_PX) / 2)
    expectWithinPx(initialBoxes[2]!.height, (accordionHeightPx - COLLAPSED_HEIGHT_PX) / 2)

    await researchHeader.click()
    /** Equal configured-height target for research when all three sections are expanded. */
    const researchTargetHeightPx = accordionHeightPx / 3
    /** Capacity supplied by completed before it reaches its configured expanded minimum. */
    const completedCapacityPx =
      initialBoxes[2]!.height - COMPLETED_MINIMUM_EXPANDED_HEIGHT_PX
    /** Remaining expansion supplied by active only after completed reaches its minimum. */
    const activeContributionPx =
      researchTargetHeightPx - COLLAPSED_HEIGHT_PX - completedCapacityPx
    /** Layout proving the bottom section reaches minimum before the nearer section shrinks. */
    const afterResearchExpansionBoxes = await Promise.all([
      readBox(research),
      readBox(active),
      readBox(completed)
    ])
    expectWithinPx(afterResearchExpansionBoxes[0]!.height, researchTargetHeightPx)
    expectWithinPx(
      afterResearchExpansionBoxes[1]!.height,
      initialBoxes[1]!.height - activeContributionPx
    )
    expectWithinPx(
      afterResearchExpansionBoxes[2]!.height,
      COMPLETED_MINIMUM_EXPANDED_HEIGHT_PX,
      1
    )

    await researchHeader.click()
    /** Layout proving collapse gives all released space to the bottommost expanded section. */
    const afterResearchCollapseBoxes = await Promise.all([
      readBox(research),
      readBox(active),
      readBox(completed)
    ])
    expectWithinPx(afterResearchCollapseBoxes[0]!.height, COLLAPSED_HEIGHT_PX, 1)
    expectWithinPx(
      afterResearchCollapseBoxes[1]!.height,
      afterResearchExpansionBoxes[1]!.height
    )
    expectWithinPx(
      afterResearchCollapseBoxes[2]!.height,
      afterResearchExpansionBoxes[2]!.height +
        researchTargetHeightPx -
        COLLAPSED_HEIGHT_PX
    )

    await activeHeader.click()
    await researchHeader.click()

    /** Layout with research and completed expanded before active requests its target height. */
    const beforeActiveExpansionBoxes = await Promise.all([
      readBox(research),
      readBox(active),
      readBox(completed)
    ])
    /** Active header position before the below-section capacity is exhausted. */
    const beforeActiveHeaderBox = await readBox(activeHeader)
    /** Active header offset within the accordion before fallback shrinking above it. */
    const beforeActiveHeaderOffsetPx = beforeActiveHeaderBox.y - (await readBox(accordion)).y
    expectWithinPx(beforeActiveExpansionBoxes[0]!.height, (accordionHeightPx - 36) / 2)
    expectWithinPx(beforeActiveExpansionBoxes[1]!.height, COLLAPSED_HEIGHT_PX, 1)
    expectWithinPx(beforeActiveExpansionBoxes[2]!.height, (accordionHeightPx - 36) / 2)

    await activeHeader.click()
    /** Layout after completed shrinks first and research supplies only the remaining deficit. */
    const afterActiveExpansionBoxes = await Promise.all([
      readBox(research),
      readBox(active),
      readBox(completed)
    ])
    /** Equal configured-height target for active when all three sections are expanded. */
    const activeTargetHeightPx = accordionHeightPx / 3
    /** Capacity supplied by completed before it again reaches its expanded minimum. */
    const fallbackCompletedCapacityPx =
      beforeActiveExpansionBoxes[2]!.height - COMPLETED_MINIMUM_EXPANDED_HEIGHT_PX
    /** Remaining expansion taken from research after below-section capacity is exhausted. */
    const aboveFallbackPx =
      activeTargetHeightPx - COLLAPSED_HEIGHT_PX - fallbackCompletedCapacityPx
    expectWithinPx(
      afterActiveExpansionBoxes[0]!.height,
      beforeActiveExpansionBoxes[0]!.height - aboveFallbackPx
    )
    expectWithinPx(afterActiveExpansionBoxes[1]!.height, activeTargetHeightPx)
    expectWithinPx(
      afterActiveExpansionBoxes[2]!.height,
      COMPLETED_MINIMUM_EXPANDED_HEIGHT_PX,
      1
    )
    /** Active header offset after fallback shrinking changes the height above it. */
    const afterActiveHeaderOffsetPx =
      (await readBox(activeHeader)).y - (await readBox(accordion)).y
    expectWithinPx(
      beforeActiveHeaderOffsetPx - afterActiveHeaderOffsetPx,
      aboveFallbackPx,
      1
    )
  })

  test('cascades sash drags through minimums and saves only actual left-button changes', async ({
    electronApp,
    testSetup
  }) => {
    /** Workspace whose seeded configured heights reveal accidental press-only persistence. */
    const workspacePath = '/ws/accordion-dragging'
    /** Stable workspace persistence identifier for direct SQLite assertions. */
    const workspaceId = createDeterministicId(workspacePath)
    /** Original complete accordion entry saved before the component is mounted. */
    const seededSections = createAccordionSections([
      { id: 'research', isExpanded: true, configuredExpandedHeightPx: 200 },
      { id: 'active', isExpanded: true, configuredExpandedHeightPx: 200 },
      { id: 'completed', isExpanded: true, configuredExpandedHeightPx: 200 }
    ])

    await testSetup.setupFilesystem(setupWorkspaceScenario(workspacePath, 'minimal'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [],
      accordionViewEntries: [
        { persistenceId: TEST_ACCORDION_PERSISTENCE_ID, sections: seededSections }
      ]
    })

    /** Running seeded workspace with the resizable accordion mounted. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.clickNavButton('Test Screen')

    /** Research section that grows during a downward active-sash drag. */
    const research = mainWindow.locator('[data-testid="test-screen-accordion-section-research"]')
    /** Active section that absorbs the first downward shrink. */
    const active = mainWindow.locator('[data-testid="test-screen-accordion-section-active"]')
    /** Completed section that receives the remainder after active reaches its minimum. */
    const completed = mainWindow.locator(
      '[data-testid="test-screen-accordion-section-completed"]'
    )
    /** Sash controlling the boundary above the active section. */
    const activeSash = mainWindow.locator('[data-testid="test-screen-accordion-sash-active"]')
    /** Sash controlling the boundary above the completed section. */
    const completedSash = mainWindow.locator(
      '[data-testid="test-screen-accordion-sash-completed"]'
    )

    /** Initial proportional boxes before any user resizing. */
    const initialBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    await activeSash.scrollIntoViewIfNeeded()
    /** Center coordinate used for a press and release with no movement. */
    const activeSashBox = await readBox(activeSash)
    await mainWindow.mouse.click(
      activeSashBox.x + activeSashBox.width / 2,
      activeSashBox.y + activeSashBox.height / 2
    )
    await testHelpers.navigateToHomeScreen()
    await mainWindow.waitForTimeout(2200)

    /** SQLite state proving a press without movement did not promote displayed sizes. */
    const pressOnlyUiState = await readWorkspaceUiState(electronApp, workspaceId)
    expect(pressOnlyUiState.accordionViewEntries[0]?.sections).toEqual(seededSections)

    await testHelpers.clickNavButton('Test Screen')
    await dragSashBy(mainWindow, activeSash, 200, async () => {
      await expect(activeSash).toHaveAttribute('data-dragging', 'true')
      /** Active overlay and blue palette colors resolved by Chromium for exact comparison. */
      const overlayColors = await activeSash.evaluate((element) => {
        /** Temporary element that resolves the palette token through the same CSS property. */
        const expectedElement = document.createElement('div')
        expectedElement.style.backgroundColor = 'var(--ui-info-strong-border)'
        document.body.append(expectedElement)
        /** Browser-normalized active sash and expected palette colors. */
        const colors = {
          actual: getComputedStyle(element).backgroundColor,
          expected: getComputedStyle(expectedElement).backgroundColor
        }
        expectedElement.remove()
        return colors
      })
      expect(overlayColors.actual).toBe(overlayColors.expected)
    })

    /** Total section height preserved throughout every drag cascade. */
    const initialTotalHeightPx = initialBoxes.reduce((sum, box) => sum + box.height, 0)
    /** Boxes after downward cascading reaches both active and completed minimums. */
    const downwardBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    expectWithinPx(downwardBoxes[0]!.height, initialTotalHeightPx - 236)
    expectWithinPx(downwardBoxes[1]!.height, 100)
    expectWithinPx(downwardBoxes[2]!.height, 136)
    await expect(activeSash).toHaveAttribute('data-dragging', 'false')

    await dragSashBy(mainWindow, completedSash, -400)
    /** Boxes after upward cascading skips active at minimum and exhausts research capacity. */
    const upwardBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    expectWithinPx(upwardBoxes[0]!.height, 100)
    expectWithinPx(upwardBoxes[1]!.height, 100)
    expectWithinPx(upwardBoxes[2]!.height, initialTotalHeightPx - 200)

    /** Heights before a rejected right-button drag attempt. */
    const beforeRightDragBoxes = upwardBoxes
    await completedSash.scrollIntoViewIfNeeded()
    /** Completed sash hitbox used for the right-button attempt. */
    const completedSashBox = await readBox(completedSash)
    /** Horizontal pointer coordinate inside the completed sash. */
    const rightDragX = completedSashBox.x + completedSashBox.width / 2
    /** Vertical pointer coordinate inside the completed sash. */
    const rightDragY = completedSashBox.y + completedSashBox.height / 2
    await mainWindow.mouse.move(rightDragX, rightDragY)
    await mainWindow.mouse.down({ button: 'right' })
    await mainWindow.mouse.move(rightDragX, rightDragY + 80)
    await mainWindow.mouse.up({ button: 'right' })
    /** Heights after the right-button attempt proving only left-button dragging is accepted. */
    const afterRightDragBoxes = await Promise.all([
      readBox(research),
      readBox(active),
      readBox(completed)
    ])
    for (const [index, box] of afterRightDragBoxes.entries()) {
      expectWithinPx(box.height, beforeRightDragBoxes[index]!.height, 1)
    }

    await testHelpers.navigateToHomeScreen()
    await expect
      .poll(async () => {
        /** Complete accordion entry after the debounced drag autosave flush. */
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        return persisted.accordionViewEntries[0]?.sections.map((section) =>
          Math.round(section.configuredExpandedHeightPx)
        )
      })
      .toEqual([100, 100, 358])
  })

  test('persists complete section state by workspace and redistributes without reconfiguring', async ({
    electronApp,
    testSetup
  }) => {
    /** Primary workspace shown by the application. */
    const workspacePath = '/ws/accordion-persistence'
    /** Stable primary workspace persistence ID. */
    const workspaceId = createDeterministicId(workspacePath)
    /** Separate workspace proving accordion state is workspace-scoped. */
    const otherWorkspaceId = createDeterministicId('/ws/other-accordion-persistence')
    /** Primary accordion state with one expanded section and retained expanded sizes. */
    const primarySections = createAccordionSections([
      { id: 'research', isExpanded: false, configuredExpandedHeightPx: 200 },
      { id: 'active', isExpanded: true, configuredExpandedHeightPx: 300 },
      { id: 'completed', isExpanded: false, configuredExpandedHeightPx: 400 }
    ])
    /** Same persistence ID under another workspace. */
    const otherWorkspaceSections = createAccordionSections([
      { id: 'research', isExpanded: true, configuredExpandedHeightPx: 250 },
      { id: 'active', isExpanded: false, configuredExpandedHeightPx: 350 },
      { id: 'completed', isExpanded: false, configuredExpandedHeightPx: 450 }
    ])

    await testSetup.setupFilesystem(setupWorkspaceScenario(workspacePath, 'minimal'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [],
      accordionViewEntries: [
        { persistenceId: TEST_ACCORDION_PERSISTENCE_ID, sections: primarySections },
        {
          persistenceId: 'other-accordion',
          sections: createAccordionSections([
            { id: 'other-section', isExpanded: true, configuredExpandedHeightPx: 275 }
          ])
        }
      ]
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId: otherWorkspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [],
      accordionViewEntries: [
        {
          persistenceId: TEST_ACCORDION_PERSISTENCE_ID,
          sections: otherWorkspaceSections
        }
      ]
    })

    /** Running primary workspace restored from user persistence. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.clickNavButton('Test Screen')

    /** Research header restored collapsed from the primary workspace row. */
    const researchHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-research"]'
    )
    /** Completed header restored collapsed from the primary workspace row. */
    const completedHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-completed"]'
    )
    /** Active header restored expanded from the primary workspace row. */
    const activeHeader = mainWindow.locator('[data-testid="test-screen-accordion-header-active"]')
    /** Research section measured before and after proportional container resizing. */
    const research = mainWindow.locator('[data-testid="test-screen-accordion-section-research"]')
    /** Active section measured before and after proportional container resizing. */
    const active = mainWindow.locator('[data-testid="test-screen-accordion-section-active"]')
    /** Accordion root whose shell is resized to emulate available window-height changes. */
    const accordion = mainWindow.locator('[data-testid="test-screen-accordion"]')

    await expect(researchHeader).toHaveAttribute('aria-expanded', 'false')
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')

    await researchHeader.click()
    /** Expanded boxes sharing available space in their configured 2:3 ratio. */
    const initialExpandedBoxes = await Promise.all([readBox(research), readBox(active)])
    /** Accordion viewport before its containing shell changes height. */
    const initialAccordionBox = await readBox(accordion)
    /** Initial expanded height remaining after the completed collapsed header. */
    const initialAvailableHeightPx = initialAccordionBox.height - COLLAPSED_HEIGHT_PX
    expectWithinPx(initialExpandedBoxes[0]!.height, initialAvailableHeightPx * (2 / 5))
    expectWithinPx(initialExpandedBoxes[1]!.height, initialAvailableHeightPx * (3 / 5))

    await accordion.evaluate((element) => {
      /** Demo shell resized to trigger the accordion's ResizeObserver. */
      const shell = element.parentElement
      if (shell) shell.style.height = '660px'
    })
    /** Resized accordion viewport excluding the shell's two one-pixel borders. */
    const resizedAccordionHeightPx = 658
    /** Resized research height expected from its configured two-fifths share. */
    const resizedResearchHeightPx =
      (resizedAccordionHeightPx - COLLAPSED_HEIGHT_PX) * (2 / 5)
    await expect
      .poll(async () => Math.abs((await readBox(research)).height - resizedResearchHeightPx))
      .toBeLessThanOrEqual(2)
    /** Resized boxes proving configured proportions survive viewport redistribution. */
    const resizedBoxes = await Promise.all([readBox(research), readBox(active)])
    expectWithinPx(resizedBoxes[0]!.height, resizedResearchHeightPx)
    expectWithinPx(
      resizedBoxes[1]!.height,
      (resizedAccordionHeightPx - COLLAPSED_HEIGHT_PX) * (3 / 5)
    )

    await testHelpers.navigateToHomeScreen()
    await expect
      .poll(async () => {
        /** Primary persisted entries after the whole-accordion autosave flush. */
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        /** Updated Test Screen accordion entry. */
        const testAccordion = persisted.accordionViewEntries.find(
          (entry) => entry.persistenceId === TEST_ACCORDION_PERSISTENCE_ID
        )
        /** Same-workspace entry owned by another accordion instance. */
        const otherAccordion = persisted.accordionViewEntries.find(
          (entry) => entry.persistenceId === 'other-accordion'
        )
        return {
          testSections: testAccordion?.sections,
          otherSections: otherAccordion?.sections
        }
      })
      .toEqual({
        testSections: [
          { ...primarySections[0]!, isExpanded: true },
          primarySections[1],
          primarySections[2]
        ],
        otherSections: createAccordionSections([
          { id: 'other-section', isExpanded: true, configuredExpandedHeightPx: 275 }
        ])
      })

    /** State under the same persistence ID in another workspace. */
    const otherWorkspaceUiState = await readWorkspaceUiState(electronApp, otherWorkspaceId)
    expect(otherWorkspaceUiState.accordionViewEntries[0]?.sections).toEqual(
      otherWorkspaceSections
    )

    await testHelpers.clickNavButton('Test Screen')
    await expect(researchHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')
  })
})
