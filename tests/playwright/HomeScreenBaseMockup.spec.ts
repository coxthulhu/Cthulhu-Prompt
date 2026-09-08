import type { Locator } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

const measure = async (locator: Locator) => locator.evaluate((element) => {
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  return {
    width: rect.width,
    height: rect.height,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    background: style.backgroundColor,
    borderRadius: style.borderRadius
  }
})

const expectSameVisuals = async (locator: Locator, reference: Awaited<ReturnType<typeof measure>>) => {
  const actual = await measure(locator)
  expect(Math.abs(actual.width - reference.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(actual.height - reference.height), JSON.stringify({ actual, reference })).toBeLessThanOrEqual(1)
  expect(actual.fontFamily).toBe(reference.fontFamily)
  expect(actual.fontSize).toBe(reference.fontSize)
  expect(actual.background).toBe(reference.background)
  expect(actual.borderRadius).toBe(reference.borderRadius)
}

describe('HomeScreenBase mockup', () => {
  test('matches live card, title, and dialog geometry at both Home breakpoints', async ({ electronApp, testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1700, 1100))
    const home = mainWindow.getByTestId('home-screen')
    const layout = home.getByTestId('home-layout')
    const samples = []
    for (const width of [1023, 1024]) {
      await layout.evaluate((element, size) => { element.style.width = `${size}px` }, width)
      await expect(layout).toHaveCSS('width', `${width}px`)
      await expect(home.getByTestId('home-title')).toHaveCSS('flex-direction', width === 1024 ? 'row' : 'column')
      // Let the live ResizeObserver commit its new title size before capturing the reference.
      await layout.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }))
      samples.push({
        width,
        title: await measure(home.getByTestId('home-title')),
        card: await measure(home.getByTestId('home-primary-card')),
        actions: await measure(home.getByTestId('home-workspace-actions-card')),
        row: await measure(home.locator('.cthulhuUiRow').first()),
        button: await measure(home.getByTestId('create-workspace-button'))
      })
    }
    await home.getByTestId('create-workspace-button').click()
    const dialog = mainWindow.getByRole('dialog', { name: 'Create Workspace', exact: true })
    const liveDialog = await measure(dialog)
    const liveInput = await measure(dialog.getByTestId('create-workspace-name-input'))
    const liveToggle = await measure(dialog.getByTestId('create-workspace-examples-toggle'))
    await mainWindow.keyboard.press('Escape')
    await mainWindow.getByTestId('nav-button-mockups').click()
    await mainWindow.getByTestId('mockup-tab-homescreenbase').click()
    const mockup = mainWindow.getByTestId('base-home-mockup')
    await mockup.getByTestId('close-workspace-button').click()
    for (const sample of samples) {
      await mockup.getByTestId('home-layout').evaluate((element, width) => { element.style.width = `${width}px` }, sample.width)
      await expect(mockup.getByTestId('home-title')).toHaveCSS('flex-direction', sample.width === 1024 ? 'row' : 'column')
      await expect.poll(async () => Math.abs((await measure(mockup.getByTestId('home-title'))).height - sample.title.height)).toBeLessThanOrEqual(1)
      await expectSameVisuals(mockup.getByTestId('home-title'), sample.title)
      await expectSameVisuals(mockup.getByTestId('home-primary-card'), sample.card)
      await expectSameVisuals(mockup.getByTestId('home-workspace-actions-card'), sample.actions)
      await expectSameVisuals(mockup.locator('.home-row').first(), sample.row)
      await expectSameVisuals(mockup.getByTestId('create-workspace-button'), sample.button)
    }
    await mainWindow.screenshot({ path: 'temp/home-screen-base-wide.png' })
    await mockup.getByTestId('create-workspace-button').click()
    await expectSameVisuals(dialog, liveDialog)
    await expectSameVisuals(dialog.getByTestId('create-workspace-name-input'), liveInput)
    await expectSameVisuals(dialog.getByTestId('create-workspace-examples-toggle'), liveToggle)
    await mainWindow.screenshot({ path: 'temp/home-screen-base-create.png' })
    await mainWindow.keyboard.press('Escape')
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 600))
    await mockup.getByTestId('home-layout').evaluate((element) => { element.style.width = '' })
    await mainWindow.locator('.mockups-preview').evaluate((element) => { element.scrollTop = 0 })
    await expect(mockup.getByTestId('home-title')).toHaveCSS('flex-direction', 'column')
    await expect(mockup.getByTestId('home-title')).toBeInViewport()
    const title = await mockup.getByTestId('home-title').boundingBox()
    const separator = await mockup.getByTestId('home-title-separator').boundingBox()
    expect(Math.abs(title!.width - separator!.width)).toBeLessThanOrEqual(1)
    await mainWindow.screenshot({ path: 'temp/home-screen-base-narrow.png' })
  })

  test('previews workspace and dialog states without changing the live workspace', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await testHelpers.navigateToHomeScreen()
    const livePath = await mainWindow.getByTestId('workspace-ready-path').textContent()
    await mainWindow.getByTestId('nav-button-mockups').click()
    await mainWindow.getByTestId('mockup-tab-homescreenbase').click()
    const mockup = mainWindow.getByTestId('base-home-mockup')
    const sidebar = mainWindow.getByTestId('app-sidebar')
    const sidebarText = await sidebar.textContent()
    await mockup.getByTestId('copy-workspace-path-button').click()
    await expect(mockup.getByTestId('copy-workspace-path-button')).toHaveAttribute('aria-label', 'Copied')
    await expect(mockup.getByRole('group', { name: 'Home preview controls' })).toHaveCount(0)
    await mockup.getByTestId('close-workspace-button').click()
    await expect(mockup.getByTestId('home-primary-card')).toContainText('Get Started')
    await expect(mockup.getByTestId('close-workspace-button')).toHaveCount(0)
    await mockup.getByTestId('open-workspace-button').click()
    await expect(mockup.getByTestId('workspace-ready-path')).toHaveText('C:\\')

    const dialog = mainWindow.getByRole('dialog', { name: 'Create Workspace', exact: true })
    const input = dialog.getByTestId('create-workspace-name-input')
    const submit = dialog.getByTestId('create-workspace-submit-button')
    await mockup.getByTestId('create-workspace-button').click()
    await expect(input).toHaveValue('')
    await expect(submit).toBeDisabled()
    await input.fill('Bad/Name')
    await expect(dialog.getByTestId('create-workspace-name-error')).toContainText('illegal characters')
    await expect(submit).toBeDisabled()
    await input.fill('Design Workspace')
    await dialog.getByTestId('create-workspace-path-browse-button').click()
    await expect(dialog.getByTestId('create-workspace-containing-folder-display')).toHaveText('C:\\')
    await expect(dialog.getByTestId('create-workspace-final-path-display')).toHaveText('C:\\DesignWorkspace')
    await mainWindow.mouse.click(10, 10)
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('create-workspace-examples-toggle').click()
    await submit.click()
    await expect(submit).toHaveText('Creating...')
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
    await mainWindow.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect(mockup.getByTestId('workspace-ready-path')).toHaveText('C:\\DesignWorkspace')
    await expect(mockup.locator('.workspace-stats .row-label')).toHaveText(['0', '2'])
    await expect(sidebar).toHaveText(sidebarText!)
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.getByTestId('workspace-ready-path')).toHaveText(livePath!)
  })
})
