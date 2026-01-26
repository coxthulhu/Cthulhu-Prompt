export const formatPromptFontSizeInput = (value: number): string => {
  return String(value)
}

const parsePromptFontSizeInput = (value: string): number => {
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
