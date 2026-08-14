import { PROMPT_TEXT_TEMPLATE_PARAMETER } from './promptTemplateParameters'

export const hasPromptTextToken = (templateText: string): boolean =>
  templateText.includes(PROMPT_TEXT_TEMPLATE_PARAMETER.token)

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
