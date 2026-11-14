import type { Page } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { getWorkspaceInfoPath, setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { resolvePaletteColors } from '../helpers/PaletteHelpers'
import {
  readWorkspaceState,
  readWorkspaceUiState,
  seedUserPersistence,
  seedWorkspaceState
} from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Persisted tab state read directly from this machine's application record. */
type PersistedTabState = {
  workTabs: Array<{ id: string; title: string; screen: string }>
  selectedTabId: string | null
}

/** Reads the saved work tabs and selected tab without production reconstruction code. */
const readTabState = async (electronApp: ElectronApplication): Promise<PersistedTabState> => {
  /** Whole machine record, which also holds unrelated preferences. */
  const { workTabs, selectedTabId } = (await readWorkspaceState<PersistedTabState>(electronApp, null, 'application-machine', null))!
  return { workTabs, selectedTabId }
}

/** Work tab body buttons in display order. */
const getTabs = (mainWindow: Page) => mainWindow.getByTestId('work-tab').getByRole('tab')

/** Work tab wrapper carrying a test label; every new tab is titled "New Tab", so tests label tabs to tell them apart. */
const getLabeledTab = (mainWindow: Page, label: string) =>
  mainWindow.locator(`[data-testid="work-tab"][data-test-label="${label}"]`)

/** Body button of the work tab with the given test label. */
const getTab = (mainWindow: Page, label: string) => getLabeledTab(mainWindow, label).getByRole('tab')

/** Close button of the work tab with the given test label. */
const getCloseButton = (mainWindow: Page, label: string) => getLabeledTab(mainWindow, label).getByTestId('work-tab-close')

/** Adds one New Tab per label and labels each; keyed rendering keeps a label on its tab through reorders and closes. */
const addTabs = async (mainWindow: Page, labels: string[]): Promise<void> => {
  for (const label of labels) {
    /** Tab count before this addition, which is the appended tab's index. */
    const count = await mainWindow.getByTestId('work-tab').count()
    await mainWindow.getByTestId('new-tab-button').click()
    await mainWindow.getByTestId('work-tab').nth(count).evaluate((tab, value) => {
      tab.dataset.testLabel = value
    }, label)
  }
}

/** Asserts the labeled work tabs are shown in the given order. */
const expectTabLabels = async (mainWindow: Page, labels: string[]): Promise<void> => {
  await expect.poll(() => mainWindow.getByTestId('work-tab').evaluateAll(
    (tabs) => tabs.map((tab) => (tab as HTMLElement).dataset.testLabel)
  )).toEqual(labels)
}

/** Asserts exactly the work tab with the given test label is selected. */
const expectSelectedTab = async (mainWindow: Page, label: string): Promise<void> => {
  await expect(getTab(mainWindow, label)).toHaveAttribute('aria-selected', 'true')
  await expect(mainWindow.getByTestId('work-tab').getByRole('tab', { selected: true })).toHaveCount(1)
}

/** Asserts no work tab is selected. */
const expectNoSelectedTab = async (mainWindow: Page): Promise<void> => {
  await expect(mainWindow.getByTestId('work-tab').getByRole('tab', { selected: true })).toHaveCount(0)
}

/** Asserts a work tab, including any drag offset, stays in the title bar row with its left edge within 1px of the expected position. */
const expectTabAt = async (mainWindow: Page, label: string, left: number): Promise<void> => {
  await expect.poll(async () => {
    const box = (await getTab(mainWindow, label).boundingBox())!
    return Math.max(Math.abs(box.x - left), Math.abs(box.y))
  }, { message: `${label} position` }).toBeLessThanOrEqual(1)
}

/** Simulates Windows launching a second instance for a double-clicked workspace file. */
const openWorkspaceFile = async (electronApp: ElectronApplication, workspaceInfoPath: string): Promise<void> => {
  await electronApp.evaluate(({ app }, path) => {
    app.emit('second-instance', {}, ['cthulhuprompt.exe', path], 'C:\\')
  }, workspaceInfoPath)
}

describe('Work Tabs', () => {
  test('fills the title bar around the screen and tab pills with click targets without moving the pills', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
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
      const separator = document.querySelector('.titlebar__separator')!.getBoundingClientRect()
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
        if (index > 0) rows.push([`screen ${index} pill gap`, pill.left - screenPills[index - 1]!.right, 4])
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

    // Each button group is one no-drag rectangle, so Electron's per-rectangle rounding at fractional display scales
    // leaves no draggable seams between its buttons.
    for (const group of [
      mainWindow.getByRole('navigation', { name: 'Screens' }),
      mainWindow.locator('.titlebar__tab-row'),
      mainWindow.locator('.titlebar__controls')
    ]) {
      await expect(group).toHaveCSS('-webkit-app-region', 'no-drag')
    }
  })

  test('adds New Tabs that show the New Tab screen, selects them, and closes them', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    /** Title bar Home button, selected only while no work tab is selected. */
    const homeButton = mainWindow.getByTestId('nav-button-home')

    // A fresh install starts with no tabs and Home selected.
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(homeButton).toHaveAttribute('aria-current', 'page')

    // New tabs append, select themselves, and show the New Tab screen under the New Tab title and icon.
    await addTabs(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3'])
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3'])
    await expect(getTabs(mainWindow)).toHaveText(['New Tab', 'New Tab', 'New Tab'])
    await expect(getTabs(mainWindow).locator('svg')).toContainClass(Array(3).fill('lucide-layout-grid'))
    await expectSelectedTab(mainWindow, 'Tab 3')
    await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()

    // Screen buttons and work tabs share one selection.
    await testHelpers.navigateToSettingsScreen()
    await expect(mainWindow.getByTestId('settings-screen')).toBeVisible()
    await expectNoSelectedTab(mainWindow)
    await getTab(mainWindow, 'Tab 1').click()
    await expectSelectedTab(mainWindow, 'Tab 1')
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await homeButton.click()
    await expect(homeButton).toHaveAttribute('aria-current', 'page')
    await expectNoSelectedTab(mainWindow)

    // New tabs keep appending past six, the former limit.
    await addTabs(mainWindow, ['Tab 4', 'Tab 5', 'Tab 6', 'Tab 7'])
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6', 'Tab 7'])
    await expectSelectedTab(mainWindow, 'Tab 7')
    await getCloseButton(mainWindow, 'Tab 7').click()
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6'])
    await expectSelectedTab(mainWindow, 'Tab 6')

    // Closing the selected tab selects its right neighbour.
    await getTab(mainWindow, 'Tab 3').click()
    await getCloseButton(mainWindow, 'Tab 3').click()
    await expectSelectedTab(mainWindow, 'Tab 4')

    // Middle-clicking an unselected tab closes it without changing the selection.
    await getTab(mainWindow, 'Tab 6').click({ button: 'middle' })
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 4', 'Tab 5'])
    await expectSelectedTab(mainWindow, 'Tab 4')

    // Closing the selected rightmost tab selects its left neighbour.
    await getTab(mainWindow, 'Tab 5').click()
    await getTab(mainWindow, 'Tab 5').click({ button: 'middle' })
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 4'])
    await expectSelectedTab(mainWindow, 'Tab 4')

    // Middle-clicking an unselected tab's close button closes it without changing the selection.
    await getCloseButton(mainWindow, 'Tab 2').click({ button: 'middle' })
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 4'])
    await expectSelectedTab(mainWindow, 'Tab 4')

    // Closing the last remaining tab returns the selection to Home.
    await getCloseButton(mainWindow, 'Tab 4').click()
    await expectSelectedTab(mainWindow, 'Tab 1')
    await getCloseButton(mainWindow, 'Tab 1').click()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(homeButton).toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
  })

  test('shrinks tabs to their minimum width, then scrolls them with the wheel and a hover-only scrollbar', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    const newTabButton = mainWindow.getByTestId('new-tab-button')
    /** Strip that scrolls once its tabs reach their minimum width. */
    const tabStrip = mainWindow.getByRole('tablist', { name: 'Open tabs' })
    /** Horizontal overlay scrollbar along the bottom of the tabs. */
    const scrollbar = mainWindow.locator('.titlebar .app-scrollbar')
    /** Draggable thumb inside the tab strip's scrollbar. */
    const thumb = scrollbar.locator('.app-scrollbar-thumb')
    /** Strip's scroll position, its largest possible scroll position, and its visible and content widths. */
    const readStripScroll = () =>
      tabStrip.evaluate((strip) => ({
        left: strip.scrollLeft,
        max: strip.scrollWidth - strip.clientWidth,
        clientWidth: strip.clientWidth,
        scrollWidth: strip.scrollWidth
      }))
    /** Asserts the strip's scroll position is within 1px of the expected position. */
    const expectStripScrollAt = async (left: number): Promise<void> => {
      await expect.poll(async () => Math.abs((await readStripScroll()).left - left), { message: 'strip scroll' })
        .toBeLessThanOrEqual(1)
    }
    /** Test labels of the ten tabs in creation order. */
    const labels = Array.from({ length: 10 }, (_, index) => `Tab ${index + 1}`)

    // Ten tabs stop shrinking at 120px and overflow the strip, which scrolls the new, selected tab fully into view
    // beside the New Tab button. The New Tab button keeps its 40px drag gap before the window controls, and the
    // scrollbar's brief reveal from that scroll fades while the pointer is off the tabs.
    await addTabs(mainWindow, labels)
    await expectSelectedTab(mainWindow, 'Tab 10')
    /** Rendered tab widths in display order. */
    const tabWidths = await getTabs(mainWindow).evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().width))
    expect(tabWidths).toHaveLength(10)
    for (const width of tabWidths) expect(Math.abs(width - 120)).toBeLessThanOrEqual(1)
    const { max, clientWidth, scrollWidth } = await readStripScroll()
    expect(max).toBeGreaterThan(0)
    await expectStripScrollAt(max)
    /** Visible strip bounds, which the New Tab button overlaps by 1px. */
    const stripBox = (await tabStrip.boundingBox())!
    /** New Tab button bounds beside the strip. */
    const newTabBox = (await newTabButton.boundingBox())!
    /** Window controls group after the drag gap. */
    const controlsBox = (await mainWindow.locator('.titlebar__controls').boundingBox())!
    expect(Math.abs(newTabBox.x - (stripBox.x + stripBox.width - 1))).toBeLessThanOrEqual(1)
    expect(Math.abs(controlsBox.x - (newTabBox.x + newTabBox.width) - 40)).toBeLessThanOrEqual(1)
    await expect(scrollbar).toHaveClass(/\binvisible\b/)

    // Hovering the tabs shows a 3px scrollbar across the bottom of the strip, with a proportional thumb at the end.
    await getTab(mainWindow, 'Tab 10').hover()
    await expect(scrollbar).toHaveClass(/\bvisible\b/)
    const scrollbarBox = (await scrollbar.boundingBox())!
    const thumbBox = (await thumb.boundingBox())!
    /** Scrollbar and thumb geometry as [label, actual, expected] rows, in pixels. */
    const rows: Array<[string, number, number]> = [
      ['scrollbar height', scrollbarBox.height, 3],
      ['scrollbar bottom', scrollbarBox.y + scrollbarBox.height, stripBox.y + stripBox.height],
      ['scrollbar left', scrollbarBox.x, stripBox.x],
      ['scrollbar width', scrollbarBox.width, stripBox.width],
      ['thumb height', thumbBox.height, 3],
      ['thumb width', thumbBox.width, (clientWidth / scrollWidth) * clientWidth],
      ['thumb right', thumbBox.x + thumbBox.width, stripBox.x + stripBox.width]
    ]
    for (const [label, actual, expected] of rows) {
      expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1)
    }

    // Wheel up scrolls left and wheel down scrolls right, at the screens' rate of 0.4px per wheel delta unit.
    await mainWindow.mouse.wheel(0, -100)
    await expectStripScrollAt(max - 40)
    await mainWindow.mouse.wheel(0, -100)
    await expectStripScrollAt(max - 80)
    await mainWindow.mouse.wheel(0, 100)
    await expectStripScrollAt(max - 40)
    await mainWindow.mouse.wheel(0, 100)
    await expectStripScrollAt(max)

    // Dragging the thumb past the strip's left edge scrolls to the start without selecting or dragging a tab.
    await mainWindow.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(1, thumbBox.y + thumbBox.height / 2)
    await expect(thumb).toHaveClass(/\bactive\b/)
    await mainWindow.mouse.up()
    await expectStripScrollAt(0)
    await expect.poll(async () => Math.abs((await thumb.boundingBox())!.x - stripBox.x), { message: 'thumb left' })
      .toBeLessThanOrEqual(1)
    await expectSelectedTab(mainWindow, 'Tab 10')
    await expectTabLabels(mainWindow, labels)

    // Moving the pointer off the tabs hides the scrollbar.
    await newTabButton.hover()
    await expect(scrollbar).toHaveClass(/\binvisible\b/)

    // Selecting a hidden tab scrolls it just into view; dispatched clicks avoid Playwright scrolling the tab itself.
    await getTab(mainWindow, 'Tab 9').dispatchEvent('click')
    await expectSelectedTab(mainWindow, 'Tab 9')
    await expect.poll(async () => {
      const tabBox = (await getTab(mainWindow, 'Tab 9').boundingBox())!
      return Math.abs(tabBox.x + tabBox.width - (stripBox.x + stripBox.width))
    }, { message: 'Tab 9 right edge' }).toBeLessThanOrEqual(1)
    await getTab(mainWindow, 'Tab 1').dispatchEvent('click')
    await expectSelectedTab(mainWindow, 'Tab 1')
    await expectStripScrollAt(0)

    // Middle-clicking a tab still closes it while the strip overflows, instead of starting Chromium's middle-click
    // autoscroll on the scrolling strip.
    await getTab(mainWindow, 'Tab 2').click({ button: 'middle' })
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6', 'Tab 7', 'Tab 8', 'Tab 9', 'Tab 10'])
    await expectSelectedTab(mainWindow, 'Tab 1')
    await expectStripScrollAt(0)

    // Closing unselected tabs until the rest fit re-measures the strip without a resize or scroll, so the
    // hovered scrollbar hides.
    await expect(scrollbar).toHaveClass(/\bvisible\b/)
    await getCloseButton(mainWindow, 'Tab 3').click()
    await getCloseButton(mainWindow, 'Tab 4').click()
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 5', 'Tab 6', 'Tab 7', 'Tab 8', 'Tab 9', 'Tab 10'])
    await expect(scrollbar).toHaveClass(/\binvisible\b/)
    expect((await readStripScroll()).max).toBe(0)
  })

  test('drags a work tab over its neighbours within the strip and saves the new order', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await addTabs(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3'])
    await expectSelectedTab(mainWindow, 'Tab 3')
    await expect.poll(async () => (await readTabState(electronApp)).workTabs.length).toBe(3)
    /** Saved tab IDs in creation order, which tell the saved tabs apart now that every tab is titled "New Tab". */
    const createdIds = (await readTabState(electronApp)).workTabs.map((tab) => tab.id)
    /** Test label of a saved tab, from its creation position. */
    const getSavedLabel = (tabId: string | null): string => `Tab ${createdIds.indexOf(tabId!) + 1}`
    /** Strip that holds pointer capture while a tab is dragged. */
    const tabStrip = mainWindow.getByRole('tablist', { name: 'Open tabs' })
    /** Left edges of the three tab slots before any drag. */
    const slots = await getTabs(mainWindow).evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().left))
    /** Width shared by the touching tab slots. */
    const slotWidth = slots[1]! - slots[0]!
    /** Dragged tab wrapper, which carries the drag state. */
    const draggedTab = getLabeledTab(mainWindow, 'Tab 1')
    /** Press point on Tab 1's title, clear of its close button. */
    const x = slots[0]! + 40
    /** Vertical centre of the title bar. */
    const y = (await tabStrip.boundingBox())!.height / 2
    /** Saved work tab labels in display order. */
    const readSavedLabels = async (): Promise<string[]> =>
      (await readTabState(electronApp)).workTabs.map((tab) => getSavedLabel(tab.id))

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
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3'])
    /** Work tab drawn on top where the dragged tab overlaps Tab 2. */
    const topTabLabel = await mainWindow.evaluate(
      ([left, top]) => (document.elementFromPoint(left!, top!)!.closest('[data-testid="work-tab"]') as HTMLElement).dataset.testLabel,
      [slots[1]! + 10, y]
    )
    expect(topTabLabel).toBe('Tab 1')
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
    await expectTabLabels(mainWindow, ['Tab 2', 'Tab 1', 'Tab 3'])
    expect(await tabStrip.evaluate((strip) => strip.getAnimations({ subtree: true }).length)).toBe(0)
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + slotWidth / 2 + 5)

    // The tab stops at either end of the strip when the pointer goes past it, and each snap saves during the drag.
    await mainWindow.mouse.move(x + slotWidth * 3, y + 100)
    await expectTabLabels(mainWindow, ['Tab 2', 'Tab 3', 'Tab 1'])
    await expectTabAt(mainWindow, 'Tab 1', slots[2]!)
    await expect.poll(readSavedLabels).toEqual(['Tab 2', 'Tab 3', 'Tab 1'])
    await mainWindow.mouse.move(1, y + 100)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3'])
    await expectTabAt(mainWindow, 'Tab 1', slots[0]!)

    // Releasing lands the tab in its slot, keeps it selected, and saves the order.
    await mainWindow.mouse.move(x + slotWidth + 10, y)
    await expectTabLabels(mainWindow, ['Tab 2', 'Tab 1', 'Tab 3'])
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + slotWidth + 10)
    await mainWindow.mouse.up()
    await expectTabAt(mainWindow, 'Tab 1', slots[1]!)
    await expectSelectedTab(mainWindow, 'Tab 1')
    await expect.poll(async () => {
      const { workTabs, selectedTabId } = await readTabState(electronApp)
      return { labels: workTabs.map((tab) => getSavedLabel(tab.id)), selected: getSavedLabel(selectedTabId) }
    }).toEqual({ labels: ['Tab 2', 'Tab 1', 'Tab 3'], selected: 'Tab 1' })

    // Pressing an unselected tab's close button and dragging away neither selects, drags, nor closes it.
    /** Close button of the unselected rightmost tab. */
    const closeBox = (await getCloseButton(mainWindow, 'Tab 3').boundingBox())!
    await mainWindow.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(x + slotWidth, y)
    await mainWindow.mouse.up()
    await expectTabLabels(mainWindow, ['Tab 2', 'Tab 1', 'Tab 3'])
    await expectSelectedTab(mainWindow, 'Tab 1')
  })

  test('converts restored work tabs to New Tabs and restores their order and the selected tab after reloading', async ({
    electronApp,
    testSetup
  }) => {
    /** Workspace whose own saved screen the app-wide selected tab overrides. */
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    // Tabs saved before every tab showed the New Tab screen, with their old titles and screens, restore with the workspace.
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(workspacePath),
      workTabs: [
        { id: 'tab-1', title: 'Tab 1', screen: 'prompt-collection' },
        { id: 'tab-2', title: 'Tab 2', screen: 'template-collection' },
        { id: 'tab-3', title: 'Tab 3', screen: 'new-tab' }
      ],
      selectedTabId: 'tab-2'
    })
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample', autoSetup: false } })
    const homeButton = mainWindow.getByTestId('nav-button-home')
    /** Reloads the renderer and waits for the app to mount and finish startup restoration. */
    const reload = async (): Promise<void> => {
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('app-activity-bar')).toBeVisible()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
    }
    /** Asserts the three restored tabs are New Tabs with the second one selected on its New Tab screen. */
    const expectRestoredTabs = async (): Promise<void> => {
      await expect(getTabs(mainWindow)).toHaveText(['New Tab', 'New Tab', 'New Tab'])
      await expect(getTabs(mainWindow).locator('svg')).toContainClass(Array(3).fill('lucide-layout-grid'))
      await expect(getTabs(mainWindow).nth(1)).toHaveAttribute('aria-selected', 'true')
      await expect(mainWindow.getByTestId('work-tab').getByRole('tab', { selected: true })).toHaveCount(1)
      await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
      await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    }
    /** Converted tabs saved in their original order. */
    const convertedTabs = ['tab-1', 'tab-2', 'tab-3'].map((id) => ({ id, title: 'New Tab', screen: 'new-tab' }))

    // Restored tabs become New Tabs, keeping their order and selection, and are saved that way.
    await expectRestoredTabs()
    await expect.poll(() => readTabState(electronApp)).toEqual({ workTabs: convertedTabs, selectedTabId: 'tab-2' })

    // A selected work tab restores with its order and its New Tab screen.
    await reload()
    await expectRestoredTabs()
    expect(await readTabState(electronApp)).toEqual({ workTabs: convertedTabs, selectedTabId: 'tab-2' })

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
    await mainWindow.getByTestId('work-tab-close').nth(2).click()
    await mainWindow.getByTestId('nav-button-project').click()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Development Tools')
    await expect.poll(async () => (await readTabState(electronApp)).selectedTabId).toBeNull()
    await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe('project')
    await reload()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Development Tools')
    await expect(homeButton).not.toHaveAttribute('aria-current', 'page')
    await expectNoSelectedTab(mainWindow)
    await expect(getTabs(mainWindow)).toHaveText(['New Tab', 'New Tab'])
    expect((await readTabState(electronApp)).workTabs.map((tab) => tab.id)).toEqual(['tab-1', 'tab-2'])

    // Selecting a tab saves the workspace's own screen as Home, since the app-wide selected tab restores the tab.
    await getTabs(mainWindow).first().click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe('home')
  })

  test('adds tabs only while a workspace is open and closes every tab when the workspace closes or changes', async ({
    electronApp,
    testSetup
  }) => {
    /** Second workspace, opened from Home and then replaced by a double-clicked file while a New Tab is shown. */
    const otherPath = '/ws/other'
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal', autoSetup: false, additionalFilesystem: setupWorkspaceScenario(otherPath, 'minimal') }
    })
    const newTabButton = mainWindow.getByTestId('new-tab-button')
    /** Home's path of the open workspace. */
    const workspacePath = mainWindow.getByTestId('workspace-ready-path')

    // New Tab is disabled until a workspace opens.
    await expect(newTabButton).toBeDisabled()
    await testHelpers.setupWorkspaceViaUI()
    await expect(newTabButton).toBeEnabled()
    await addTabs(mainWindow, ['Tab 1', 'Tab 2'])
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2'])

    // Closing the workspace from Home closes every tab and disables New Tab again.
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(newTabButton).toBeDisabled()
    await expect.poll(async () => (await readTabState(electronApp)).workTabs).toEqual([])

    // Opening another workspace from Home closes every tab.
    await testSetup.setupFileDialog([getWorkspaceInfoPath('/ws/minimal')])
    await testHelpers.setupWorkspaceViaUI()
    await addTabs(mainWindow, ['Tab 3', 'Tab 4'])
    await testHelpers.navigateToHomeScreen()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(otherPath)])
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(workspacePath).toContainText('other')
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(newTabButton).toBeEnabled()

    // Opening a double-clicked workspace file while a New Tab is shown closes every tab and shows that workspace.
    await addTabs(mainWindow, ['Tab 5', 'Tab 6'])
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await openWorkspaceFile(electronApp, getWorkspaceInfoPath('/ws/minimal'))
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(workspacePath).toContainText('minimal')
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(newTabButton).toBeEnabled()
    await expect.poll(() => readTabState(electronApp)).toEqual({ workTabs: [], selectedTabId: 'home' })
  })

  test('closes restored work tabs when startup cannot reopen their workspace', async ({ electronApp, testSetup }) => {
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath('/ws/missing'),
      workTabs: [{ id: 'tab-1', title: 'New Tab', screen: 'new-tab' }],
      selectedTabId: 'tab-1'
    })
    const { mainWindow } = await testSetup.setupAndStart()

    // The missing workspace leaves Home selected with no tabs and New Tab disabled.
    await expect(mainWindow.getByTestId('nav-button-home')).toHaveAttribute('aria-current', 'page')
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab')).toHaveCount(0)
    await expect(mainWindow.getByTestId('new-tab-button')).toBeDisabled()
    await expect.poll(() => readTabState(electronApp)).toEqual({ workTabs: [], selectedTabId: 'home' })
    testSetup.removeRendererErrorsContaining('Failed to restore last workspace')
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    testSetup.removeRendererErrorsContaining('missing.cthulhuprompt')
  })
})
