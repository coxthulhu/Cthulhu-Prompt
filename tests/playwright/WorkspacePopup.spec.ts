import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'

/** Real Electron fixtures exercise the activity rail, shared popup, and Explorer IPC. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Workspace popup', () => {
  // Opening workspace details must preserve both navigation and the collapsed sidebar.
  test('opens beside the mascot with the sidebar collapsed and supports each dismissal', async ({ testSetup }) => {
    /** Selected prompt remains active while inspecting workspace details. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    await testHelpers.navigateToPromptCollections('Development')
    await mainWindow.getByTestId('prompt-tree-active-prompt-dev-1').click()
    /** Re-clicking the current activity collapses only the sidebar. */
    const activity = mainWindow.getByTestId('nav-button-prompt-task-collections')
    await activity.click()
    /** Persistent workspace trigger remains available outside the collapsed panel. */
    const button = mainWindow.getByTestId('workspace-button')
    /** Popup is queried independently because the shared surface portals to the document body. */
    const popup = mainWindow.getByTestId('workspace-popup')
    /** Hover should always choose a different mascot message. */
    const tooltip = await button.getAttribute('title')
    await button.hover()
    await expect(button).not.toHaveAttribute('title', tooltip!)
    await expect(button.locator('img')).toHaveCSS('width', '32px')
    await expect(button.locator('img')).toHaveCSS('height', '32px')
    await expect.poll(async () => {
      /** Top button and Home bounds define the intentional eight-pixel separation. */
      const [mascot, home] = await Promise.all([button.boundingBox(), mainWindow.getByTestId('nav-button-home').boundingBox()])
      return Math.abs(home!.y - mascot!.y - mascot!.height - 8)
    }).toBeLessThanOrEqual(1)

    await button.press('Enter')
    await expect(popup).toBeVisible()
    await expect(popup.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible()
    await expect(popup).toHaveAttribute('aria-modal', 'false')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.getByTestId('app-sidebar')).toBeHidden()
    await expect(activity).toHaveAttribute('aria-current', 'page')
    await expect(activity).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(async () => {
      /** Popup aligns to the mascot's top and sits ten pixels beyond the 48px rail. */
      const [mascot, surface] = await Promise.all([button.boundingBox(), popup.locator('.cthulhuUiPopupSurface').boundingBox()])
      return Math.max(Math.abs(surface!.y - mascot!.y), Math.abs(surface!.x - mascot!.x - 58))
    }).toBeLessThanOrEqual(1)
    await mainWindow.mouse.click(5, 5)
    await expect(popup).toBeVisible()
    await popup.getByRole('button', { name: 'Close workspace details' }).click()
    await expect(popup).toHaveCount(0)
    await expect(button).toBeFocused()
    await button.press('Space')
    await popup.getByRole('button', { name: 'Close workspace details' }).focus()
    await mainWindow.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    await button.click()
    await expect(popup).toHaveCount(0)
    await activity.click()
    await expect(mainWindow.getByTestId('prompt-tree-active-prompt-dev-1')).toHaveAttribute('aria-current', 'true')
    await expect(mainWindow.getByTestId('app-sidebar').locator('img')).toHaveCount(0)
  })

  // An already-open popup must follow workspace selection, replacement, and closure.
  test('matches Home through empty, selected, switched, and closed workspaces and opens Explorer', async ({ electronApp, testSetup }) => {
    /** Distinct paths expose stale details or stale Explorer targets. */
    const paths = ['/ws/popup-first', '/ws/popup-second']
    await testSetup.setupFilesystem({
      ...createWorkspaceWithCollections(paths[0], []),
      ...createWorkspaceWithCollections(paths[1], [])
    })
    /** Home stays interactive behind the nonmodal details popup. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    /** Shared popup survives workspace lifecycle changes. */
    const popup = mainWindow.getByTestId('workspace-popup')
    await mainWindow.getByTestId('workspace-button').click()
    await expect(popup.locator('.cthulhuUiTitle')).toHaveText('No workspace open')
    await expect(popup).toContainText('Open a workspace or create one to get started.')
    await expect(popup.getByTestId('workspace-popup-open-folder-button')).toBeDisabled()

    await electronApp.evaluate(({ app, shell }) => {
      // Capture the OS handoff without opening real Explorer windows for virtual fixtures.
      shell.openPath = async (path) => { (app as any).workspacePopupOpenedPath = path; return '' }
    })
    for (const path of paths) {
      await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
      await mainWindow.getByTestId('open-workspace-button').click()
      await expect(mainWindow.getByTestId('workspace-ready-path')).toHaveText(path)
      await expect(popup.getByTestId('workspace-popup-path')).toHaveText(path)
      await expect(popup.locator('.cthulhuUiTitle')).toHaveText(path.split('/').at(-1)!)
      await popup.getByTestId('workspace-popup-open-folder-button').click()
      await expect.poll(() => electronApp.evaluate(({ app }) => (app as any).workspacePopupOpenedPath)).toBe(path)
      await expect(popup).toBeVisible()
    }

    /** Home remains the reference for the shared path and foreground styling. */
    const homeRow = mainWindow.getByTestId('home-primary-card').locator('.cthulhuUiRow')
    /** Compact summary matches the popup heading's text and icon sizes. */
    const popupRow = popup.locator('.cthulhuUiRow')
    await expect(popupRow.locator('.cthulhuUiTitle')).toHaveCSS('font-size', '18px')
    await expect(popupRow.locator('.cthulhuUiTitle')).toHaveCSS('line-height', '28px')
    await expect(popupRow.locator('.cthulhuUiIconCell svg')).toHaveCSS('width', '24px')
    await expect(popupRow.locator('.cthulhuUiIconCell svg')).toHaveCSS('height', '24px')
    await expect.poll(async () => {
      /** Explorer action and summary row must share the same vertical center after compact sizing. */
      const [row, button] = await Promise.all([
        popupRow.boundingBox(),
        popup.getByTestId('workspace-popup-open-folder-button').boundingBox()
      ])
      return Math.abs(row!.y + row!.height / 2 - button!.y - button!.height / 2)
    }).toBeLessThanOrEqual(1)
    await expect(homeRow.locator('.cthulhuUiTitle')).toHaveCSS('font-size', '24px')
    await expect(homeRow.locator('.cthulhuUiIconCell svg')).toHaveCSS('width', '32px')
    for (const selector of ['.cthulhuUiTitle', '.cthulhuUiSubtitle']) {
      for (const property of selector === '.cthulhuUiTitle'
        ? ['font-weight', 'color']
        : ['font-size', 'line-height', 'font-weight', 'color']) {
        /** Home's computed style is the reference for the requested identical appearance. */
        const expectedStyle = await homeRow.locator(selector).evaluate((element, property) => getComputedStyle(element).getPropertyValue(property), property)
        await expect(popupRow.locator(selector)).toHaveCSS(property, expectedStyle)
      }
    }
    await expect(popupRow).toHaveCSS('padding', '16px')
    await mainWindow.getByTestId('close-workspace-button').click()
    await expect(popup.locator('.cthulhuUiTitle')).toHaveText('No workspace open')
    await expect(popup.getByTestId('workspace-popup-path')).toHaveCount(0)
    await expect(popup.getByTestId('workspace-popup-open-folder-button')).toBeDisabled()
  })

  // Long workspace names and paths should truncate while keeping the Explorer action visible.
  test('keeps long workspace details inside the popup after resizing the window', async ({ electronApp, testSetup }) => {
    /** Long folder name stresses both rows of the shared summary. */
    const path = `/ws/${'long-workspace-name-'.repeat(6)}`
    /** Minimal workspace provides real loaded metadata at the requested long path. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal', path } })
    await mainWindow.getByTestId('workspace-button').click()
    /** Popup surface must remain reachable at both supported test sizes. */
    const popup = mainWindow.getByTestId('workspace-popup')
    for (const width of [950, 1400]) {
      await electronApp.evaluate(({ BrowserWindow }, width) => {
        BrowserWindow.getAllWindows()[0]!.setSize(width, 600)
      }, width)
      await expect.poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getSize()[0])).toBe(width)
      await expect(popup.getByTestId('workspace-popup-open-folder-button')).toBeInViewport()
      await expect(popup.getByTestId('workspace-popup-path')).toHaveAttribute('title', path)
      await expect.poll(() => popup.locator('.cthulhuUiPopupSurface').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      await expect(popup.locator('.cthulhuUiTitle')).toHaveCSS('text-overflow', 'ellipsis')
      await expect(popup.getByTestId('workspace-popup-path')).toHaveCSS('text-overflow', 'ellipsis')
    }
  })
})
