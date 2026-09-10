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

describe('Button styling', () => {
  test('matches borders to button fills while preserving structural exceptions', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories-ui' }
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
    const accentFill = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-accent-action-fill'
    )
    const accentHoverFill = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-accent-action-hover-fill'
    )
    const transparent = await resolvePaletteColor(
      mainWindow.locator('[data-testid="test-screen"]'),
      '--ui-ghost-surface'
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

    const toggleIconTextButton = mainWindow.locator(
      '[data-testid="test-screen-toggle-icon-text-button"]'
    )
    await expect(toggleIconTextButton).toHaveAttribute('aria-pressed', 'true')
    await expect(toggleIconTextButton).toHaveCSS('border-top-color', accentBorder)
    await toggleIconTextButton.hover()
    await expect(toggleIconTextButton).toHaveCSS('border-top-color', accentHoverBorder)
    await toggleIconTextButton.click()
    await mainWindow.mouse.move(0, 0)
    await expect(toggleIconTextButton).toHaveAttribute('aria-pressed', 'false')
    await expect(toggleIconTextButton).toHaveCSS('border-top-color', neutralBorder)

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

    const sidebarAddCategoryButton = mainWindow.locator(
      '[data-testid="sidebar-add-category-button"]'
    )
    await expect(sidebarAddCategoryButton).toBeEnabled()
    await sidebarAddCategoryButton.hover()
    await expect(sidebarAddCategoryButton).toHaveCSS('border-top-style', 'none')

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
    await expect(compoundSeparator).toHaveAttribute('data-orientation', 'vertical')
    await expect(compoundSeparator).toHaveCSS('border-left-color', neutralBorder)
    await expect(compoundSeparator).toHaveCSS('border-left-style', 'solid')
    await expect(compoundSeparator).toHaveCSS('width', '1px')
    await compoundChevronButton.hover()
    await expect(compoundChevronButton).toHaveCSS('background-color', neutralFill)
    await expect(compoundSeparator).toHaveCSS('border-left-color', neutralBorder)

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

    const folderSelectorTrigger = mainWindow.locator(
      '[data-testid="sidebar-prompt-folder-selector-trigger"]'
    )
    await mainWindow.mouse.move(0, 0)
    await expect(folderSelectorTrigger).toHaveCSS('background-color', transparent)
    await folderSelectorTrigger.hover()
    await expect(folderSelectorTrigger).toHaveCSS('background-color', neutralFill)
    await expect(folderSelectorTrigger).toHaveCSS('border-top-color', neutralHoverBorder)
    await folderSelectorTrigger.click()
    await expect(folderSelectorTrigger).toHaveCSS('background-color', neutralFilledHover)
    await expect(folderSelectorTrigger).toHaveCSS('border-top-color', neutralHoverBorder)

    const folderSelectorMenu = mainWindow.locator(
      '[data-testid="sidebar-prompt-folder-selector-menu"]'
    )
    const selectedFolder = folderSelectorMenu.locator('[role="menuitem"][aria-selected="true"]')
    await expect(selectedFolder).toHaveCSS('background-color', accentFill)
    await expect(selectedFolder).toHaveCSS('border-top-color', accentBorder)
    await selectedFolder.hover()
    await expect(folderSelectorTrigger).toHaveCSS('background-color', neutralFilledHover)
    await expect(folderSelectorTrigger).toHaveCSS('border-top-color', neutralHoverBorder)
    await expect(selectedFolder).toHaveCSS('background-color', accentHoverFill)
    await expect(selectedFolder).toHaveCSS('border-top-color', accentHoverBorder)

    const unselectedFolder = folderSelectorMenu
      .locator('[role="menuitem"][aria-selected="false"]')
      .first()
    await unselectedFolder.hover()
    await expect(unselectedFolder).toHaveCSS('background-color', neutralFill)
    await expect(unselectedFolder).toHaveCSS('border-top-color', neutralHoverBorder)

    const createFolderItem = folderSelectorMenu.locator(
      '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
    )
    await createFolderItem.hover()
    await expect(createFolderItem).toHaveCSS('background-color', accentHoverFill)
    await expect(createFolderItem).toHaveCSS('border-top-color', accentHoverBorder)
    await mainWindow.keyboard.press('Escape')

    const sidebarRailButton = mainWindow.getByRole('button', {
      name: 'normal neutral sidebar-rail',
      exact: true
    })
    await expect(sidebarRailButton).toHaveCSS('border-left-style', 'none')
    await expect(sidebarRailButton).toHaveCSS('border-right-style', 'none')
  })

  test('uses interactive foregrounds for ghost controls and full white for filled controls', async ({
    testSetup
  }) => {
    // The component gallery exposes shared primitives without feature-specific color overrides.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.clickNavButton('Test Screen')

    // Gallery root resolves palette tokens into the browser's computed color format.
    const gallery = mainWindow.locator('[data-testid="test-screen"]')
    // Shared text colors define the idle and interacted control hierarchy.
    const mutedText = await resolvePaletteColor(gallery, '--ui-muted-text')
    const hoverableText = await resolvePaletteColor(gallery, '--ui-hoverable-text')
    const normalText = await resolvePaletteColor(gallery, '--ui-normal-text')
    // Shared glyph colors define the idle icon hierarchy.
    const mutedIcon = await resolvePaletteColor(gallery, '--ui-muted-icon-glyph')
    const hoverableIcon = await resolvePaletteColor(gallery, '--ui-hoverable-icon-glyph')
    // Semantic foregrounds must survive hover feedback.
    const warningForeground = await resolvePaletteColor(gallery, '--ui-warning-icon-glyph')
    const successForeground = await resolvePaletteColor(gallery, '--ui-success-normal-text')

    // Outline actions brighten their text while filled actions remain full white.
    const outlineButton = mainWindow.locator('[data-testid="test-screen-outline-button"]')
    const filledButton = mainWindow.locator('[data-testid="test-screen-neutral-button"]')
    await mainWindow.mouse.move(0, 0)
    await expect(outlineButton).toHaveCSS('color', hoverableText)
    await outlineButton.hover()
    await expect(outlineButton).toHaveCSS('color', normalText)
    await expect(filledButton).toHaveCSS('color', normalText)
    await filledButton.hover()
    await expect(filledButton).toHaveCSS('color', normalText)

    // Icon-only and icon-text controls brighten both text and glyphs together.
    const iconButton = mainWindow.getByRole('button', {
      name: 'normal neutral default',
      exact: true
    })
    const iconTextButton = mainWindow.locator(
      '[data-testid="test-screen-neutral-icon-text-button"]'
    )
    await mainWindow.mouse.move(0, 0)
    await expect(iconButton).toHaveCSS('color', hoverableIcon)
    await iconButton.hover()
    await expect(iconButton).toHaveCSS('color', normalText)
    await mainWindow.mouse.move(0, 0)
    await expect(iconTextButton).toHaveCSS('color', hoverableText)
    await expect(iconTextButton.locator('svg')).toHaveCSS('color', hoverableIcon)
    await iconTextButton.hover()
    await expect(iconTextButton).toHaveCSS('color', normalText)
    await expect(iconTextButton.locator('svg')).toHaveCSS('color', normalText)

    // Activity and inline controls preserve their lower-emphasis idle tones before interaction.
    const activityButton = mainWindow.locator(
      '[data-testid="test-screen-idle-activity-button"]'
    )
    const inlineButton = mainWindow.locator('[data-testid="test-screen-muted-inline-button"]')
    await mainWindow.mouse.move(0, 0)
    await expect(activityButton).toHaveCSS('color', mutedIcon)
    await activityButton.focus()
    await mainWindow.keyboard.press('Tab')
    await mainWindow.keyboard.press('Shift+Tab')
    await expect(activityButton).toBeFocused()
    await expect(activityButton).toHaveCSS('color', normalText)
    expect(await activityButton.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
    await mainWindow.mouse.move(0, 0)
    await expect(inlineButton).toHaveCSS('color', mutedText)
    await inlineButton.hover()
    await expect(inlineButton).toHaveCSS('color', normalText)

    // Detailed selectors brighten idle content and retain full white while selected.
    const idleSelector = mainWindow.locator(
      '[data-testid="test-screen-idle-selector-button"]'
    )
    const selectedSelector = mainWindow.locator(
      '[data-testid="test-screen-selected-selector-button"]'
    )
    await mainWindow.mouse.move(0, 0)
    await expect(idleSelector).toHaveCSS('color', hoverableText)
    await expect(idleSelector.locator('.cthulhuUiSelectorButtonIconCell')).toHaveCSS(
      'color',
      hoverableIcon
    )
    await idleSelector.hover()
    await expect(idleSelector).toHaveCSS('color', normalText)
    await expect(idleSelector.locator('.cthulhuUiSelectorButtonIconCell')).toHaveCSS(
      'color',
      normalText
    )
    await expect(selectedSelector).toHaveCSS('color', normalText)
    await expect(selectedSelector.locator('.cthulhuUiSelectorButtonIconCell')).toHaveCSS(
      'color',
      normalText
    )

    // Neutral simple selectors brighten, while semantic selector text keeps its status color.
    const neutralSimpleSelector = mainWindow.locator(
      '[data-testid="test-screen-neutral-simple-selector"]'
    )
    const warningSimpleSelector = mainWindow.locator(
      '[data-testid="test-screen-warning-simple-selector"]'
    )
    const successSimpleSelector = mainWindow.locator(
      '[data-testid="test-screen-success-simple-selector"]'
    )
    await mainWindow.mouse.move(0, 0)
    await expect(neutralSimpleSelector).toHaveCSS('color', hoverableText)
    await neutralSimpleSelector.hover()
    await expect(neutralSimpleSelector).toHaveCSS('color', normalText)
    await expect(warningSimpleSelector).toHaveCSS('color', warningForeground)
    await warningSimpleSelector.hover()
    await expect(warningSimpleSelector).toHaveCSS('color', warningForeground)
    await expect(successSimpleSelector).toHaveCSS('color', successForeground)
    await successSimpleSelector.hover()
    await expect(successSimpleSelector).toHaveCSS('color', successForeground)

    // Both menu row variants follow the same idle-to-hover foreground transition.
    const simpleDropdownTrigger = mainWindow.getByRole('button', {
      name: 'Prompt actions',
      exact: true
    })
    await simpleDropdownTrigger.click()
    const simpleDropdownItem = mainWindow
      .getByRole('menu', { name: 'Prompt actions' })
      .getByRole('menuitem', { name: 'Copy prompt', exact: true })
    await expect(simpleDropdownItem).toHaveCSS('color', hoverableText)
    await expect(simpleDropdownItem.locator('svg')).toHaveCSS('color', hoverableIcon)
    await simpleDropdownItem.hover()
    await expect(simpleDropdownItem).toHaveCSS('color', normalText)
    await expect(simpleDropdownItem.locator('svg')).toHaveCSS('color', normalText)
    await mainWindow.keyboard.press('Escape')

    // Detailed menu subtitles join their title and icon at full white on hover.
    const compoundChevronButton = mainWindow
      .locator('.cthulhuUiIconButtonWithMoreOptions')
      .getByRole('button', { name: 'Copy prompt More Options', exact: true })
    await compoundChevronButton.click()
    const detailedDropdownItem = mainWindow
      .locator('[data-testid="icon-button-more-options-menu"]')
      .getByRole('menuitem')
      .first()
    await expect(detailedDropdownItem).toHaveCSS('color', hoverableText)
    await expect(detailedDropdownItem.locator('.cthulhuUiDropdownPopupMoreOptionsIcon')).toHaveCSS(
      'color',
      hoverableIcon
    )
    await detailedDropdownItem.hover()
    await expect(detailedDropdownItem).toHaveCSS('color', normalText)
    await expect(detailedDropdownItem.locator('.cthulhuUiDropdownPopupMoreOptionsIcon')).toHaveCSS(
      'color',
      normalText
    )
    await expect(
      detailedDropdownItem.locator('.cthulhuUiDropdownPopupMoreOptionsSubtitle')
    ).toHaveCSS('color', normalText)
  })
})
