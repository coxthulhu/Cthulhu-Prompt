import type { Locator } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

const resolvePaletteColor = async (locator: Locator, token: string): Promise<string> =>
  await locator.evaluate((element, paletteToken) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${paletteToken})`
    element.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, token)

describe('Button borders', () => {
  test('matches borders to button fills while preserving structural exceptions', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })
    await testHelpers.clickNavButton('Test Screen')

    const neutralBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-neutral-normal-border'
    )
    const neutralHoverBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-neutral-hover-border'
    )
    const accentBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-accent-muted-border'
    )
    const accentHoverBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-accent-muted-hover-border'
    )
    const successHoverBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-success-muted-hover-border'
    )
    const dangerHoverBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-danger-muted-hover-border'
    )
    const dangerBorder = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-danger-muted-border'
    )

    const neutralIconButton = mainWindow.getByRole('button', {
      name: 'normal neutral default',
      exact: true
    })
    await expect(neutralIconButton).toHaveCSS('border-top-color', neutralBorder)
    await neutralIconButton.hover()
    await expect(neutralIconButton).toHaveCSS('border-top-color', neutralHoverBorder)

    const accentIconButton = mainWindow.getByRole('button', {
      name: 'normal accent default',
      exact: true
    })
    await accentIconButton.hover()
    await expect(accentIconButton).toHaveCSS('border-top-color', accentHoverBorder)

    const successIconButton = mainWindow.getByRole('button', {
      name: 'normal success default',
      exact: true
    })
    await successIconButton.hover()
    await expect(successIconButton).toHaveCSS('border-top-color', successHoverBorder)

    const dangerIconButton = mainWindow.getByRole('button', {
      name: 'normal danger default',
      exact: true
    })
    await dangerIconButton.hover()
    await expect(dangerIconButton).toHaveCSS('border-top-color', dangerHoverBorder)

    const glyphIconButton = mainWindow.getByRole('button', {
      name: 'normal glyph default',
      exact: true
    })
    await expect(glyphIconButton).toHaveCSS('border-top-style', 'none')
    await glyphIconButton.hover()
    await expect(glyphIconButton).toHaveCSS('border-top-style', 'none')

    const neutralIconTextButton = mainWindow.locator(
      '[data-testid="test-screen-neutral-icon-text-button"]'
    )
    await expect(neutralIconTextButton).toHaveCSS('border-top-color', neutralBorder)
    await neutralIconTextButton.hover()
    await expect(neutralIconTextButton).toHaveCSS('border-top-color', neutralHoverBorder)

    const accentIconTextButton = mainWindow.locator(
      '[data-testid="test-screen-accent-icon-text-button"]'
    )
    await accentIconTextButton.hover()
    await expect(accentIconTextButton).toHaveCSS('border-top-color', accentHoverBorder)

    const accentButton = mainWindow.locator('[data-testid="test-screen-accent-button"]')
    await expect(accentButton).toHaveCSS('border-top-color', accentBorder)
    await accentButton.hover()
    await expect(accentButton).toHaveCSS('border-top-color', accentHoverBorder)

    const neutralButton = mainWindow.locator('[data-testid="test-screen-neutral-button"]')
    await expect(neutralButton).toHaveCSS('border-top-color', neutralBorder)
    await neutralButton.hover()
    await expect(neutralButton).toHaveCSS('border-top-color', neutralHoverBorder)

    const dangerButton = mainWindow.locator('[data-testid="test-screen-danger-button"]')
    await expect(dangerButton).toHaveCSS('border-top-color', dangerBorder)
    await dangerButton.hover()
    await expect(dangerButton).toHaveCSS('border-top-color', dangerHoverBorder)

    const toggleTextButton = mainWindow.locator('[data-testid="test-screen-toggle-text-button"]')
    await expect(toggleTextButton).toHaveCSS('border-top-color', accentBorder)
    await toggleTextButton.hover()
    await expect(toggleTextButton).toHaveCSS('border-top-color', accentHoverBorder)
    await toggleTextButton.click()
    await mainWindow.mouse.move(0, 0)
    await expect(toggleTextButton).toHaveCSS('border-top-color', neutralBorder)

    const disabledToggleTextButton = mainWindow.locator(
      '[data-testid="test-screen-disabled-toggle-text-button"]'
    )
    await expect(disabledToggleTextButton).toHaveCSS('border-top-color', neutralBorder)

    const promptTreeActionButton = mainWindow.locator('.sidebarPromptTreeActionButton').first()
    await promptTreeActionButton.waitFor({ state: 'attached' })
    await expect(promptTreeActionButton).toHaveCSS('border-top-style', 'none')

    const sidebarIconButtons = mainWindow.locator('.appSidebar .cthulhuUiIconButton')
    expect(await sidebarIconButtons.count()).toBeGreaterThan(0)
    expect(
      await sidebarIconButtons.evaluateAll(
        (buttons) =>
          buttons.filter((button) => getComputedStyle(button).borderTopStyle !== 'none').length
      )
    ).toBe(0)

    const sidebarAddPromptButton = mainWindow.locator(
      '[data-testid="sidebar-add-prompt-button"]'
    )
    await expect(sidebarAddPromptButton).toBeEnabled()
    await sidebarAddPromptButton.hover()
    await expect(sidebarAddPromptButton).toHaveCSS('border-top-style', 'none')

    const compoundButton = mainWindow.locator('.cthulhuUiIconButtonWithMoreOptions')
    const compoundMainButton = compoundButton.getByRole('button', {
      name: 'Copy prompt',
      exact: true
    })
    const compoundChevronButton = compoundButton.getByRole('button', {
      name: 'Copy prompt More Options',
      exact: true
    })
    await expect(compoundButton).toHaveCSS('outline-color', neutralBorder)
    await expect(compoundMainButton).toHaveCSS('border-top-style', 'none')
    await expect(compoundChevronButton).toHaveCSS('border-left-color', neutralBorder)
    await expect(compoundChevronButton).toHaveCSS('border-left-style', 'solid')
    await expect(compoundChevronButton).toHaveCSS('border-left-width', '1px')

    const sidebarRailButton = mainWindow.getByRole('button', {
      name: 'normal neutral sidebar-rail',
      exact: true
    })
    await expect(sidebarRailButton).toHaveCSS('border-left-style', 'none')
    await expect(sidebarRailButton).toHaveCSS('border-right-style', 'none')
  })
})
