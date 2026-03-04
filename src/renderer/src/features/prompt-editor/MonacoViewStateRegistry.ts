const monacoViewStateSavers = new Map<string, () => void>()

export const registerMonacoViewStateSaver = (key: string, saver: () => void): void => {
  monacoViewStateSavers.set(key, saver)
}

export const unregisterMonacoViewStateSaver = (key: string): void => {
  monacoViewStateSavers.delete(key)
}

export const captureRegisteredMonacoViewStates = (): void => {
  for (const saver of monacoViewStateSavers.values()) {
    saver()
  }
}
