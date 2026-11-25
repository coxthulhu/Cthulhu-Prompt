<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowRight, BookOpen, Check, FileText, Home, Layers, Zap } from '@lucide/svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import NumberedStepRow from '@renderer/common/cthulhu-ui/layout/NumberedStepRow.svelte'
  import { markWelcomeShown } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  /** The shell supplies the available destination for the current workspace. */
  let { open = $bindable(true), action, onopen } = $props<{
    open?: boolean
    action: string | null
    onopen: () => void
  }>()

  /** Dismisses Welcome and opens the requested collection or New Tab. */
  const openTab = (): void => {
    open = false
    onopen()
  }

  // Side effect: record the first display, independently of how the dialog is dismissed.
  onMount(() => {
    void runIpcBestEffort(markWelcomeShown)
  })
</script>

<!-- Four steps guide the user from the starter workspace to copying a prompt. -->
<Dialog
  bind:open
  icon={BookOpen}
  title="Welcome to Cthulhu Prompt"
  subtitle="Your first prompt, from workspace to clipboard."
  submitText={action ?? ''}
  submitIcon={ArrowRight}
  submitTestId="welcome-open-tab-button"
  showSubmitButton={Boolean(action)}
  scrollBody
  class="w-full max-w-[800px]"
  onsubmit={openTab}
>
  <ol class="m-0 list-none px-3" data-testid="welcome-steps">
    <NumberedStepRow
      number={1}
      icon={Home}
      title="Make the workspace yours"
      description="You can rename the default workspace on Home, and rename its project and collections from a New Tab. Use the tabs at the top to switch between open collections."
    >
      {#snippet tip()}
        To open another prompt collection, click + (New Tab) and choose it from the list.
      {/snippet}
    </NumberedStepRow>
    <NumberedStepRow
      number={2}
      icon={Layers}
      title="Build a prompt template"
      badge="Optional"
      description="Select the My Templates tab to write a reusable workflow. You can investigate a bug, implement a feature with Q&amp;A, or create mockups. Your task's text is added when you copy."
    >
      {#snippet tip()}
        <span class="welcomeWorkflow">Investigate a bug</span>
        <span class="welcomeWorkflow">Implement a feature</span>
        <span class="welcomeWorkflow">Create mockups</span>
      {/snippet}
    </NumberedStepRow>
    <NumberedStepRow
      number={3}
      icon={FileText}
      title="Add a prompt task"
      description="Select the My Prompts tab and add the change you want your AI to make. Include context, requirements, and details. Name your tasks and group them into custom categories."
    >
      {#snippet tip()}
        Backlog<ArrowRight size={14} aria-hidden="true" />
        Todo<ArrowRight size={14} aria-hidden="true" />
        In Progress<ArrowRight size={14} aria-hidden="true" />
        <span class="welcomeCompleted">Completed</span>
      {/snippet}
    </NumberedStepRow>
    <NumberedStepRow
      number={4}
      icon={Zap}
      title="Pick a template. Copy and go."
      description="Use the quick template button in the prompt editor to assign a template, or choose no template, and copy the combined text. Paste into your AI tool and send it off!"
    >
      {#snippet tip()}
        <Check size={16} class="welcomeCheck shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1">When the AI finishes, check off the task to move it to Completed.</span>
      {/snippet}
    </NumberedStepRow>
  </ol>
</Dialog>

<style>
  .welcomeWorkflow {
    padding: 2px 9px;
    border-radius: 4px;
    background: var(--ui-neutral-field-surface);
  }

  .welcomeCompleted {
    color: var(--ui-normal-text);
  }

  :global(.welcomeCheck) {
    color: var(--ui-hoverable-icon-glyph);
  }
</style>
