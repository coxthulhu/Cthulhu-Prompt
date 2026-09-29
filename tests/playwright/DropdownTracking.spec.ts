import type { Locator, Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  promptEditorSelector,
  promptFolderSelectorMenuSelector,
  promptFolderSelectorTriggerSelector,
  promptTreeCategorySelector
} from '../helpers/PromptFolderSelectors'

/** Real Electron fixtures exercise browser positioning and input dispatch. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Active sidebar virtual viewport used to check background scrolling. */
const treeSelector = '[data-testid="prompt-tree-active-virtual-window"]'

/** Reads geometry only after the actual control or popup is visible. */
const box = async (locator: Locator) => {
  await expect(locator).toBeVisible()
  return (await locator.boundingBox())!
}

/** Waits for browser input, layout, and observer delivery before checking an unchanged value. */
const settle = async (page: Page) => {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

/** Checks that an unclamped menu retains its original displacement from a moving trigger. */
const expectOffset = async (trigger: Locator, menu: Locator, offset: { x: number; y: number }) => {
  await expect.poll(async () => {
    /** Current trigger and menu bounds must move together on both axes. */
    const [triggerBox, menuBox] = await Promise.all([box(trigger), box(menu)])
    return Math.max(
      Math.abs(menuBox.x - triggerBox.x - offset.x),
      Math.abs(menuBox.y - triggerBox.y - offset.y)
    )
  }).toBeLessThanOrEqual(2)
}

describe('Dropdown tracking', () => {
  test('status menu follows layout movement and window resizing with right-aligned placement', async ({ testSetup, electronApp }) => {
    /** Virtual prompts reproduce status controls inside transformed rows. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'virtual' } })
    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))
    /** Status selector wrapper is the dropdown's actual anchor. */
    const trigger = mainWindow.locator(`${promptEditorSelector('short-1')} .cthulhuUiSimpleSelectorButton`)
    /** Portalled status menu remains open throughout all layout changes. */
    const menu = mainWindow.getByTestId('prompt-status-more-options-menu')
    // Move the control inward so neither original nor resized placement needs edge clamping.
    await trigger.evaluate((element: HTMLElement) => { element.style.translate = '-280px 0' })
    await trigger.locator('button').click({ position: { x: 10, y: 10 } })
    /** Status menus align to the live right and bottom trigger edges. */
    const expectStatusPosition = async () => {
      await expect.poll(async () => {
        /** Both bounds must retain right alignment and the four-pixel vertical gap. */
        const [triggerBox, menuBox] = await Promise.all([box(trigger), box(menu)])
        return Math.max(
          Math.abs(menuBox.x + menuBox.width - triggerBox.x - triggerBox.width),
          Math.abs(menuBox.y - triggerBox.y - triggerBox.height - 4)
        )
      }).toBeLessThanOrEqual(2)
    }
    await expectStatusPosition()
    await trigger.evaluate((element: HTMLElement) => {
      element.style.translate = '-320px 35px'
      element.style.width = '220px'
      element.style.height = '60px'
    })
    await expectStatusPosition()
    /** Change device scale while the right-aligned status menu remains open. */
    const session = await mainWindow.context().newCDPSession(mainWindow)
    /** Keep the live viewport size while changing its device-pixel ratio. */
    const viewport = await mainWindow.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }))
    try {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr + 0.5, mobile: false
      })
      await expect.poll(() => mainWindow.evaluate(() => devicePixelRatio)).toBe(viewport.dpr + 0.5)
      await expectStatusPosition()
    } finally {
      await session.send('Emulation.clearDeviceMetricsOverride')
      await session.detach()
    }
    /** Position before the native window resize proves the test induces further movement. */
    const moved = await box(trigger)
    await electronApp.evaluate(({ BrowserWindow }) => {
      /** Resizing the native window changes the prompt title-row layout. */
      const window = BrowserWindow.getAllWindows()[0]
      window.setSize(window.getBounds().width - 120, window.getBounds().height)
    })
    await expect.poll(async () => Math.abs((await box(trigger)).x - moved.x)).toBeGreaterThan(20)
    await expectStatusPosition()
  })

  test('below-trigger menu follows trigger dimensions and a live device scale change', async ({ testSetup }) => {
    /** Root selector uses below-trigger placement and trigger-dependent minimum width. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    /** Actual root selector anchor. */
    const trigger = mainWindow.locator(promptFolderSelectorTriggerSelector)
    /** Detailed menu whose width must follow the resized trigger. */
    const menu = mainWindow.locator(promptFolderSelectorMenuSelector)
    await trigger.click()
    await trigger.evaluate((element: HTMLElement) => {
      element.style.width = '380px'
      element.style.translate = '10px 20px'
    })
    /** Verifies live edge placement rather than a captured opening coordinate. */
    const expectBelow = async () => {
      await expect.poll(async () => {
        /** Both elements are measured in CSS pixels after the browser's layout pass. */
        const [triggerBox, menuBox] = await Promise.all([box(trigger), box(menu)])
        return Math.max(
          Math.abs(menuBox.x - triggerBox.x),
          Math.abs(menuBox.y - triggerBox.y - triggerBox.height - 4),
          Math.abs(menuBox.width - triggerBox.width)
        )
      }).toBeLessThanOrEqual(2)
    }
    await expectBelow()
    /** CDP changes device-pixel ratio in the running renderer without reopening the menu. */
    const session = await mainWindow.context().newCDPSession(mainWindow)
    /** Preserve viewport dimensions while changing the renderer's device scale. */
    const viewport = await mainWindow.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }))
    try {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr + 0.5, mobile: false
      })
      await expect.poll(() => mainWindow.evaluate(() => devicePixelRatio)).toBe(viewport.dpr + 0.5)
      await trigger.evaluate((element: HTMLElement) => { element.style.translate = '25px 40px' })
      await expectBelow()
    } finally {
      await session.send('Emulation.clearDeviceMetricsOverride')
      await session.detach()
    }
  })

  test('category context menu retains its cursor gap while the category row moves', async ({ testSetup }) => {
    /** Category rows open the shared dropdown through an explicit right-click. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'categories' } })
    await testHelpers.navigateToPromptFolders('Main')
    /** The entire category row owns the context-menu anchor. */
    const trigger = mainWindow.locator(promptTreeCategorySelector('Category')).locator('xpath=ancestor::div[contains(@class,"sidebarPromptTreeRow")][1]')
    /** Context menu is the sole open menu in this isolated window. */
    const menu = mainWindow.getByRole('menu')
    /** An ordinary point within the category row avoids its action buttons. */
    const before = await box(trigger)
    await mainWindow.mouse.click(before.x + 50, before.y + 12, { button: 'right' })
    /** Existing context-menu behavior adds a four-pixel horizontal cursor gap. */
    const initialMenu = await box(menu)
    expect(Math.abs(initialMenu.x - before.x - 54)).toBeLessThanOrEqual(2)
    /** Cursor offsets stay fixed when the anchor changes both width and height. */
    const offset = { x: initialMenu.x - before.x, y: initialMenu.y - before.y }
    await trigger.evaluate((element: HTMLElement) => {
      element.style.translate = '0 20px'
      element.style.width = '180px'
      element.style.height = '50px'
    })
    await expectOffset(trigger, menu, offset)
    /** Live DPR override must not convert the retained CSS-pixel cursor offset. */
    const session = await mainWindow.context().newCDPSession(mainWindow)
    /** Retain the existing viewport while changing only device scale. */
    const viewport = await mainWindow.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }))
    try {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.dpr + 0.5, mobile: false
      })
      await expect.poll(() => mainWindow.evaluate(() => devicePixelRatio)).toBe(viewport.dpr + 0.5)
      await expectOffset(trigger, menu, offset)
    } finally {
      await session.send('Emulation.clearDeviceMetricsOverride')
      await session.detach()
    }
  })

  test('menus retain edge clamping as the trigger and menu dimensions change', async ({ testSetup }) => {
    /** The real folder selector supplies a resizable below-trigger menu. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    /** Move the real trigger into an unclipped geometry fixture without replacing its handlers. */
    const trigger = mainWindow.locator(promptFolderSelectorTriggerSelector)
    await trigger.evaluate((element: HTMLElement) => {
      document.body.appendChild(element)
      element.style.cssText += ';position:fixed;left:calc(100vw - 150px);top:calc(100vh - 60px);width:120px;height:40px;'
    })
    await trigger.click()
    /** Popup layer owns the height constraint and scrollbars. */
    const layer = mainWindow.locator('.cthulhuUiDropdownPopupLayer')
    await expect.poll(async () => {
      /** Browser viewport is the clamp boundary. */
      const viewport = await mainWindow.evaluate(() => ({ width: innerWidth, height: innerHeight }))
      /** Current menu size must leave the existing right and bottom margins. */
      const menuBox = await box(layer)
      return Math.max(Math.abs(viewport.width - menuBox.x - menuBox.width - 16), Math.abs(viewport.height - menuBox.y - menuBox.height - 8))
    }).toBeLessThanOrEqual(2)
    // Content changes exercise the menu observer without a window or trigger resize event.
    await mainWindow.locator(promptFolderSelectorMenuSelector).evaluate((element: HTMLElement) => { element.style.minHeight = '400px' })
    await expect.poll(async () => {
      /** New bottom position must reflect the taller menu. */
      const menuBox = await box(layer)
      return Math.abs(await mainWindow.evaluate(() => innerHeight) - menuBox.y - menuBox.height - 8)
    }).toBeLessThanOrEqual(2)
    await trigger.evaluate((element: HTMLElement) => {
      element.style.left = '-20px'
      element.style.top = '-30px'
    })
    await expect.poll(async () => {
      /** Partially visible trigger keeps the menu open at the top-left margins. */
      const menuBox = await box(layer)
      return Math.max(Math.abs(menuBox.x - 16), Math.abs(menuBox.y - 16))
    }).toBeLessThanOrEqual(2)
    await trigger.evaluate((element: HTMLElement) => { element.style.left = '-200px' })
    await expect(layer).toHaveCount(0)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.evaluate((element: HTMLElement) => { element.style.left = '50px' })
    await settle(mainWindow)
    await expect(layer).toHaveCount(0)
  })

  test('closes when a virtual viewport fully clips the trigger and releases wheel blocking', async ({ testSetup }) => {
    /** Short prompts provide both partial and full virtual-viewport clipping. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'virtual' } })
    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))
    /** Status anchor moves with the first transformed virtual row. */
    const trigger = mainWindow.locator(`${promptEditorSelector('short-1')} .cthulhuUiSimpleSelectorButton`)
    /** Menu must close, not merely become visually hidden. */
    const menu = mainWindow.getByTestId('prompt-status-more-options-menu')
    await trigger.locator('button').click()
    /** Initial geometry locates the viewport's clipping edge. */
    const [triggerBox, hostBox] = await Promise.all([box(trigger), box(mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR))])
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, triggerBox.y - hostBox.y + triggerBox.height / 2)
    await settle(mainWindow)
    await expect(menu).toBeVisible()
    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, triggerBox.height + 10)
    await expect(menu).toHaveCount(0)
    /** Wheel scrolling must resume once the observer closes the menu. */
    const before = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
    await mainWindow.mouse.move(hostBox.x + 10, hostBox.y + hostBox.height / 2)
    await mainWindow.mouse.wheel(0, 400)
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)).toBeGreaterThan(before)
  })

  test('blocks background virtual scrolling and lets the first scrollbar press close and drag', async ({ testSetup }) => {
    /** Both virtual windows have enough content to detect unintended wheel movement. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'virtual' } })
    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))
    /** Opening the status menu should block both independent background viewports. */
    const trigger = mainWindow.locator(`${promptEditorSelector('short-1')} [data-testid="prompt-status-pill"]`)
    /** Status menu remains present during cancelled input. */
    const menu = mainWindow.getByTestId('prompt-status-more-options-menu')
    await trigger.click()
    /** Each real viewport receives a wheel event outside the popup. */
    for (const selector of [treeSelector, PROMPT_FOLDER_HOST_SELECTOR]) {
      /** Viewport geometry provides an uncovered wheel target. */
      const hostBox = await box(mainWindow.locator(selector))
      /** Stored position must remain exactly unchanged while the menu is open. */
      const before = await testHelpers.getElementScrollTop(selector)
      await mainWindow.mouse.move(hostBox.x + 4, hostBox.y + hostBox.height / 2)
      await mainWindow.mouse.wheel(0, 500)
      await settle(mainWindow)
      expect(await testHelpers.getElementScrollTop(selector)).toBe(before)
      await expect(menu).toBeVisible()
    }
    /** Real custom scrollbar must retain pointer capture from this first press. */
    const thumb = mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR).locator('..').locator('.virtual-window-scrollbar-thumb')
    await thumb.hover()
    /** Press coordinates precede the scrollbar's own movement. */
    const thumbBox = await box(thumb)
    await mainWindow.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2)
    await mainWindow.mouse.down()
    await expect(menu).toHaveCount(0)
    await expect(thumb).toHaveClass(/active/)
    await mainWindow.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2 + 40)
    await mainWindow.mouse.up()
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)).toBeGreaterThan(0)
  })

  test('allows menu scrolling while blocking native background scrolling and restores it on close', async ({ testSetup }) => {
    /** Many real root folders make the detailed selector itself scrollable. */
    const workspacePath = '/ws/dropdown-scroll'
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, Array.from({ length: 30 }, (_, index) => ({
      folderName: `Folder ${index}`, displayName: `Folder ${index}`, prompts: []
    }))))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Test Screen supplies an existing native scrolling surface, without adding a mock component. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.clickNavButton('Test Screen')
    /** Native background scroll container. */
    const background = mainWindow.getByTestId('test-screen')
    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    /** Detailed menu scrolls its item list independently of the background. */
    const items = mainWindow.getByTestId('sidebar-prompt-folder-selector-menu-items')
    await items.hover()
    await mainWindow.mouse.wheel(0, 500)
    await expect.poll(() => items.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    /** Right side of the Test Screen lies outside the folder menu. */
    const backgroundBox = await box(background)
    await mainWindow.mouse.move(backgroundBox.x + backgroundBox.width - 30, backgroundBox.y + 100)
    await mainWindow.mouse.wheel(0, 500)
    await settle(mainWindow)
    expect(await background.evaluate((element) => element.scrollTop)).toBe(0)
    // Focus through the DOM preserves the open menu while giving PageDown a native scroll target.
    await background.evaluate((element: HTMLElement) => {
      element.tabIndex = -1
      element.focus({ preventScroll: true })
    })
    await mainWindow.keyboard.press('PageDown')
    await settle(mainWindow)
    expect(await background.evaluate((element) => element.scrollTop)).toBe(0)
    expect(await background.evaluate((element) => element.dispatchEvent(new Event('touchmove', { bubbles: true, cancelable: true })))).toBe(false)
    expect(await items.evaluate((element) => element.dispatchEvent(new Event('touchmove', { bubbles: true, cancelable: true })))).toBe(true)
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toHaveCount(0)
    expect(await background.evaluate((element) => element.dispatchEvent(new Event('touchmove', { bubbles: true, cancelable: true })))).toBe(true)
    await mainWindow.keyboard.press('PageDown')
    await expect.poll(() => background.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await background.evaluate((element) => { element.scrollTop = 0 })
    await mainWindow.mouse.wheel(0, 500)
    await expect.poll(() => background.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    // Native scrollbar track presses must also dismiss the menu and scroll on the same press.
    await background.evaluate((element) => { element.scrollTop = 0 })
    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    await mainWindow.mouse.click(backgroundBox.x + backgroundBox.width - 6, backgroundBox.y + backgroundBox.height - 30)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toHaveCount(0)
    await expect.poll(() => background.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  })
})
