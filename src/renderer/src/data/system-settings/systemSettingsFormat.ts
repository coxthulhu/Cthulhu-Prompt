export const formatPromptFontSizeInput = (value: number): string => {
  return String(value)
}

export const parsePromptFontSizeInput = (value: string): number => {
  return Number(value)
}

export const roundPromptFontSizeInput = (value: string): number => {
  return Math.round(parsePromptFontSizeInput(value))
}
