export const VIRTUAL_FIND_MARKER = 'UNIQUE_FIND_TARGET_VIRTUAL_LAST'
export const VIRTUAL_FIND_FIRST_PROMPT_INDEX = 1
export const VIRTUAL_FIND_LAST_PROMPT_INDEX = 50

export const virtualFindPromptId = (index: number): string => `virtualization-test-${index}`

export const VIRTUAL_FIND_FIRST_PROMPT_ID = virtualFindPromptId(
  VIRTUAL_FIND_FIRST_PROMPT_INDEX
)
export const VIRTUAL_FIND_LAST_PROMPT_ID = virtualFindPromptId(VIRTUAL_FIND_LAST_PROMPT_INDEX)
