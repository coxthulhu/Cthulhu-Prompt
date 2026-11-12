import type { Page } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { resolvePaletteColors } from '../helpers/PaletteHelpers'
import { readWorkspaceState, readWorkspaceUiState, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Lucide icon class rendered for each persisted work tab screen. */
const WORK_TAB_ICON_CLASSES = {
  'new-tab': 'lucide-layout-grid',
  'prompt-collection': 'lucide-file-text',
  'template-collection': 'lucide-layers'
} as const

/** Persisted tab state read directly from this machine's application record. */
type PersistedTabState = {
  workTabs: Array<{ id: string; title: string; screen: keyof typeof WORK_TAB_ICON_CLASSES }>
  selectedTabId: string | null
}

/** Reads the saved work tabs and selected tab without production reconstruction code. */
const readTabState = async (electronApp: ElectronApplication): Promise<PersistedTabState> =>
  (await readWorkspaceState<PersistedTabState>(electronApp, null, 'application-machine', null))!

/** Work tab body buttons in display order. */
const getTabs = (mainWindow: Page) => mainWindow.getByTestId('work-tab').getByRole('tab')

/** Work tab button with the given title. */
const getTab = (mainWindow: Page, title: string) =>
  mainWindow.getByRole('tab', { name: title, exact: true })

/** Asserts exactly the given work tab is selected. */
const expectSelectedTab = async (mainWindow: Page, title: string): Promise<void> => {
  await expect(getTab(mainWindow, title)).toHaveAttribute('aria-selected', 'true')
  await expect(mainWindow.getByTestId('work-tab').getByRole('tab', { selected: true })).toHaveCount(1)
}

/** Asserts no work tab is selected. */
const expectNoSelectedTab = async (mainWindow: Page): Promise<void> => {
  await expect(mainWindow.getByTestId('work-tab').getByRole('tab', { selected: true })).toHaveCount(0)
}

/** Asserts a work tab, including any drag offset, stays in the title bar row with its left edge within 1px of the expected position. */
const expectTabAt = async (mainWindow: Page, title: string, left: number): Promise<void> => {
  await expect.poll(async () => {
    const box = (await getTab(mainWindow, title).boundingBox())!
    return Math.max(Math.abs(box.x - left), Math.abs(box.y))
  }, { message: `${title} position` }).toBeLessThanOrEqual(1)
}

describe('Work Tabs', () => {
  test('fills the title bar around the screen and tab pills with click targets without moving the pills', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart()
    const newTabButton = mainWindow.getByTestId('new-tab-button')
    for (let index = 0; index < 3; index += 1) await newTabButton.click()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(3)

    // Pills, icons, and close buttons keep the 307 mockup geometry inside the full-size hit areas.
    /** Measured geometry as [label, actual, expected] rows, in pixels. */
    const measurements = await mainWindow.evaluate(() => {
      const screenButtons = [...document.querySelectorAll<HTMLElement>('.titlebar [aria-label="Screens"] button')]
      const tabs = [...document.querySelectorAll<HTMLElement>('[data-testid="work-tab"]')]
      const newTab = document.querySelector<HTMLElement>('[data-testid="new-tab-button"]')!
      /** App icon immediately before the screen buttons. */
      const appIcon = document.querySelector('.titlebar__app-icon')!.getBoundingClientRect()
      /** Divider between the screen buttons and the tab strip. */
      const separator = document.querySelector('.titlebar [aria-label="Open tabs"]')!.previousElementSibling!.getBoundingClientRect()
      /** Visible pill drawn by an element's inset ::before backdrop. */
      const getPill = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect()
        const inset = getComputedStyle(element, '::before')
        return {
          left: rect.left + parseFloat(inset.left),
          right: rect.right - parseFloat(inset.right),
          top: rect.top + parseFloat(inset.top),
          bottom: rect.bottom - parseFloat(inset.bottom)
        }
      }
      const screenPills = screenButtons.map(getPill)
      const pills = tabs.map(getPill)
      const newTabPill = getPill(newTab)
      const rows: Array<[string, number, number]> = [
        ['first screen pill after app icon', screenPills[0]!.left - appIcon.right, 13],
        ['divider after last screen pill', separator.left - screenPills.at(-1)!.right, 12],
        ['first pill after divider', pills[0]!.left - separator.right, 10],
        ['New Tab pill after last pill', newTabPill.left - pills.at(-1)!.right, 4],
        ['New Tab pill top', newTabPill.top, 4],
        ['New Tab pill height', newTabPill.bottom - newTabPill.top, 36],
        ['New Tab pill width', newTabPill.right - newTabPill.left, 36]
      ]
      pills.forEach((pill, index) => {
        const tab = tabs[index]!
        rows.push(
          [`tab ${index} pill top`, pill.top, 4],
          [`tab ${index} pill height`, pill.bottom - pill.top, 36],
          [`tab ${index} pill width`, pill.right - pill.left, 218],
          [`tab ${index} icon inset`, tab.querySelector('[role="tab"] svg')!.getBoundingClientRect().left - pill.left, 11],
          [`tab ${index} close inset`, pill.right - tab.querySelector('[data-testid="work-tab-close"]')!.getBoundingClientRect().right, 6]
        )
        if (index > 0) rows.push([`tab ${index} pill gap`, pill.left - pills[index - 1]!.right, 4])
      })
      screenPills.forEach((pill, index) => {
        /** 20px screen icon, centred in its 36px pill. */
        const icon = screenButtons[index]!.querySelector('svg')!.getBoundingClientRect()
        rows.push(
          [`screen ${index} pill top`, pill.top, 4],
          [`screen ${index} pill height`, pill.bottom - pill.top, 36],
          [`screen ${index} pill width`, pill.right - pill.left, 36],
          [`screen ${index} icon inset`, icon.left - pill.left, 8],
          [`screen ${index} icon top`, icon.top, 12]
        )
        if (index > 0) rows.push([`screen ${index} pill gap`, pill.left - screenPills[index - 1]!.right, 10])
      })
      return rows
    })
    for (const [label, actual, expected] of measurements) {
      expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1)
    }

    // Six tabs shrink to fractional widths, which must still leave no gaps along either edge row.
    for (let index = 0; index < 3; index += 1) await newTabButton.click()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(6)
    /** Points on the title bar's top and bottom pixel rows that miss every no-drag button in the screen row or the tab strip. */
    const misses = await mainWindow.evaluate(() => {
      /** Screen buttons, then tabs and the New Tab button; the divider between the two groups stays draggable. */
      const groups = [
        [...document.querySelectorAll<HTMLElement>('.titlebar [aria-label="Screens"] button')],
        [...document.querySelectorAll<HTMLElement>('[data-testid="work-tab"], [data-testid="new-tab-button"]')]
      ]
      /** Title bar height, whose first and last pixel rows must both hit each group. */
      const titleBarHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-height'))
      const found: string[] = groups.flat()
        .filter((target) => getComputedStyle(target).getPropertyValue('-webkit-app-region') !== 'no-drag')
        .map((target) => `${target.dataset.testid} is draggable`)
      for (const targets of groups) {
        const left = targets[0]!.getBoundingClientRect().left
        const right = targets.at(-1)!.getBoundingClientRect().right
        for (let x = Math.ceil(left); x < right; x += 1) {
          for (const y of [0, titleBarHeight - 1]) {
            const hit = document.elementFromPoint(x, y)
            if (!targets.some((target) => target.contains(hit))) found.push(`${x},${y}`)
          }
        }
      }
      return found
    })
    expect(misses.length, misses.slice(0, 10).join(' ')).toBe(0)
  })

  test('adds, selects, limits, and closes work tabs', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    /** Title bar Home button, selected only while no work tab is selected. */
    const homeButton = mainWindow.getByTestId('nav-button-home')
    const newTabButton = mainWindow.getByTestId('new-tab-button')

    // A fresh install starts with no tabs and Home selected.
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(homeButton).toHaveAttribute('aria-current', 'page')

    // New tabs append, select themselves, and show Home.
    for (let index = 0; index < 3; index += 1) await newTabButton.click()
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 3'])
    await expectSelectedTab(mainWindow, 'Tab 3')
    await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()

    // Screen buttons and work tabs share one selection.
    await testHelpers.navigateToSettingsScreen()
    await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
    await expectNoSelectedTab(mainWindow)
    await getTab(mainWindow, 'Tab 1').click()
    await expectSelectedTab(mainWindow, 'Tab 1')
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await homeButton.click()
    await expect(homeButton).toHaveAttribute('aria-current', 'page')
    await expectNoSelectedTab(mainWindow)

    // The New Tab button disables at six tabs.
    for (let index = 0; index < 3; index += 1) await newTabButton.click()
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6'])
    await expect(newTabButton).toBeDisabled()

    // Closing the selected tab selects its right neighbour.
    await getTab(mainWindow, 'Tab 3').click()
    await mainWindow.getByRole('button', { name: 'Close Tab 3', exact: true }).click()
    await expectSelectedTab(mainWindow, 'Tab 4')
    await expect(newTabButton).toBeEnabled()

    // Middle-clicking an unselected tab closes it without changing the selection.
    await getTab(mainWindow, 'Tab 6').click({ button: 'middle' })
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 4', 'Tab 5'])
    await expectSelectedTab(mainWindow, 'Tab 4')

    // Closing the selected rightmost tab selects its left neighbour.
    await getTab(mainWindow, 'Tab 5').click()
    await getTab(mainWindow, 'Tab 5').click({ button: 'middle' })
    await expectSelectedTab(mainWindow, 'Tab 4')

    // New tabs are named one past the highest open tab number.
    await newTabButton.click()
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 4', 'Tab 5'])
    await expectSelectedTab(mainWindow, 'Tab 5')

    // Closing the last remaining tab returns the selection to Home.
    for (const title of ['Tab 5', 'Tab 4', 'Tab 2']) {
      await mainWindow.getByRole('button', { name: `Close ${title}`, exact: true }).click()
    }
    await expectSelectedTab(mainWindow, 'Tab 1')
    await mainWindow.getByRole('button', { name: 'Close Tab 1', exact: true }).click()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(homeButton).toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
  })

  test('drags a work tab over its neighbours within the strip and saves the new order', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart()
    for (let index = 0; index < 3; index += 1) await mainWindow.getByTestId('new-tab-button').click()
    await expectSelectedTab(mainWindow, 'Tab 3')
    /** Strip that holds pointer capture while a tab is dragged. */
    const tabStrip = mainWindow.getByRole('tablist', { name: 'Open tabs' })
    /** Left edges of the three tab slots before any drag. */
    const slots = await getTabs(mainWindow).evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().left))
    /** Width shared by the touching tab slots. */
    const slotWidth = slots[1]! - slots[0]!
    /** Dragged tab wrapper, which carries the drag state. */
    const draggedTab = mainWindow.getByTestId('work-tab').filter({ has: getTab(mainWindow, 'Tab 1') })
    /** Press point on Tab 1's title, clear of its close button. */
    const x = slots[0]! + 40
    /** Vertical centre of the title bar. */
    const y = (await tabStrip.boundingBox())!.height / 2
    /** Saved work tab titles in display order. */
    const readSavedTitles = async (): Promise<string[]> => (await readTabState(electronApp)).workTabs.map((tab) => tab.title)

    // Pressing selects the tab before release, and 3px of movement does not start a drag.
    await mainWindow.mouse.move(x, y)
    await mainWindow.mouse.down()
    await expectSelectedTab(mainWindow, 'Tab 1')
    await mainWindow.mouse.move(x + 3, y + 3)
    await expect(draggedTab).toHaveAttribute('data-dragging', 'false')

    // 4px of vertical movement starts the drag and captures the pointer, but only horizontal movement moves the tab.
    await mainWindow.mouse.move(x + 3, y + 4)
    await expect(draggedTab).toHaveAttribute('data-dragging', 'true')
    await expect.poll(() => tabStrip.evaluate((strip) => strip.hasPointerCapture(1))).toBe(true)
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + 3)

    // Short of half of its neighbour, the tab slides over the unmoved neighbour on an opaque selected hover fill.
    await mainWindow.mouse.move(x + slotWidth / 2 - 5, y + 100)
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + slotWidth / 2 - 5)
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 3'])
    /** Work tab drawn on top where the dragged tab overlaps Tab 2. */
    const topTabTitle = await mainWindow.evaluate(
      ([left, top]) => document.elementFromPoint(left!, top!)!.closest('[data-testid="work-tab"]')!.textContent!.trim(),
      [slots[1]! + 10, y]
    )
    expect(topTabTitle).toBe('Tab 1')
    /** Selected hover fill and the opaque chrome surface beneath it. */
    const [selectionFill, chromeSurface] = await resolvePaletteColors(mainWindow.locator('body'), [
      '--ui-neutral-selection-surface',
      '--app-chrome-surface'
    ])
    /** Dragged pill's fill layers as [images, color]; the chrome color layer has no image. */
    const dragFill = await draggedTab.evaluate((tab) => {
      const pill = getComputedStyle(tab, '::before')
      return [pill.backgroundImage, pill.backgroundColor]
    })
    expect(dragFill).toEqual([`linear-gradient(${selectionFill}, ${selectionFill}), none`, chromeSurface])

    // Covering half of the neighbour snaps it into the dragged tab's old slot without animating.
    await mainWindow.mouse.move(x + slotWidth / 2 + 5, y + 100)
    await expect(getTabs(mainWindow)).toHaveText(['Tab 2', 'Tab 1', 'Tab 3'])
    expect(await tabStrip.evaluate((strip) => strip.getAnimations({ subtree: true }).length)).toBe(0)
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + slotWidth / 2 + 5)

    // The tab stops at either end of the strip when the pointer goes past it, and each snap saves during the drag.
    await mainWindow.mouse.move(x + slotWidth * 3, y + 100)
    await expect(getTabs(mainWindow)).toHaveText(['Tab 2', 'Tab 3', 'Tab 1'])
    await expectTabAt(mainWindow, 'Tab 1', slots[2]!)
    await expect.poll(readSavedTitles).toEqual(['Tab 2', 'Tab 3', 'Tab 1'])
    await mainWindow.mouse.move(1, y + 100)
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 3'])
    await expectTabAt(mainWindow, 'Tab 1', slots[0]!)

    // Releasing lands the tab in its slot, keeps it selected, and saves the order.
    await mainWindow.mouse.move(x + slotWidth + 10, y)
    await expect(getTabs(mainWindow)).toHaveText(['Tab 2', 'Tab 1', 'Tab 3'])
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + slotWidth + 10)
    await mainWindow.mouse.up()
    await expectTabAt(mainWindow, 'Tab 1', slots[1]!)
    await expectSelectedTab(mainWindow, 'Tab 1')
    await expect.poll(async () => {
      const { workTabs, selectedTabId } = await readTabState(electronApp)
      return { titles: workTabs.map((tab) => tab.title), selected: workTabs.find((tab) => tab.id === selectedTabId)?.title }
    }).toEqual({ titles: ['Tab 2', 'Tab 1', 'Tab 3'], selected: 'Tab 1' })

    // Pressing an unselected tab's close button and dragging away neither selects, drags, nor closes it.
    /** Close button of the unselected rightmost tab. */
    const closeBox = (await mainWindow.getByRole('button', { name: 'Close Tab 3', exact: true }).boundingBox())!
    await mainWindow.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(x + slotWidth, y)
    await mainWindow.mouse.up()
    await expect(getTabs(mainWindow)).toHaveText(['Tab 2', 'Tab 1', 'Tab 3'])
    await expectSelectedTab(mainWindow, 'Tab 1')
  })

  test('restores work tabs, their order and icons, and the selected tab after reloading', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    /** Workspace whose own saved screen the app-wide selected tab overrides. */
    const workspaceId = createDeterministicId('/ws/sample')
    const homeButton = mainWindow.getByTestId('nav-button-home')
    /** Icons inside the tab bodies, excluding each tab's close glyph. */
    const tabIcons = getTabs(mainWindow).locator('svg')
    /** Reloads the renderer and waits for the app to mount and finish startup restoration. */
    const reload = async (): Promise<void> => {
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('app-activity-bar')).toBeVisible()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
    }

    for (let index = 0; index < 3; index += 1) await mainWindow.getByTestId('new-tab-button').click()
    await getTab(mainWindow, 'Tab 2').click()
    await expect.poll(async () => {
      const { workTabs, selectedTabId } = await readTabState(electronApp)
      return { titles: workTabs.map((tab) => tab.title), selected: workTabs.find((tab) => tab.id === selectedTabId)?.title }
    }).toEqual({ titles: ['Tab 1', 'Tab 2', 'Tab 3'], selected: 'Tab 2' })
    /** Icons rendered from the persisted screens, which must survive the reload unchanged. */
    const iconClasses = (await readTabState(electronApp)).workTabs.map((tab) => WORK_TAB_ICON_CLASSES[tab.screen])
    await expect(tabIcons).toContainClass(iconClasses)

    // A selected work tab restores with its order, icons, and the Home screen.
    await reload()
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2', 'Tab 3'])
    await expect(tabIcons).toContainClass(iconClasses)
    await expectSelectedTab(mainWindow, 'Tab 2')
    await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()

    // A selected screen button restores even when the workspace's own saved screen differs.
    await testHelpers.navigateToSettingsScreen()
    await expect.poll(async () => (await readTabState(electronApp)).selectedTabId).toBe('settings')
    await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe('settings')
    /** Current workspace navigation, rewritten to Home so only the app-wide tab can restore Settings. */
    const navigation = (await readWorkspaceState(electronApp, workspaceId, 'workspace-navigation', null))!
    await seedWorkspaceState(electronApp, workspaceId, 'workspace-navigation', null, {
      ...navigation,
      selectedScreen: 'home',
      selectedScreenData: null
    })
    await reload()
    await expect(mainWindow.getByTestId('nav-button-settings')).toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
    await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
    await expectNoSelectedTab(mainWindow)

    // A selected project saves no tab, so the workspace's project screen restores with no tab selected.
    await mainWindow.getByRole('button', { name: 'Close Tab 3', exact: true }).click()
    await mainWindow.getByTestId('nav-button-project').click()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Development Tools')
    await expect.poll(async () => (await readTabState(electronApp)).selectedTabId).toBeNull()
    await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe('project')
    await reload()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Development Tools')
    await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
    await expectNoSelectedTab(mainWindow)
    await expect(getTabs(mainWindow)).toHaveText(['Tab 1', 'Tab 2'])
  })
})
