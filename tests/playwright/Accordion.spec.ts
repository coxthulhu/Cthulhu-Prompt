import type { Locator } from '@playwright/test'
import { getWorkspaceInfoPath, setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  readWorkspacePersistence,
  seedUserPersistence,
  seedWorkspacePersistence
} from '../helpers/UserPersistenceHelpers'

/** Playwright fixtures and assertions configured for the Electron application. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Test Screen accordion persistence ID shared with its demo component. */
const TEST_ACCORDION_PERSISTENCE_ID = 'test-screen-prompt-status'

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

/** Reads a required locator box for weighted layout assertions. */
const readBox = async (locator: Locator) => {
  /** Current element box returned by Playwright. */
  const box = await locator.boundingBox()
  if (!box) throw new Error('Accordion element has no bounding box')
  return box
}

describe('Accordion', () => {
  test('distributes expanded space by weight and collapses toward its edge', async ({
    testSetup
  }) => {
    /** Running Test Screen with the accordion demo mounted. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    await testHelpers.clickNavButton('Test Screen')

    /** Accordion root and ordered weighted sections. */
    const accordion = mainWindow.locator('[data-testid="test-screen-accordion"]')
    /** Research section with weight two. */
    const research = mainWindow.locator('[data-testid="test-screen-accordion-section-research"]')
    /** Active section with weight five. */
    const active = mainWindow.locator('[data-testid="test-screen-accordion-section-active"]')
    /** Completed section with weight three. */
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

    /** Initially weighted section boxes. */
    const initialBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    /** Total accordion section height used for proportional expectations. */
    const totalHeight = initialBoxes.reduce((sum, box) => sum + box.height, 0)
    expect(Math.abs(initialBoxes[0]!.height - totalHeight * 0.2)).toBeLessThanOrEqual(2)
    expect(Math.abs(initialBoxes[1]!.height - totalHeight * 0.5)).toBeLessThanOrEqual(2)
    expect(Math.abs(initialBoxes[2]!.height - totalHeight * 0.3)).toBeLessThanOrEqual(2)

    await completedHeader.click()
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')
    /** Root and collapsed bottom boxes proving the last header stays at the bottom edge. */
    const accordionBox = await readBox(accordion)
    /** Collapsed completed section box. */
    const collapsedCompletedBox = await readBox(completed)
    expect(Math.abs(collapsedCompletedBox.height - 36)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        collapsedCompletedBox.y + collapsedCompletedBox.height -
          (accordionBox.y + accordionBox.height)
      )
    ).toBeLessThanOrEqual(1)
    /** Expanded boxes after the collapsed section's weight is removed. */
    const redistributedBoxes = await Promise.all([readBox(research), readBox(active)])
    /** Remaining weighted height after reserving the collapsed header. */
    const redistributedHeight = accordionBox.height - collapsedCompletedBox.height
    expect(
      Math.abs(redistributedBoxes[0]!.height - redistributedHeight * (2 / 7))
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(redistributedBoxes[1]!.height - redistributedHeight * (5 / 7))
    ).toBeLessThanOrEqual(2)
    await expect(completedHeader.locator('.cthulhuUiAccordionChevron')).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 0)'
    )

    await researchHeader.click()
    /** Collapsed research section box proving the first header stays at the top edge. */
    const collapsedResearchBox = await readBox(research)
    expect(Math.abs(collapsedResearchBox.height - 36)).toBeLessThanOrEqual(1)
    expect(Math.abs(collapsedResearchBox.y - accordionBox.y)).toBeLessThanOrEqual(1)

    await activeHeader.click()
    /** Fully collapsed section boxes that should collect at the top without gaps. */
    const collapsedBoxes = await Promise.all([readBox(research), readBox(active), readBox(completed)])
    for (const [index, box] of collapsedBoxes.entries()) {
      expect(Math.abs(box.height - 36)).toBeLessThanOrEqual(1)
      expect(Math.abs(box.y - (accordionBox.y + index * 36))).toBeLessThanOrEqual(1)
    }
  })

  test('persists expansion by workspace and accordion persistence ID', async ({
    electronApp,
    testSetup
  }) => {
    /** Primary workspace shown by the application. */
    const workspacePath = '/ws/accordion-persistence'
    /** Stable primary workspace persistence ID. */
    const workspaceId = createDeterministicId(workspacePath)
    /** Separate workspace proving expansion state is workspace-scoped. */
    const otherWorkspaceId = createDeterministicId('/ws/other-accordion-persistence')

    await testSetup.setupFilesystem(setupWorkspaceScenario(workspacePath, 'minimal'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [],
      accordionViewEntries: [
        { persistenceId: TEST_ACCORDION_PERSISTENCE_ID, expandedSectionIds: ['active'] },
        { persistenceId: 'other-accordion', expandedSectionIds: ['other-section'] }
      ]
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId: otherWorkspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [],
      accordionViewEntries: [
        { persistenceId: TEST_ACCORDION_PERSISTENCE_ID, expandedSectionIds: ['research'] }
      ]
    })

    /** Running primary workspace restored from user persistence. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.clickNavButton('Test Screen')

    /** Research header restored collapsed from the primary workspace database row. */
    const researchHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-research"]'
    )
    /** Completed header restored collapsed from the primary workspace database row. */
    const completedHeader = mainWindow.locator(
      '[data-testid="test-screen-accordion-header-completed"]'
    )
    /** Active header restored expanded from the primary workspace database row. */
    const activeHeader = mainWindow.locator('[data-testid="test-screen-accordion-header-active"]')
    await expect(researchHeader).toHaveAttribute('aria-expanded', 'false')
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')

    await researchHeader.click()
    await testHelpers.navigateToHomeScreen()

    await expect
      .poll(
        async () => {
          /** Primary persisted entries after the accordion autosave flush. */
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          /** Updated Test Screen accordion entry. */
          const testAccordion = persisted.accordionViewEntries.find(
            (entry) => entry.persistenceId === TEST_ACCORDION_PERSISTENCE_ID
          )
          /** Same-workspace entry owned by another accordion instance. */
          const otherAccordion = persisted.accordionViewEntries.find(
            (entry) => entry.persistenceId === 'other-accordion'
          )
          return `${testAccordion?.expandedSectionIds.join(',')}:${otherAccordion?.expandedSectionIds.join(',')}`
        },
        { timeout: 15000 }
      )
      .toBe('research,active:other-section')

    /** State under the same persistence ID in another workspace. */
    const otherWorkspacePersistence = await readWorkspacePersistence(electronApp, otherWorkspaceId)
    expect(otherWorkspacePersistence.accordionViewEntries[0]?.expandedSectionIds).toEqual([
      'research'
    ])

    await testHelpers.clickNavButton('Test Screen')
    await expect(researchHeader).toHaveAttribute('aria-expanded', 'true')
    await expect(completedHeader).toHaveAttribute('aria-expanded', 'false')
    await expect(activeHeader).toHaveAttribute('aria-expanded', 'true')
  })
})
