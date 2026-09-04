import { Archive, Check, CircleDashed, Play, Undo2 } from 'lucide-svelte'
import { PROMPT_STATUS_FOLDERS, PromptStatus } from '@shared/Prompt'
import type { SimpleSelectorButtonItem } from '@renderer/common/cthulhu-ui/SimpleSelectorButton.svelte'

/** Optional quick transition rendered beside the status selector. */
type QuickStatusAction = {
  icon: typeof Check
  label: string
  hoverVariant: 'neutral' | 'success'
  testId: string
  status: PromptStatus
}

/** Presentation and explicit quick actions for one registered workflow status. */
type PromptStatusItem = SimpleSelectorButtonItem & {
  id: PromptStatus
  omitFromMenu?: boolean
  forwardAction?: QuickStatusAction
  backwardAction?: QuickStatusAction
}

/** Completion action shared by the current Active statuses. */
const completeAction: QuickStatusAction = {
  icon: Check,
  label: 'Complete prompt',
  hoverVariant: 'success',
  testId: 'prompt-complete-button',
  status: PromptStatus.Completed
}

/** Editor metadata indexed by the shared status identities. */
const statusPresentation: Record<PromptStatus, PromptStatusItem> = {
  [PromptStatus.Todo]: {
    id: PromptStatus.Todo,
    forwardAction: completeAction,
    label: 'Todo',
    selectedLabel: 'Todo',
    detail: 'Move back to active todo status',
    icon: CircleDashed,
    iconClass: 'prompt-editor-status-option-icon-todo',
    variant: 'todo',
    testId: 'prompt-status-option-todo'
  },
  [PromptStatus.InProgress]: {
    id: PromptStatus.InProgress,
    forwardAction: completeAction,
    backwardAction: {
      icon: Undo2,
      label: 'Set prompt to Todo',
      hoverVariant: 'neutral',
      testId: 'prompt-previous-status-button',
      status: PromptStatus.Todo
    },
    label: 'In Progress',
    detail: 'Mark this prompt as underway',
    icon: Play,
    iconClass: 'prompt-editor-status-option-icon-in-progress',
    tone: 'warning',
    variant: 'in-progress',
    testId: 'prompt-status-option-in-progress'
  },
  [PromptStatus.Completed]: {
    id: PromptStatus.Completed,
    backwardAction: {
      icon: Undo2,
      label: 'Uncomplete prompt',
      hoverVariant: 'neutral',
      testId: 'prompt-uncomplete-button',
      status: PromptStatus.Todo
    },
    label: 'Complete',
    selectedLabel: 'Completed',
    detail: 'Move this prompt to completed',
    icon: Check,
    iconClass: 'prompt-editor-status-option-icon-completed',
    tone: 'success',
    variant: 'completed',
    testId: 'prompt-status-option-completed'
  },
  [PromptStatus.Archived]: {
    id: PromptStatus.Archived,
    omitFromMenu: true,
    label: 'Archived',
    detail: 'Archived prompts must be restored to another status',
    icon: Archive,
    variant: 'archived'
  }
}

/** Editor options follow the groups and status order declared by the shared registry. */
export const promptStatusItems = PROMPT_STATUS_FOLDERS.flatMap((group) =>
  group.statuses.map((status) => statusPresentation[status])
)
