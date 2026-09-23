import { expect as baseExpect, type Page } from '@playwright/test'
import * as screenHelpers from './ScreenHelpers'
import * as buttonHelpers from './ButtonHelpers'
import * as workspaceHelpers from './WorkspaceHelpers'
import * as virtualWindowHelpers from './VirtualWindowHelpers'
import * as promptFolderHelpers from './PromptFolderHelpers'
import * as uiValidationHelpers from './UiValidationHelpers'

/** IPC gates exposed through both setup and page-bound helpers. */
export interface IpcControls {
  pauseIpcChannel: (channel: string) => Promise<void>
  resumeIpcChannel: (channel: string) => Promise<void>
}

/** Binds the shared UI operations to the test's main window. */
export function createPageHelpers(mainWindow: Page, ipcControls: IpcControls) {
  return {
    /** Get active screen using this test’s main window. */
    getActiveScreen: () => screenHelpers.getActiveScreen(mainWindow),
    /** Is button visible using this test’s main window. */
    isButtonVisible: (buttonText: string) =>
      buttonHelpers.isButtonVisible(mainWindow, buttonText),
    /** Is nav button active using this test’s main window. */
    isNavButtonActive: (buttonText: string) =>
      buttonHelpers.isNavButtonActive(mainWindow, buttonText),
    /** Assert home active using this test’s main window. */
    assertHomeActive: async () => {
      baseExpect(await screenHelpers.getActiveScreen(mainWindow)).toBe('home')
      baseExpect(await buttonHelpers.isNavButtonActive(mainWindow, 'Home')).toBe(true)
    },
    /** Click nav button using this test’s main window. */
    clickNavButton: (buttonText: string, timeout?: number) =>
      buttonHelpers.clickNavButton(mainWindow, buttonText, timeout),
    /** Validate page structure using this test’s main window. */
    validatePageStructure: () => uiValidationHelpers.validatePageStructure(mainWindow),
    /** Setup workspace via u i using this test’s main window. */
    setupWorkspaceViaUI: () => workspaceHelpers.setupWorkspaceViaUI(mainWindow),
    /** Create workspace via u i using this test’s main window. */
    createWorkspaceViaUI: () => workspaceHelpers.createWorkspaceViaUI(mainWindow),
    /** Clear workspace via u i using this test’s main window. */
    clearWorkspaceViaUI: () => workspaceHelpers.clearWorkspaceViaUI(mainWindow),
    /** Is workspace ready using this test’s main window. */
    isWorkspaceReady: () => workspaceHelpers.isWorkspaceReady(mainWindow),
    /** Is workspace get started using this test’s main window. */
    isWorkspaceGetStarted: () => workspaceHelpers.isWorkspaceGetStarted(mainWindow),
    /** Get displayed workspace path using this test’s main window. */
    getDisplayedWorkspacePath: () => workspaceHelpers.getDisplayedWorkspacePath(mainWindow),
    /** Assert workspace ready path using this test’s main window. */
    assertWorkspaceReadyPath: async (path: string) => {
      baseExpect(await workspaceHelpers.getDisplayedWorkspacePath(mainWindow)).toBe(path)
      baseExpect(await workspaceHelpers.isWorkspaceReady(mainWindow)).toBe(true)
    },
    /** Click prompt folder item using this test’s main window. */
    clickPromptFolderItem: (folderName: string, timeout?: number) =>
      promptFolderHelpers.clickPromptFolderItem(mainWindow, folderName, timeout),
    /** Get prompt row height using this test’s main window. */
    getPromptRowHeight: (selector: string) =>
      virtualWindowHelpers.getPromptRowHeight(mainWindow, selector),
    /** Get prompt row width using this test’s main window. */
    getPromptRowWidth: (selector: string) =>
      virtualWindowHelpers.getPromptRowWidth(mainWindow, selector),
    /** Get element scroll top using this test’s main window. */
    getElementScrollTop: (selector: string) =>
      virtualWindowHelpers.getElementScrollTop(mainWindow, selector),
    /** Get virtual window scroll height using this test’s main window. */
    getVirtualWindowScrollHeight: (selector: string) =>
      virtualWindowHelpers.getVirtualWindowScrollHeight(mainWindow, selector),
    /** Scroll virtual window to using this test’s main window. */
    scrollVirtualWindowTo: (selector: string, scrollTopPx: number) =>
      virtualWindowHelpers.scrollVirtualWindowTo(mainWindow, selector, scrollTopPx),
    /** Scroll virtual window by using this test’s main window. */
    scrollVirtualWindowBy: (selector: string, deltaPx: number) =>
      virtualWindowHelpers.scrollVirtualWindowBy(mainWindow, selector, deltaPx),
    /** Scroll virtual element into view using this test’s main window. */
    scrollVirtualElementIntoView: (
      hostSelector: string,
      targetSelector: string,
      paddingPx?: number
    ) =>
      virtualWindowHelpers.scrollVirtualElementIntoView(
        mainWindow,
        hostSelector,
        targetSelector,
        paddingPx
      ),
    /** Open prompt folder and wait for hydration ready using this test’s main window. */
    openPromptFolderAndWaitForHydrationReady: (options: {
      folderName: string
      hostSelector: string
      promptSelector: string
      placeholderSelector: string
    }) => promptFolderHelpers.openPromptFolderAndWaitForHydrationReady(mainWindow, options),
    /** Drag sidebar handle by using this test’s main window. */
    dragSidebarHandleBy: (distance: number) =>
      promptFolderHelpers.dragSidebarHandleBy(mainWindow, distance),
    /** Verify prompt visible using this test’s main window. */
    verifyPromptVisible: (promptTitle: string) =>
      promptFolderHelpers.verifyPromptVisible(mainWindow, promptTitle),
    /** Get prompt folder screen info using this test’s main window. */
    getPromptFolderScreenInfo: () =>
      promptFolderHelpers.getPromptFolderScreenInfo(mainWindow),
    // Screen navigation utilities
    /** Navigate to home screen using this test’s main window. */
    navigateToHomeScreen: () => screenHelpers.navigateToHomeScreen(mainWindow),
    /** Navigate to settings screen using this test’s main window. */
    navigateToSettingsScreen: () => screenHelpers.navigateToSettingsScreen(mainWindow),
    /** Navigate to prompt folders using this test’s main window. */
    navigateToPromptFolders: (folderName: string) =>
      promptFolderHelpers.navigateToPromptFolders(mainWindow, folderName),
    /** Opens one prompt-template root through its dedicated activity. */
    navigateToPromptTemplateFolders: (folderName: string) =>
      promptFolderHelpers.navigateToTemplateFolder(mainWindow, folderName),
    /** Pause ipc channel using this test’s main window. */
    pauseIpcChannel: async (channel: string) => {
      await ipcControls.pauseIpcChannel(channel)
    },
    /** Resume ipc channel using this test’s main window. */
    resumeIpcChannel: async (channel: string) => {
      await ipcControls.resumeIpcChannel(channel)
    }
  }
}

/** Inferred facade keeps callers synchronized with the bound helper implementations. */
export type PageHelpers = ReturnType<typeof createPageHelpers>
