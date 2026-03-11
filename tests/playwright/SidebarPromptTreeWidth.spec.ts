import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'

const { test, expect } = createPlaywrightTestSuite()

const APP_SIDEBAR_HANDLE_TEST_ID = 'app-sidebar-resize-handle'

const toSqlNullableInteger = (value: number | null): string => {
  return value === null ? 'NULL' : `${Math.round(value)}`
}

const toSqlNullableBoolean = (value: boolean | null): string => {
  if (value === null) {
    return 'NULL'
  }

  return value ? '1' : '0'
}

const runSqlQuery = async (
  electronApp: any,
  sql: string
): Promise<{ success: boolean; rows?: Array<Record<string, unknown>>; error?: string }> => {
  const requestId = createTestRequestId('sql')
  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { query, requestId } = payload
      return await new Promise<{
        success: boolean
        rows?: Array<Record<string, unknown>>
        error?: string
      }>((resolve) => {
        app.once(`test-run-sql-query-ready:${requestId}`, (nextPayload) => {
          resolve(nextPayload)
        })
        app.emit('test-run-sql-query', { requestId, sql: query })
      })
    },
    { query: sql, requestId }
  )
}

const runSqlStatement = async (electronApp: any, sql: string): Promise<void> => {
  const result = await runSqlQuery(electronApp, sql)

  if (!result.success) {
    throw new Error(result.error ?? 'SQL query failed')
  }
}

const seedUserPersistence = async (
  electronApp: any,
  data: {
    appSidebarWidthPx: number
  }
): Promise<void> => {
  await runSqlStatement(
    electronApp,
    `
    INSERT INTO app_persistence (
      id,
      last_workspace_path,
      app_sidebar_width_px
    )
    VALUES (
      1,
      NULL,
      ${Math.round(data.appSidebarWidthPx)}
    )
    ON CONFLICT(id) DO UPDATE SET
      last_workspace_path = excluded.last_workspace_path,
      app_sidebar_width_px = excluded.app_sidebar_width_px
    `
  )
}

const seedWindowPersistence = async (
  electronApp: any,
  data: {
    x: number | null
    y: number | null
    width: number | null
    height: number | null
    isMaximized: boolean | null
    isFullScreen: boolean | null
  }
): Promise<void> => {
  await runSqlStatement(
    electronApp,
    `
    UPDATE app_persistence
    SET
      window_x_px = ${toSqlNullableInteger(data.x)},
      window_y_px = ${toSqlNullableInteger(data.y)},
      window_width_px = ${toSqlNullableInteger(data.width)},
      window_height_px = ${toSqlNullableInteger(data.height)},
      window_is_maximized = ${toSqlNullableBoolean(data.isMaximized)},
      window_is_fullscreen = ${toSqlNullableBoolean(data.isFullScreen)}
    WHERE id = 1
    `
  )
}

const getSidebarWidthByHandle = async (mainWindow: any, handleTestId: string): Promise<number> => {
  const width = await mainWindow.evaluate((selector) => {
    const handle = document.querySelector<HTMLElement>(selector)
    if (!handle) return null
    const widthHost = handle.parentElement?.parentElement?.parentElement as HTMLElement | null
    if (!widthHost) return null
    return Math.round(widthHost.getBoundingClientRect().width)
  }, `[data-testid="${handleTestId}"]`)

  if (width == null) {
    throw new Error(`Failed to measure sidebar width for ${handleTestId}`)
  }

  return width
}

test.describe('Sidebar Prompt Tree Width', () => {
  test('keeps the app sidebar width stable while switching prompt folders in a small window', async ({
    electronApp,
    testSetup
  }) => {
    await seedUserPersistence(electronApp, {
      appSidebarWidthPx: 260
    })
    await seedWindowPersistence(electronApp, {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      isMaximized: false,
      isFullScreen: false
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await expect(mainWindow.locator('[data-testid="prompt-folder-prompt-dev-2"]')).toBeVisible()
    const developmentWidth = await getSidebarWidthByHandle(mainWindow, APP_SIDEBAR_HANDLE_TEST_ID)

    await testHelpers.navigateToPromptFolders('Examples')
    await expect(mainWindow.locator('[data-testid="prompt-folder-prompt-simple-1"]')).toBeVisible()
    const examplesWidth = await getSidebarWidthByHandle(mainWindow, APP_SIDEBAR_HANDLE_TEST_ID)

    expect(examplesWidth).toBe(developmentWidth)
  })
})
