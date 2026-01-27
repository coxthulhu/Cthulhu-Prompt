export const formatPromptFontSizeInput = (value: number): string => {
  return String(value)
}

const parsePromptFontSizeInput = (value: string): number => {
  return Number(value)
}

export const formatPromptEditorMinLinesInput = (value: number): string => {
  return String(value)
}

const parsePromptEditorMinLinesInput = (value: string): number => {
  return Number(value)
}

export type PromptFontSizeNormalization = {
  parsed: number
  rounded: number
  normalizedInput: string
}

export const normalizePromptFontSizeInput = (value: string): PromptFontSizeNormalization => {
  const parsed = parsePromptFontSizeInput(value)
  const rounded = Math.round(parsed)
  return {
    parsed,
    rounded,
    normalizedInput: formatPromptFontSizeInput(rounded)
  }
}

export type PromptEditorMinLinesNormalization = {
  parsed: number
  rounded: number
  normalizedInput: string
}

export const normalizePromptEditorMinLinesInput = (
  value: string
): PromptEditorMinLinesNormalization => {
  const parsed = parsePromptEditorMinLinesInput(value)
  const rounded = Math.round(parsed)
  return {
    parsed,
    rounded,
    normalizedInput: formatPromptEditorMinLinesInput(rounded)
  }
}
