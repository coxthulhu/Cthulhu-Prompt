import type { Page } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { moveOsCursor, type Point } from '../helpers/OsCursorHelpers'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { resolvePaletteColors } from '../helpers/PaletteHelpers'
import { runSqlQuery } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Persisted tab state read directly from this machine's application record. */
type PersistedTabState = {
  workTabs: Array<{ id: string; title: string; screen: string }>
  selectedTabId: string | null
}

/** Reads the saved work tabs and selected tab without production reconstruction code. */
const readTabState = async (electronApp: ElectronApplication): Promise<PersistedTabState> => {
  /** This suite uses empty tabs; their title and icon are fixed by the New Tab screen. */
  const result = await runSqlQuery(electronApp, "SELECT data_json FROM workspace_state WHERE state_type = 'tab-session-user'")
  const session = JSON.parse(String(result.rows![0].data_json)) as { tabs: Array<{ id: string }>; selectedTabId: string }
  return { workTabs: session.tabs.map(({ id }) => ({ id, title: 'New Tab', screen: 'new-tab' })), selectedTabId: session.selectedTabId }
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

/** Waits until the title bar reads the simulated OS cursor three more times, giving held widths the chance to release. */
const waitForCursorReads = async (electronApp: ElectronApplication): Promise<void> => {
  /** Reads how many times the main process has read the simulated cursor. */
  const readCount = () => electronApp.evaluate(() => (globalThis as { cursorReads?: number }).cursorReads ?? 0)
  /** Reads counted before waiting. */
  const start = await readCount()
  await expect.poll(readCount, { message: 'cursor reads' }).toBeGreaterThanOrEqual(start + 3)
}

/** Rendered work tab widths in display order. */
const readTabWidths = (mainWindow: Page): Promise<number[]> =>
  mainWindow.getByTestId('work-tab').evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().width))

/** Asserts every work tab's width is within 1px of the expected width. */
const expectTabWidths = async (mainWindow: Page, width: number): Promise<void> => {
  await expect.poll(async () => Math.max(...(await readTabWidths(mainWindow)).map((tabWidth) => Math.abs(tabWidth - width))), {
    message: 'tab widths'
  }).toBeLessThanOrEqual(1)
}

/** Centre of the close button of the work tab with the given test label. */
const getCloseCenter = async (mainWindow: Page, label: string): Promise<Point> => {
  /** Close button bounds. */
  const box = (await getCloseButton(mainWindow, label).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Asserts the close button of the work tab with the given test label is centred within 1px of the point. */
const expectCloseAt = async (mainWindow: Page, label: string, point: Point): Promise<void> => {
  /** Close button's current centre. */
  const center = await getCloseCenter(mainWindow, label)
  expect(Math.max(Math.abs(center.x - point.x), Math.abs(center.y - point.y)), `${label} close position`).toBeLessThanOrEqual(1)
}

/** Point on the title of the work tab with the given test label, clear of its close button. */
const getTitlePoint = async (mainWindow: Page, label: string): Promise<Point> => {
  /** Tab button bounds, which cover the whole tab. */
  const box = (await getTab(mainWindow, label).boundingBox())!
  return { x: box.x + 40, y: box.y + box.height / 2 }
}

/** Opens seven tabs labeled Tab 1 to Tab 7, which shrink to fill the title bar row, and returns the width each of a
    given number of tabs takes when they fill that row, up to their 222px maximum. */
const openSevenTabs = async (mainWindow: Page): Promise<(count: number) => number> => {
  await addTabs(mainWindow, Array.from({ length: 7 }, (_, index) => `Tab ${index + 1}`))
  await expect(getTabs(mainWindow)).toHaveCount(7)
  /** Row width the seven shrunken tabs fill. */
  const rowWidth = (await readTabWidths(mainWindow)).reduce((sum, width) => sum + width, 0)
  // Five tabs must still shrink, so held widths differ from filled widths down to four tabs.
  expect(rowWidth / 5).toBeLessThan(221)
  return (count) => Math.min(222, rowWidth / count)
}

describe('Work Tabs', () => {
  test('fills the title bar around the screen and tab pills with click targets without moving the pills', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
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

  test('adds New Tabs that show the New Tab screen, selects them, and closes them', async ({ electronApp, testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
    // Mouse closes read the OS cursor, which stays outside the window so held tab widths release at once.
    await moveOsCursor(electronApp, mainWindow, null)
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

  test('shrinks tabs to their minimum width, then scrolls them with the wheel and a hover-only scrollbar', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
    // Mouse closes read the OS cursor, which stays outside the window so held tab widths release at once.
    await moveOsCursor(electronApp, mainWindow, null)
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
    // hovered scrollbar hides. Keyboard closes hold no tab widths, which would briefly resize the strip.
    await expect(scrollbar).toHaveClass(/\bvisible\b/)
    for (const label of ['Tab 3', 'Tab 4']) {
      await getCloseButton(mainWindow, label).focus()
      await mainWindow.keyboard.press('Enter')
    }
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 5', 'Tab 6', 'Tab 7', 'Tab 8', 'Tab 9', 'Tab 10'])
    await expect(scrollbar).toHaveClass(/\binvisible\b/)
    expect((await readStripScroll()).max).toBe(0)
  })

  test('drags a work tab over its neighbours within the strip and saves the new order', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
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

    // Short of half of its neighbour, the tab slides over the unmoved neighbour on an opaque selected fill.
    await mainWindow.mouse.move(x + slotWidth / 2 - 5, y + 100)
    await expectTabAt(mainWindow, 'Tab 1', slots[0]! + slotWidth / 2 - 5)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3'])
    /** Work tab drawn on top where the dragged tab overlaps Tab 2. */
    const topTabLabel = await mainWindow.evaluate(
      ([left, top]) => (document.elementFromPoint(left!, top!)!.closest('[data-testid="work-tab"]') as HTMLElement).dataset.testLabel,
      [slots[1]! + 10, y]
    )
    expect(topTabLabel).toBe('Tab 1')
    /** Selected fill and the opaque chrome surface beneath it. */
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

  test('holds tab widths after mouse closes so repeated clicks close the following tabs until the OS cursor leaves the tabs', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
    /** Width each of a given number of tabs takes when they fill the row. */
    const fillWidth = await openSevenTabs(mainWindow)

    // Left-clicking Tab 2's close button holds the widths while the OS cursor stays over the tabs, which slides Tab 3's
    // close button under the pointer, where a middle click closes Tab 3 and keeps holding them.
    /** Pointer and OS cursor position on Tab 2's close button. */
    const point = await getCloseCenter(mainWindow, 'Tab 2')
    await moveOsCursor(electronApp, mainWindow, point)
    await mainWindow.mouse.click(point.x, point.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6', 'Tab 7'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(7))
    await expectCloseAt(mainWindow, 'Tab 3', point)
    await mainWindow.mouse.click(point.x, point.y, { button: 'middle' })
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 4', 'Tab 5', 'Tab 6', 'Tab 7'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(7))
    await expectCloseAt(mainWindow, 'Tab 4', point)

    // Leaving the window above the title bar, where the page gets no pointer events, releases the widths.
    await moveOsCursor(electronApp, mainWindow, null)
    await expectTabWidths(mainWindow, fillWidth(5))

    // Moving onto the New Tab button releases widths held by another close.
    /** Pointer and OS cursor position on Tab 4's close button. */
    const nextPoint = await getCloseCenter(mainWindow, 'Tab 4')
    await moveOsCursor(electronApp, mainWindow, nextPoint)
    await mainWindow.mouse.click(nextPoint.x, nextPoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 5', 'Tab 6', 'Tab 7'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(5))
    /** New Tab button bounds beside the held strip. */
    const newTabBox = (await mainWindow.getByTestId('new-tab-button').boundingBox())!
    await moveOsCursor(electronApp, mainWindow, { x: newTabBox.x + newTabBox.width / 2, y: newTabBox.y + newTabBox.height / 2 })
    await expectTabWidths(mainWindow, fillWidth(4))
  })

  test('widens the remaining tabs under the pointer when mouse closes go right to left', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
    /** Width each of a given number of tabs takes when they fill the row. */
    const fillWidth = await openSevenTabs(mainWindow)
    /** Strip whose held width the tabs fill. */
    const tabStrip = mainWindow.getByRole('tablist', { name: 'Open tabs' })

    // Closing the rightmost tab widens the rest to fill the row, which lands Tab 6's close button under the pointer.
    /** Pointer and OS cursor position on the rightmost tab's close button in the full row. */
    const rightPoint = await getCloseCenter(mainWindow, 'Tab 7')
    await moveOsCursor(electronApp, mainWindow, rightPoint)
    await mainWindow.mouse.click(rightPoint.x, rightPoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(6))
    await expectCloseAt(mainWindow, 'Tab 6', rightPoint)
    await expect(tabStrip).not.toHaveCSS('max-width', 'none')

    // Closing Tab 2 holds the five remaining tabs' widths, leaving the held strip short of the row.
    /** Pointer and OS cursor position on Tab 2's close button. */
    const middlePoint = await getCloseCenter(mainWindow, 'Tab 2')
    await moveOsCursor(electronApp, mainWindow, middlePoint)
    await mainWindow.mouse.click(middlePoint.x, middlePoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(6))

    // Closing the rightmost tab keeps the held strip's right edge, so the tabs widen only within it and Tab 5's close
    // button lands under the pointer.
    /** Held strip width from Tab 2's close. */
    const heldWidth = fillWidth(6) * 5
    /** Pointer and OS cursor position on the rightmost tab's close button in the held strip. */
    const heldRightPoint = await getCloseCenter(mainWindow, 'Tab 6')
    await moveOsCursor(electronApp, mainWindow, heldRightPoint)
    await mainWindow.mouse.click(heldRightPoint.x, heldRightPoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 4', 'Tab 5'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, heldWidth / 4)
    await expectCloseAt(mainWindow, 'Tab 5', heldRightPoint)

    // Closing Tab 5 widens the last three tabs only to their 222px maximum, which leaves the pointer over the drag
    // region past the New Tab button, so the widths release.
    await mainWindow.mouse.click(heldRightPoint.x, heldRightPoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 4'])
    await expectTabWidths(mainWindow, 222)
    /** New Tab button bounds after the last three tabs. */
    const newTabBox = (await mainWindow.getByTestId('new-tab-button').boundingBox())!
    expect(heldRightPoint.x).toBeGreaterThan(newTabBox.x + newTabBox.width)
    await expect(tabStrip).toHaveCSS('max-width', 'none')
  })

  test('keeps held tab widths while a tab is pressed or dragged, and holds none for keyboard closes or after New Tab', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('work-tab-close').first().press('Enter')
    /** Width each of a given number of tabs takes when they fill the row. */
    const fillWidth = await openSevenTabs(mainWindow)
    /** Wrapper of the pressed tab, which carries the drag state. */
    const pressedTab = getLabeledTab(mainWindow, 'Tab 3')

    // After closing Tab 2, pressing Tab 3 keeps the held widths while the OS cursor leaves the window, before and after
    // the drag threshold, and releases them once the drag ends.
    /** Pointer and OS cursor position on Tab 2's close button. */
    const closePoint = await getCloseCenter(mainWindow, 'Tab 2')
    await moveOsCursor(electronApp, mainWindow, closePoint)
    await mainWindow.mouse.click(closePoint.x, closePoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6', 'Tab 7'])
    /** Press point on Tab 3's title after it slid into Tab 2's slot. */
    const pressPoint = await getTitlePoint(mainWindow, 'Tab 3')
    await moveOsCursor(electronApp, mainWindow, pressPoint)
    await mainWindow.mouse.down()
    await moveOsCursor(electronApp, mainWindow, null)
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(7))
    await mainWindow.mouse.move(pressPoint.x + 20, pressPoint.y + 100)
    await expect(pressedTab).toHaveAttribute('data-dragging', 'true')
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(7))
    await mainWindow.mouse.up()
    await expect(pressedTab).toHaveAttribute('data-dragging', 'false')
    await expectTabWidths(mainWindow, fillWidth(6))

    // Closing a tab from the keyboard holds no widths, even while the OS cursor is over the tabs.
    await moveOsCursor(electronApp, mainWindow, await getTitlePoint(mainWindow, 'Tab 1'))
    await getCloseButton(mainWindow, 'Tab 4').focus()
    await mainWindow.keyboard.press('Enter')
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 3', 'Tab 5', 'Tab 6', 'Tab 7'])
    await expectTabWidths(mainWindow, fillWidth(5))

    // Clicking New Tab releases held widths even though the OS cursor still reads over the tabs.
    /** Pointer and OS cursor position on Tab 3's close button. */
    const nextPoint = await getCloseCenter(mainWindow, 'Tab 3')
    await moveOsCursor(electronApp, mainWindow, nextPoint)
    await mainWindow.mouse.click(nextPoint.x, nextPoint.y)
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 5', 'Tab 6', 'Tab 7'])
    await waitForCursorReads(electronApp)
    await expectTabWidths(mainWindow, fillWidth(5))
    await addTabs(mainWindow, ['Tab 8'])
    await expectTabLabels(mainWindow, ['Tab 1', 'Tab 5', 'Tab 6', 'Tab 7', 'Tab 8'])
    await expectTabWidths(mainWindow, fillWidth(5))
  })

})
