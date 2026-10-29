import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { promptEditorSelector } from '../helpers/PromptCollectionSelectors'

// The dedicated suite launches Electron at fractional Windows display scaling.
const { test, describe, expect } = createPlaywrightTestSuite({
  launchOptions: {
    args: ['--force-device-scale-factor=1.25']
  }
})

describe('Separator DPI scaling', () => {
  test('renders horizontal separator borders as one device pixel', async ({
    testSetup
  }) => {
    // The empty-workspace home card exposes a normal horizontal Separator.
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    // The first card divider provides the horizontal border under test.
    const horizontalSeparator = mainWindow
      .locator('[data-testid="home-primary-card"] .cthulhuUiSeparator')
      .first()
    await expect(horizontalSeparator).toBeVisible()

    // Computed metrics confirm Chromium snapped the CSS border to one physical pixel.
    const horizontalMetrics = await horizontalSeparator.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        devicePixelRatio,
        borderTopWidth: style.borderTopWidth,
        height: bounds.height
      }
    })
    expect(horizontalMetrics.devicePixelRatio).toBe(1.25)
    expect(horizontalMetrics.borderTopWidth).toBe('0.8px')
    expect(horizontalMetrics.height).toBe(1)
    expect(parseFloat(horizontalMetrics.borderTopWidth) * horizontalMetrics.devicePixelRatio).toBe(
      1
    )
  })
})

// The existing Windows scale matrix now exercises both consumers of the shared divider style.
for (const scale of [1, 1.25, 1.5, 2, 4]) {
  // Each suite launches Chromium at the actual device scale rather than emulating CSS zoom.
  const { test, describe, expect } = createPlaywrightTestSuite({
    launchOptions: { args: [`--force-device-scale-factor=${scale}`] }
  })

  describe(`Segmented controls at ${scale * 100}% DPI`, () => {
    test('keeps only one device pixel between the hover surfaces', async ({
      testSetup
    }, testInfo) => {
      // The Empty collection provides an empty body whose title can switch Delete to Archive.
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'virtual' }
      })
      await testHelpers.clickNavButton('Test Screen')
      // The gallery retains accent coverage alongside the editor's danger and success actions.
      const splitButton = mainWindow.locator('.cthulhuUiSplitIconButton').first()
      // Shared divider replaces the split-button-specific separator class.
      const separator = splitButton.locator('.cthulhuUiSegmentedControlDivider')

      // Either half must meet the divider without inserting extra space at fractional scales.
      for (const side of ['Main', 'Chevron']) {
        await splitButton.locator(`.cthulhuUiSplitIconButton${side}`).hover()
        // The translucent accent/neutral divider must composite over the same fill as its button.
        const hoverFill = await resolvePaletteColor(splitButton,
          side === 'Main' ? '--ui-accent-action-hover-fill' : '--ui-neutral-action-fill')
        await expect(separator).toHaveCSS('background-color', hoverFill)
        // Bounds and border widths distinguish a real hairline from a wider empty separator box.
        const metrics = await separator.evaluate((element) => {
          // Divider and adjacent button rectangles reveal gaps on both sides.
          const bounds = element.getBoundingClientRect()
          // Computed border width includes Chromium's device-pixel snapping.
          const style = getComputedStyle(element)
          // Main action is immediately before the separator.
          const mainBounds = element.previousElementSibling!.getBoundingClientRect()
          // Dropdown trigger is immediately after the separator.
          const chevronBounds = element.nextElementSibling!.getBoundingClientRect()
          return {
            devicePixelRatio,
            borderWidth: parseFloat(style.borderLeftWidth),
            width: bounds.width,
            leftGap: bounds.left - mainBounds.right,
            rightGap: chevronBounds.left - bounds.right
          }
        })
        expect(metrics.devicePixelRatio).toBe(scale)
        expect(metrics.borderWidth * scale).toBeCloseTo(1, 5)
        // Layout units can round slightly; the old 1 CSS pixel box fails at fractional DPI.
        expect(metrics.width * scale).toBeCloseTo(1, 1)
        expect(Math.abs(metrics.leftGap)).toBeLessThanOrEqual(1)
        expect(Math.abs(metrics.rightGap)).toBeLessThanOrEqual(1)
        await splitButton.screenshot({
          path: testInfo.outputPath(`${side.toLowerCase()}-hover.png`),
          animations: 'disabled',
          scale: 'device'
        })
      }

      await testHelpers.navigateToPromptCollections('Empty')
      // Clear the fixture's title too: either a title or body makes Archive the default action.
      const editor = mainWindow.locator(promptEditorSelector('empty-1'))
      await editor.getByTestId('prompt-title').fill('')
      // Palette expectations remain independent of the component's computed hover styles.
      const neutralBorder = await resolvePaletteColor(editor, '--ui-neutral-normal-border')
      // Idle dividers must release the previous segment's hover fill.
      const transparent = await resolvePaletteColor(editor, '--ui-ghost-surface')
      // Explicit fixture actions verify neutral, success, and danger colors on actual editor controls.
      for (const [controlClass, actions] of [
        ['cthulhuUiSimpleSelectorButtonWithIntegratedButton', [
          ['prompt-backlog-button', '--ui-neutral-hover-border', '--ui-neutral-action-fill'],
          ['prompt-status-pill', '--ui-neutral-hover-border', '--ui-neutral-action-fill'],
          ['prompt-complete-button', '--ui-success-muted-hover-border', '--ui-success-action-hover-fill']
        ]],
        ['cthulhuUiSplitIconButton', [
          ['prompt-delete-button', '--ui-danger-muted-hover-border', '--ui-danger-action-hover-fill'],
          ['prompt-delete-more-options-button', '--ui-neutral-hover-border', '--ui-neutral-action-fill']
        ]]
      ] as const) {
        // Identify the intended action group independently of other controls using the same class.
        const control = editor.locator(`.${controlClass}`).filter({
          has: mainWindow.getByTestId(actions[0][0])
        })
        // The selector uses a wrapper around its native button; icon actions are native buttons.
        const segments = control.locator(':scope > :is(.cthulhuUiIconButton, .cthulhuUiSimpleSelectorButton)')
        // One divider must separate each pair, including both sides of the status selector.
        const dividers = control.locator('.cthulhuUiSegmentedControlDivider')
        await expect(segments).toHaveCount(actions.length)
        await expect(dividers).toHaveCount(actions.length - 1)

        // Test every segment independently with pointer and keyboard input.
        for (const [index, [testId, token, fillToken]] of actions.entries()) {
          // Native button receives input; the segment owns the visible outer border.
          const button = editor.getByTestId(testId)
          // Expected border color comes from the declared action, not a queried CSS variable.
          const hoverBorder = await resolvePaletteColor(editor, token)
          // Border and background layers together determine the visible separator color.
          const hoverFill = await resolvePaletteColor(editor, fillToken)
          // Focus must leave the previous segment before testing pointer-only feedback.
          await mainWindow.getByTestId('nav-button-home').focus()
          await button.hover()
          await expect(segments.nth(index)).toHaveCSS('border-top-color', hoverBorder)
          await expect(segments.nth(index)).toHaveCSS('border-bottom-color', hoverBorder)

          // Neighboring segments retain their own idle perimeter instead of highlighting the group.
          for (let other = 0; other < actions.length; other++) {
            if (other !== index) await expect(segments.nth(other)).toHaveCSS('border-top-color', neutralBorder)
          }

          // Dividers touching the hovered segment take its color; other dividers remain neutral.
          for (let dividerIndex = 0; dividerIndex < actions.length - 1; dividerIndex++) {
            // The separator must stay exactly one device pixel wide on either side of an action.
            const divider = dividers.nth(dividerIndex)
            await expect(divider).toHaveCSS('border-left-color',
              dividerIndex === index || dividerIndex + 1 === index ? hoverBorder : neutralBorder)
            await expect(divider).toHaveCSS('background-color',
              dividerIndex === index || dividerIndex + 1 === index ? hoverFill : transparent)
            // Measure the full space between segment surfaces, including their internal borders.
            const metrics = await divider.evaluate((element) => {
              // Divider geometry includes the snapped border and no empty content width.
              const bounds = element.getBoundingClientRect()
              // Adjacent segment geometry catches accidental double borders or margins.
              const before = element.previousElementSibling!
              // Following segment must start at the divider's right edge.
              const after = element.nextElementSibling!
              return {
                dpr: devicePixelRatio,
                width: bounds.width,
                borderWidth: parseFloat(getComputedStyle(element).borderLeftWidth),
                beforeBorder: getComputedStyle(before).borderRightWidth,
                afterBorder: getComputedStyle(after).borderLeftWidth,
                leftGap: bounds.left - before.getBoundingClientRect().right,
                rightGap: after.getBoundingClientRect().left - bounds.right,
                outerBorder: getComputedStyle(before).borderTopWidth
              }
            })
            expect(metrics.dpr).toBe(scale)
            expect(metrics.borderWidth * scale).toBeCloseTo(1, 5)
            expect(metrics.width * scale).toBeCloseTo(1, 1)
            expect(metrics.beforeBorder).toBe('0px')
            expect(metrics.afterBorder).toBe('0px')
            expect(Math.abs(metrics.leftGap)).toBeLessThanOrEqual(1)
            expect(Math.abs(metrics.rightGap)).toBeLessThanOrEqual(1)
            // Outer borders retain the original 1 CSS-pixel declaration and Chromium snapping.
            expect(parseFloat(metrics.outerBorder) * scale).toBeCloseTo(Math.floor(scale), 5)
          }
          await control.screenshot({ path: testInfo.outputPath(`${testId}-hover.png`), animations: 'disabled', scale: 'device' })

          if (testId === 'prompt-status-pill') {
            await button.click()
            await expect(mainWindow.getByTestId('prompt-status-more-options-menu')).toBeVisible()
            // Opening the status menu strengthens its fill, including beneath both shared borders.
            const openFill = await resolvePaletteColor(editor, '--ui-neutral-action-hover-fill')
            await expect(segments.nth(index)).toHaveCSS('background-color', openFill)
            // Both adjacent dividers must follow the open selector's visible border composition.
            for (const divider of await dividers.all()) {
              await expect(divider).toHaveCSS('background-color', openFill)
            }
            await mainWindow.keyboard.press('Escape')
          }

          await mainWindow.mouse.move(0, 0)
          // Establish keyboard modality outside Monaco, whose Shift+Tab handler returns to the title.
          await mainWindow.getByTestId('nav-button-home').focus()
          await mainWindow.keyboard.press('Tab')
          await button.focus()
          await expect(button).toBeFocused()
          await expect.poll(() => button.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
          await expect(segments.nth(index)).toHaveCSS('border-top-color', hoverBorder)
          await expect(segments.nth(index)).toHaveCSS('outline-style', 'solid')
          // Keyboard focus must also leave neighboring segment perimeters neutral.
          for (let other = 0; other < actions.length; other++) {
            if (other !== index) await expect(segments.nth(other)).toHaveCSS('border-top-color', neutralBorder)
          }
          // Both internal edges of a keyboard-focused selector must highlight too.
          for (let dividerIndex = 0; dividerIndex < actions.length - 1; dividerIndex++) {
            await expect(dividers.nth(dividerIndex)).toHaveCSS('border-left-color',
              dividerIndex === index || dividerIndex + 1 === index ? hoverBorder : neutralBorder)
            await expect(dividers.nth(dividerIndex)).toHaveCSS('background-color',
              dividerIndex === index || dividerIndex + 1 === index ? hoverFill : transparent)
          }
          if (testId === 'prompt-status-pill') {
            await button.press('Enter')
            await expect(mainWindow.getByTestId('prompt-status-more-options-menu')).toBeVisible()
            // Keyboard focus preserves the selector's normal focus fill even while its menu is open.
            await expect(segments.nth(index)).toHaveCSS('background-color', hoverFill)
            // Shared edges follow that focus fill rather than the stronger pointer-open fill.
            for (const divider of await dividers.all()) {
              await expect(divider).toHaveCSS('background-color', hoverFill)
            }
            await mainWindow.keyboard.press('Escape')
          }
        }
        await control.screenshot({ path: testInfo.outputPath(`${controlClass}.png`), animations: 'disabled', scale: 'device' })
      }

      await editor.getByTestId('prompt-title').fill('Archive border check')
      // Restoring content switches the same split control from danger Delete to neutral Archive.
      const archiveButton = editor.getByTestId('prompt-archive-button')
      await archiveButton.hover()
      await expect(archiveButton).toHaveCSS('border-top-color', await resolvePaletteColor(archiveButton, '--ui-neutral-hover-border'))
    })
  })
}
