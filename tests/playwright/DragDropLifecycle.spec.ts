import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('Drag-drop lifecycle', () => {
  test('does not reactivate a drop target when a dropdown unregisters after mouse-up', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.clickNavButton('Test Screen')

    const source = mainWindow.locator('[data-testid="drag-drop-regression-source"]')
    const target = mainWindow.locator('[data-testid="drag-drop-regression-target"]')
    const dropdown = mainWindow.locator('[data-testid="drag-drop-regression-dropdown"]')
    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) {
      throw new Error('Missing drag-drop regression harness geometry')
    }

    await mainWindow.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    )
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 8,
      sourceBox.y + sourceBox.height / 2 + 8,
      { steps: 4 }
    )
    await mainWindow.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 12 }
    )
    await expect(target).toHaveAttribute('data-drop-over', 'true')
    await mainWindow.mouse.up()

    await expect(dropdown).toHaveCount(0)
    await expect(target).toHaveAttribute('data-drop-over', 'false')
  })
})
