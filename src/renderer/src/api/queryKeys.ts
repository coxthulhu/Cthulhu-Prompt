export const queryKeys = {
  promptFolders: {
    all: () => ['promptFolders'] as const,
    list: (workspacePath: string | null) => ['promptFolders', 'list', workspacePath] as const
  }
} as const

export type QueryKeys = typeof queryKeys

export const mutationKeys = {
  promptFolders: {
    create: () => ['promptFolders', 'create'] as const
  },
  workspace: {
    selectFolderDialog: () => ['workspace', 'selectFolderDialog'] as const,
    checkFolderExists: () => ['workspace', 'checkFolderExists'] as const,
    create: () => ['workspace', 'create'] as const
  }
} as const

export type MutationKeys = typeof mutationKeys
