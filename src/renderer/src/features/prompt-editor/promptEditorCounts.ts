import { estimateTokenCount } from 'tokenx'

export const getPromptLineCount = (text: string): number => {
  // Empty prompt cards intentionally show 0 lines.
  if (text.length === 0) return 0
  return text.split(/\r\n|\r|\n/).length
}

export const getPromptTokenCount = (text: string): number => estimateTokenCount(text)

