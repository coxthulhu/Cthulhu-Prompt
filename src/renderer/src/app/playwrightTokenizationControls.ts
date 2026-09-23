import { TextMateWorkerTokenizerController } from '@codingame/monaco-vscode-textmate-service-override/vscode/vs/workbench/services/textMate/browser/backgroundTokenization/textMateWorkerTokenizerController'

/** Gates real TextMate replies so tests can deliver them after editor recycling. */
export const createPlaywrightTokenizationControls = () => {
  /** Whether incoming token replies should wait until the test finishes recycling editors. */
  let paused = false
  /** Held replies retain the original handler and its worker-provided payload. */
  const replies: Array<{ modelPath: string; deliver: () => Promise<void> }> = []
  /** Gate after controller lookup, where a real response can outlive its editor. */
  const acceptTokens = TextMateWorkerTokenizerController.prototype.setTokensAndStates
  TextMateWorkerTokenizerController.prototype.setTokensAndStates = function (...args) {
    if (!paused) return acceptTokens.apply(this, args)
    /** Monaco's private model identity ties the held reply to the editor the test recycles. */
    const modelPath = (this as unknown as { _model: { uri: { path: string } } })._model.uri.path
    return new Promise<void>((resolve, reject) => {
      replies.push({
        modelPath,
        deliver: async () => {
          try {
            await acceptTokens.apply(this, args)
            resolve()
          } catch (error) {
            reject(error)
            throw error
          }
        }
      })
    })
  }
  return {
    /** Holds subsequent worker replies without delaying tokenization inside the worker. */
    pause: (): void => { paused = true },
    /** Reports actual worker replies available for the recycling assertion. */
    getHeldReplyCount: (modelPath: string): number =>
      replies.filter((reply) => reply.modelPath === modelPath).length,
    /** Delivers every held reply through its original handler and awaits their completion. */
    release: async (): Promise<void> => {
      paused = false
      await Promise.all(replies.splice(0).map((reply) => reply.deliver()))
    }
  }
}
