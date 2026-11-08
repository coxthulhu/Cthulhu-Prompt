import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  promptCollectionSelectorTriggerSelector,
  selectedQuickCollectionSelector
} from '../helpers/PromptCollectionSelectors'

/** Real Electron coverage for the default project's activity button and mixed-kind creation. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Project sidebar', () => {
  test('shows the default project button only while a workspace is open', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal', autoSetup: false }
    })
    /** Project activity button for the uneditable default project. */
    const projectButton = mainWindow.getByTestId('nav-button-project')
    await expect(projectButton).toHaveCount(0)
    await expect(mainWindow.getByTestId('new-project-button')).toHaveCount(0)

    await testHelpers.setupWorkspaceViaUI()
    await expect(projectButton).toHaveText('DE')
    await expect(projectButton).toHaveAttribute('title', 'Default Project')
    await expect(projectButton).toHaveAttribute('aria-label', 'Default Project')
    // Project buttons form their own top-aligned list after the screen activities, behind a separator.
    await expect(mainWindow.locator(
      '[data-testid="app-activity-bar"] > [data-testid="nav-button-test-screen"] + .cthulhuUiSeparator + [data-testid="activity-bar-project-list"] [data-testid="nav-button-project"]'
    )).toBeVisible()
    // The + button closes the project group.
    await expect(mainWindow.locator('[data-testid="activity-bar-project-list"] + [data-testid="new-project-button"]')).toHaveAttribute('title', 'New Project')

    await projectButton.click()
    await expect(mainWindow.getByTestId('app-sidebar')).toHaveAttribute('data-sidebar-mode', 'project')
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')

    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await expect(projectButton).toHaveCount(0)
    await expect(mainWindow.getByTestId('new-project-button')).toHaveCount(0)
  })

  test('creates task and template collections with the same name from both create actions', async ({ testSetup }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    await mainWindow.getByTestId('nav-button-project').click()

    // The empty project offers both kinds, and the template action opens the template dialog.
    await mainWindow.getByTestId('sidebar-prompt-collection-add-template-button').click()
    await expect(mainWindow.locator('[role="dialog"][aria-label="Create Template Collection"]')).toBeVisible()
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Shared')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Shared')
    await expect(mainWindow.locator(selectedQuickCollectionSelector).locator('svg').first()).toHaveClass(/lucide-layers/)

    // Show All lists both create actions at the bottom, task first.
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await expect(mainWindow.locator('.cthulhuUiDropdownPopupDetailedFooter [role="menuitem"]')).toHaveText([
      /Create Task Collection/,
      /Create Template Collection/
    ])
    await mainWindow.getByTestId('sidebar-prompt-collection-dropdown-add-task-item').click()
    await expect(mainWindow.locator('[role="dialog"][aria-label="Create Task Collection"]')).toBeVisible()
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Shared')
    await expect(mainWindow.getByTestId('create-prompt-collection-name-error')).toHaveCount(0)
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector).locator('svg').first()).toHaveClass(/lucide-file-text/)

    // Both kinds appear together in Show All, with the newest collection first.
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    /** All Collections rows in project order. */
    const rows = mainWindow.locator('[data-dropdown-section="all"] [role="menuitem"]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('svg.lucide-file-text')).toHaveCount(1)
    await expect(rows.nth(1).locator('svg.lucide-layers')).toHaveCount(1)
  })
})
