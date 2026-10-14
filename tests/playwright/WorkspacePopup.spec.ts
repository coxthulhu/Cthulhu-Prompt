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
    await expect(popup.getByRole('heading', { name: 'Workspace Info', exact: true })).toBeVisible()
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
    await expect(popup.getByTestId('workspace-popup-name')).toHaveText('No workspace open')
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
      await expect(popup.getByTestId('workspace-popup-name')).toHaveText(path.split('/').at(-1)!)
      await popup.getByTestId('workspace-popup-open-folder-button').click()
      await expect.poll(() => electronApp.evaluate(({ app }) => (app as any).workspacePopupOpenedPath)).toBe(path)
      await expect(popup).toBeVisible()
    }

    /** Home retains its larger summary while the popup uses App Updates typography. */
    const homeRow = mainWindow.getByTestId('home-primary-card').locator('.cthulhuUiRow')
    const workspaceName = popup.getByTestId('workspace-popup-name')
    const explorerButton = popup.getByRole('button', { name: 'Open in Explorer', exact: true })
    await expect(workspaceName).toHaveCSS('font-size', '20px')
    await expect(workspaceName).toHaveCSS('line-height', '28px')
    await expect(popup.getByTestId('workspace-popup-path')).toHaveCSS('user-select', 'text')
    await expect(explorerButton).toHaveAttribute('data-variant', 'accent')
    await expect.poll(async () => {
      /** Explorer action spans the content width beneath the location. */
      const [path, button] = await Promise.all([
        popup.getByTestId('workspace-popup-path').boundingBox(),
        explorerButton.boundingBox()
      ])
      return Math.max(Math.abs(path!.x - button!.x), Math.abs(path!.width - button!.width))
    }).toBeLessThanOrEqual(1)
    await expect(homeRow.locator('.cthulhuUiTitle')).toHaveCSS('font-size', '24px')
    await expect(homeRow.locator('.cthulhuUiIconCell svg')).toHaveCSS('width', '32px')
    await mainWindow.getByTestId('close-workspace-button').click()
    await expect(workspaceName).toHaveText('No workspace open')
    await expect(popup.getByTestId('workspace-popup-path')).toHaveCount(0)
    await expect(popup.getByTestId('workspace-popup-open-folder-button')).toBeDisabled()
  })

  // Long workspace names and paths should wrap while keeping the Explorer action visible.
  test('keeps long workspace details inside the popup after resizing the window', async ({ electronApp, testSetup }) => {
    /** Long folder name stresses the name card and location wrapping. */
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
      await expect(popup.locator('.cthulhuUiPopupSurface')).toHaveCSS('width', '360px')
      await expect(popup.getByTestId('workspace-popup-path')).toHaveAttribute('title', path)
      await expect.poll(() => popup.locator('.cthulhuUiPopupSurface').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      for (const testId of ['workspace-popup-name', 'workspace-popup-path']) {
        const detail = popup.getByTestId(testId)
        await expect(detail).toHaveCSS('overflow-wrap', 'anywhere')
        await expect.poll(() => detail.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      }
      await expect.poll(() => popup.getByTestId('workspace-popup-path').evaluate((element) => element.clientHeight)).toBeGreaterThan(20)
    }
  })
})
