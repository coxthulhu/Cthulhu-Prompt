import { estimateTokenCount } from 'tokenx'

export const getPromptTokenCount = (text: string): number => estimateTokenCount(text)
