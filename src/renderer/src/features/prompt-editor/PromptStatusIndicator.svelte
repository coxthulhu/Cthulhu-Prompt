<script lang="ts">
  import type { PromptContentStatus } from '@shared/domain/prompt/Prompt'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    status?: PromptContentStatus
    // Whether this prompt has been edited during the current renderer session.
    isEdited: boolean
    testId: string
    class?: string
  }

  let { status, isEdited, testId, class: className }: Props = $props()
</script>

<!-- Consumers own placement; this accent only maps prompt state to its color. -->
<span
  class={mergeClasses('prompt-status-indicator', className)}
  data-status={status}
  data-edited={isEdited ? 'true' : 'false'}
  data-testid={testId}
  aria-hidden="true"
></span>

<style>
  /* An unset status leaves the accent transparent while still reserving its space. */
  .prompt-status-indicator {
    --prompt-status-indicator-color: transparent;
    background: var(--prompt-status-indicator-color);
  }

  /* Status colors are declared after the edited color so a status takes precedence. */
  .prompt-status-indicator[data-edited='true'] {
    --prompt-status-indicator-color: var(--ui-info-strong-border);
  }

  .prompt-status-indicator[data-status='InProgress'] {
    --prompt-status-indicator-color: var(--ui-warning-icon-glyph);
  }

  .prompt-status-indicator[data-status='Completed'] {
    --prompt-status-indicator-color: var(--ui-success-normal-text);
  }

  .prompt-status-indicator[data-status='Archived'] {
    --prompt-status-indicator-color: var(--ui-secondary-icon-glyph);
  }
</style>
