import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, getMonacoEditorText, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const promptTitleSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} ${PROMPT_TITLE_SELECTOR}`
const dividerAddSelector = (promptId: string) =>
  `[data-testid="prompt-divider-add-after-${promptId}"]`
const moveUpSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-move-up"]`
const moveDownSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-move-down"]`

const getPromptEditorIds = async (page: any): Promise<string[]> => {
  return await page.evaluate((selector: string) => {
    return Array.from(document.querySelectorAll(selector))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .filter((testId) => testId.startsWith('prompt-editor-'))
      .map((testId) => testId.replace('prompt-editor-', ''))
  }, PROMPT_EDITOR_PREFIX_SELECTOR)
}

const waitForPromptCount = async (page: any, count: number) => {
  await expect
    .poll(async () => (await getPromptEditorIds(page)).length, { timeout: 5000 })
    .toBe(count)
}

const clickAddAfter = async (page: any, promptId: string) => {
  const button = page.locator(dividerAddSelector(promptId))
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeEnabled()
  await button.click()
}

const clickMoveUp = async (page: any, promptId: string) => {
  const button = page.locator(moveUpSelector(promptId))
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeEnabled()
  await button.click()
}

const clickMoveDown = async (page: any, promptId: string) => {
  const button = page.locator(moveDownSelector(promptId))
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeEnabled()
  await button.click()
}

const setPromptTitle = async (page: any, promptId: string, title: string) => {
  const input = page.locator(promptTitleSelector(promptId))
  await input.waitFor({ state: 'visible' })
  await input.fill(title)
}

const replacePromptText = async (page: any, promptId: string, text: string) => {
  const editorSelector = promptEditorSelector(promptId)
  await focusMonacoEditor(page, editorSelector)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text, { delay: 20 })
  await expect.poll(async () => getMonacoEditorText(page, editorSelector)).toContain(text)
}

const expectPromptContent = async (
  page: any,
  promptId: string,
  expected: { title: string; text: string }
) => {
  const editorSelector = promptEditorSelector(promptId)
  await waitForMonacoEditor(page, editorSelector)
  await expect(page.locator(promptTitleSelector(promptId))).toHaveValue(expected.title)
  const text = await getMonacoEditorText(page, editorSelector)
  expect(text).toContain(expected.text)
}

describe('Prompt folder prompt management', () => {
  test('reorders prompts with move buttons', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, 'dev-2')
    await waitForPromptCount(mainWindow, 3)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const newPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))!
    expect(newPromptId).toBeTruthy()

    // Step 1-2: move the second prompt to the top.
    await clickMoveUp(mainWindow, 'dev-2')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['dev-2', 'dev-1', newPromptId])

    // Step 3-4: move the current second prompt to the third slot.
    await clickMoveDown(mainWindow, 'dev-1')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['dev-2', newPromptId, 'dev-1'])

    // Step 5-6: try moving the first prompt up (it should stay put).
    await clickMoveUp(mainWindow, 'dev-2')
    await expect
      .poll(async () => await getPromptEditorIds(mainWindow), { timeout: 5000 })
      .toEqual(['dev-2', newPromptId, 'dev-1'])
  })

  test('preserves prompt order after navigating away', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    // Step 1: add after first prompt, edit it.
    let expectedCount = 2
    const addPromptAfter = async (promptId: string) => {
      await clickAddAfter(mainWindow, promptId)
      expectedCount += 1
      await waitForPromptCount(mainWindow, expectedCount)
    }

    await addPromptAfter('dev-1')
    const orderAfterFirstAdd = await getPromptEditorIds(mainWindow)
    const firstNewPromptId = orderAfterFirstAdd.find(
      (id) => id !== 'dev-1' && id !== 'dev-2'
    )
    expect(firstNewPromptId).toBeTruthy()

    const firstPromptContent = { title: 'Inserted A', text: 'Inserted A text' }
    await setPromptTitle(mainWindow, firstNewPromptId!, firstPromptContent.title)
    await replacePromptText(mainWindow, firstNewPromptId!, firstPromptContent.text)
    await mainWindow.waitForTimeout(2500)

    // Steps 2-3: navigate away and back, confirm location + content.
    await testHelpers.navigateToHomeScreen()
    await mainWindow.waitForTimeout(500)
    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    const orderAfterReturn = await getPromptEditorIds(mainWindow)
    expect(orderAfterReturn).toEqual(['dev-1', firstNewPromptId, 'dev-2'])
    await expectPromptContent(mainWindow, firstNewPromptId!, firstPromptContent)

    // Step 4: add three after the third prompt, then two between the first/second new prompts.
    await addPromptAfter('dev-2')
    await addPromptAfter('dev-2')
    await addPromptAfter('dev-2')

    const orderAfterThreeAdds = await getPromptEditorIds(mainWindow)
    const baseIds = new Set(['dev-1', 'dev-2', firstNewPromptId])
    const threeNewIds = orderAfterThreeAdds.filter((id) => !baseIds.has(id))
    expect(threeNewIds).toHaveLength(3)

    const firstOfThreeId = threeNewIds[0]
    await addPromptAfter(firstOfThreeId)
    await addPromptAfter(firstOfThreeId)

    const orderAfterFiveAdds = await getPromptEditorIds(mainWindow)
    const fiveNewIds = orderAfterFiveAdds.filter((id) => !baseIds.has(id))
    expect(fiveNewIds).toHaveLength(5)

    // Step 5: label each new prompt by its on-page order.
    const expectedById = new Map<string, { title: string; text: string }>()
    for (let i = 0; i < fiveNewIds.length; i += 1) {
      const promptId = fiveNewIds[i]
      const title = `Order ${i + 1}`
      const text = `Order text ${i + 1}`
      expectedById.set(promptId, { title, text })
      await setPromptTitle(mainWindow, promptId, title)
      await replacePromptText(mainWindow, promptId, text)
    }
    await mainWindow.waitForTimeout(2500)

    // Step 6: navigate away and back, verify order + contents.
    await testHelpers.navigateToHomeScreen()
    await mainWindow.waitForTimeout(500)
    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    const orderAfterFinalReturn = await getPromptEditorIds(mainWindow)
    const finalOrder = orderAfterFinalReturn.filter((id) => fiveNewIds.includes(id))
    expect(finalOrder).toEqual(fiveNewIds)

    for (const promptId of fiveNewIds) {
      await expectPromptContent(mainWindow, promptId, expectedById.get(promptId)!)
    }
  })

  test('deletes prompts and keeps deletion after navigation', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-1'))
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    // Create an empty prompt, then delete it without the confirmation dialog.
    const initialIds = await getPromptEditorIds(mainWindow)
    await clickAddAfter(mainWindow, 'dev-1')
    await waitForPromptCount(mainWindow, 3)

    const idsAfterAdd = await getPromptEditorIds(mainWindow)
    const emptyPromptId = idsAfterAdd.find((id) => !initialIds.includes(id))
    expect(emptyPromptId).toBeTruthy()

    const emptyDeleteButton = mainWindow.locator(
      `${promptEditorSelector(emptyPromptId!)} button:has-text("Delete")`
    )
    await emptyDeleteButton.scrollIntoViewIfNeeded()
    await emptyDeleteButton.click()
    await expect(mainWindow.locator('text=Delete Prompt')).toHaveCount(0)
    await expect(mainWindow.locator(promptEditorSelector(emptyPromptId!))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 2)

    // Delete a populated prompt and confirm the dialog flow.
    const deleteButton = mainWindow.locator(
      `${promptEditorSelector('dev-1')} button:has-text("Delete")`
    )
    await deleteButton.scrollIntoViewIfNeeded()
    await deleteButton.click()

    const dialog = mainWindow.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('text=Delete Prompt')).toBeVisible()

    await dialog.locator('button:has-text("Delete")').click()
    await expect(mainWindow.locator(promptEditorSelector('dev-1'))).toHaveCount(0)
    await waitForPromptCount(mainWindow, 1)

    // Navigate away and back to ensure deletions persist.
    await testHelpers.navigateToHomeScreen()
    await mainWindow.waitForTimeout(500)
    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('dev-2'))

    const idsAfterReturn = await getPromptEditorIds(mainWindow)
    expect(idsAfterReturn).toEqual(['dev-2'])
  })
})
