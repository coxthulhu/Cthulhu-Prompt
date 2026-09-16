<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowRight, BookOpen, Check, FileText, FolderOpen, FolderPlus, Home, Layers, Zap } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import NumberedStepRow from '@renderer/common/cthulhu-ui/layout/NumberedStepRow.svelte'
  import { markWelcomeShown } from '@renderer/data/Mutations/UserPersistenceMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  /** Home actions and visibility for the introductory dialog. */
  let { open = $bindable(true), oncreate, onopen } = $props<{
    open?: boolean
    oncreate: () => void
    onopen: () => void
  }>()

  /** Closes the introduction before opening the workspace creation form. */
  const createWorkspace = (): void => {
    open = false
    oncreate()
  }

  /** Closes the introduction before opening the native workspace picker. */
  const openWorkspace = (): void => {
    open = false
    onopen()
  }

  // Side effect: record the first display, independently of how the dialog is dismissed.
  onMount(() => {
    void runIpcBestEffort(markWelcomeShown)
  })
</script>

<!-- Four steps guide the user from creating a workspace to copying a prompt. -->
<Dialog
  bind:open
  icon={BookOpen}
  title="Welcome to Cthulhu Prompt"
  subtitle="Your first prompt, from workspace to clipboard."
  submitText="Create Workspace"
  submitIcon={FolderPlus}
  submitTestId="welcome-create-workspace-button"
  showCancelButton={false}
  scrollBody
  class="w-full max-w-[800px]"
  onsubmit={createWorkspace}
>
  <ol class="m-0 list-none px-3" data-testid="welcome-steps">
    <NumberedStepRow
      number={1}
      icon={Home}
      title="Create a workspace"
      description="Choose a folder on your computer. Your tasks and templates live here as simple Markdown files, ready to commit to source control."
    >
      {#snippet tip()}
        <span class="welcomeScreenIcons" aria-hidden="true">
          <Home size={14} /><FileText size={14} /><Layers size={14} />
        </span>
        <span>Use the left-hand icon bar to switch screens.</span>
      {/snippet}
    </NumberedStepRow>
    <NumberedStepRow
      number={2}
      icon={Layers}
      title="Build a prompt template"
      badge="Optional"
      description="Use Prompt Templates to write a reusable workflow: investigate a bug, implement a feature with Q&amp;A, or create mockups. Your task's text is added when you copy."
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
      description="Open Task Prompts and add the change you want your AI to make. Include context, requirements, and details. Name your tasks and group them into custom categories."
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
  {#snippet secondaryActions()}
    <Button
      text="Open Workspace"
      icon={FolderOpen}
      testId="welcome-open-workspace-button"
      onclick={openWorkspace}
    />
  {/snippet}
</Dialog>

<style>
  .welcomeScreenIcons {
    display: flex;
    gap: 10px;
    padding: 5px 9px;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 5px;
    color: var(--ui-muted-icon-glyph);
  }

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
