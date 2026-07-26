import { PROMPT_TEXT_TEMPLATE_PARAMETER } from './promptTemplateParameters'

export const hasPromptTextToken = (templateText: string): boolean =>
  templateText.includes(PROMPT_TEXT_TEMPLATE_PARAMETER.token)

export const createPromptFolderTemplate = (
  prefix: string | null,
  suffix: string | null
): string => {
  const parts: string[] = []
  if (prefix?.trim().length) parts.push(prefix)
  parts.push(PROMPT_TEXT_TEMPLATE_PARAMETER.token)
  if (suffix?.trim().length) parts.push(suffix)
  return parts.join('\n\n')
}

export const applyPromptTemplates = (
  promptText: string,
  templateTexts: readonly string[]
): string =>
  // Each later template wraps the text produced by the templates before it.
  templateTexts.reduce(
    (text, templateText) =>
      hasPromptTextToken(templateText)
        ? templateText.replaceAll(PROMPT_TEXT_TEMPLATE_PARAMETER.token, text)
        : text,
    promptText
  )
