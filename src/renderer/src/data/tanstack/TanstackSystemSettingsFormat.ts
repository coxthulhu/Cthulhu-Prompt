const formatNumericInput = (value: number): string => {
  return String(value)
}

const normalizeNumericInput = (value: string): { parsed: number; rounded: number } => {
  const parsed = Number(value)
  return {
    parsed,
    rounded: Math.round(parsed)
  }
}

export const formatPromptFontSizeInput = (value: number): string => {
  return formatNumericInput(value)
}

export const formatPromptEditorMinLinesInput = (value: number): string => {
  return formatNumericInput(value)
}

export const normalizePromptFontSizeInput = (value: string): { parsed: number; rounded: number } => {
  return normalizeNumericInput(value)
}

export const normalizePromptEditorMinLinesInput = (
  value: string
): { parsed: number; rounded: number } => {
  return normalizeNumericInput(value)
}
