import { dialog } from 'electron'

// Define the interface for dialog operations
interface DialogProvider {
  selectFolder(): Promise<{ dialogCancelled: boolean; filePaths: string[] }>
}

// Default implementation using Electron's dialog
class ElectronDialogProvider implements DialogProvider {
  async selectFolder(): Promise<{ dialogCancelled: boolean; filePaths: string[] }> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return {
      dialogCancelled: result.canceled,
      filePaths: result.filePaths
    }
  }
}

// Test implementation that returns mocked results
class TestDialogProvider implements DialogProvider {
  constructor(private mockResults: string[]) {}

  async selectFolder(): Promise<{ dialogCancelled: boolean; filePaths: string[] }> {
    return {
      dialogCancelled: false,
      filePaths: this.mockResults
    }
  }
}

let current: DialogProvider = new ElectronDialogProvider()

export function setDialogProvider(provider: DialogProvider): void {
  current = provider
}

export function getDialogProvider(): DialogProvider {
  return current
}

export function createTestDialogProvider(mockResults: string[]): DialogProvider {
  return new TestDialogProvider(mockResults)
}
