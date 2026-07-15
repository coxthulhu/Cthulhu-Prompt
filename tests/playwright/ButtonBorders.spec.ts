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
    const neutralFill = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-neutral-action-fill'
    )
    const neutralFilledHover = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-neutral-action-hover-fill'
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
    await expect(neutralIconButton).toHaveCSS('background-color', neutralFill)
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
    await expect(neutralIconTextButton).toHaveCSS('background-color', neutralFill)
    await expect(neutralIconTextButton).toHaveCSS('border-top-color', neutralHoverBorder)

    const stepperDecreaseButton = mainWindow.getByRole('button', { name: 'Decrease value' }).first()
    const stepperIncreaseButton = mainWindow.getByRole('button', { name: 'Increase value' }).first()
    await stepperDecreaseButton.hover()
    await expect(stepperDecreaseButton).toHaveCSS('background-color', neutralFill)
    await stepperIncreaseButton.hover()
    await expect(stepperIncreaseButton).toHaveCSS('background-color', neutralFill)

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

    const sidebarAddPromptButton = mainWindow.locator('[data-testid="sidebar-add-prompt-button"]')
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
    const compoundSeparator = compoundButton.locator('.cthulhuUiIconButtonWithMoreOptionsSeparator')
    await expect(compoundButton).toHaveCSS('outline-color', neutralBorder)
    await expect(compoundMainButton).toHaveAttribute('data-hover-variant', 'accent')
    await expect(compoundChevronButton).toHaveAttribute('data-hover-variant', 'neutral')
    await expect(compoundMainButton).toHaveCSS('border-top-style', 'none')
    await expect(compoundSeparator).toHaveCSS('background-color', neutralBorder)
    await expect(compoundSeparator).toHaveCSS('width', '1px')
    await compoundChevronButton.hover()
    await expect(compoundChevronButton).toHaveCSS('background-color', neutralFill)
    await expect(compoundSeparator).toHaveCSS('background-color', neutralBorder)

    await compoundChevronButton.click()
    const moreOptionsItem = mainWindow
      .locator('[data-testid="icon-button-more-options-menu"]')
      .getByRole('menuitem')
      .first()
    await moreOptionsItem.hover()
    await expect(moreOptionsItem).toHaveCSS('background-color', neutralFill)
    await mainWindow.keyboard.press('Escape')

    const simpleDropdownTrigger = mainWindow.getByRole('button', {
      name: 'Prompt actions',
      exact: true
    })
    await simpleDropdownTrigger.click()
    const simpleDropdownItem = mainWindow
      .getByRole('menu', { name: 'Prompt actions' })
      .getByRole('menuitem', { name: 'Copy prompt', exact: true })
    await simpleDropdownItem.hover()
    await expect(simpleDropdownItem).toHaveCSS('background-color', neutralFill)
    await mainWindow.keyboard.press('Escape')

    const selectorButton = mainWindow.locator('[data-testid="detailed-dropdown-trigger"]')
    await selectorButton.hover()
    await expect(selectorButton).toHaveCSS('background-color', neutralFill)
    await selectorButton.click()
    await expect(selectorButton).toHaveCSS('background-color', neutralFilledHover)
    const selectedSelectorItem = mainWindow
      .locator('[data-testid="detailed-dropdown-menu"]')
      .locator('[role="menuitem"][aria-selected="true"]')
    await selectedSelectorItem.hover()
    await expect(selectedSelectorItem).toHaveCSS('background-color', neutralFilledHover)
    await mainWindow.keyboard.press('Escape')

    const sidebarRailButton = mainWindow.getByRole('button', {
      name: 'normal neutral sidebar-rail',
      exact: true
    })
    await expect(sidebarRailButton).toHaveCSS('border-left-style', 'none')
    await expect(sidebarRailButton).toHaveCSS('border-right-style', 'none')
  })
})
