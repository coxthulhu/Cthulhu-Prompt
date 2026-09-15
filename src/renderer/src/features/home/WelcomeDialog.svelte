<script lang="ts">
  import { onMount } from 'svelte'
  import { BookOpen, FolderOpen, FolderPlus } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
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

<!-- Introduction to the application, its workspace files, and its two main activities. -->
<Dialog
  bind:open
  icon={BookOpen}
  title="Welcome"
  submitText="Create Workspace"
  submitIcon={FolderPlus}
  submitTestId="welcome-create-workspace-button"
  showCancelButton={false}
  scrollBody
  class="w-full max-w-2xl"
  onsubmit={createWorkspace}
>
  <div class="welcomeContent space-y-4 py-4 text-sm leading-6">
    <section aria-labelledby="welcome-introduction-heading" class="space-y-2">
      <h2 id="welcome-introduction-heading" class="text-base leading-6 font-semibold">
        Welcome to Cthulhu Prompt
      </h2>
      <p>
        Create, organize, and copy prompts to your AI tools. If you encounter bugs or quirks,
        <a
          class="welcomeGithubLink underline underline-offset-2"
          href="https://github.com/coxthulhu/Cthulhu-Prompt/issues"
          data-testid="welcome-github-link"
          target="_blank"
          rel="noreferrer"
        >visit our GitHub page</a> to report them. Enhancement requests are welcome too!
      </p>
      <p>
        For very short prompts or questions, you can go straight to your AI tool. Cthulhu Prompt
        is most useful when you need space to develop detailed instructions, organize related
        tasks, or reuse a workflow.
      </p>
    </section>

    <Separator />

    <section aria-labelledby="welcome-workspaces-heading" class="space-y-2">
      <h2 id="welcome-workspaces-heading" class="text-base leading-6 font-semibold">
        Workspaces and Files
      </h2>
      <p>
        A workspace keeps your prompt tasks and templates together in a folder on your computer.
        Your prompts are saved as Markdown files inside the Prompts and Templates folders.
        Create a workspace to begin, or open an existing workspace by selecting its
        .cthulhuprompt.json file.
      </p>
    </section>

    <Separator />

    <section aria-labelledby="welcome-activities-heading" class="space-y-2">
      <h2 id="welcome-activities-heading" class="text-base leading-6 font-semibold">
        Prompt Tasks and Templates
      </h2>
      <p>
        <strong>Prompt tasks</strong> are the prompts you write to make a change: one-time
        instructions for a specific task.
      </p>
      <p>
        <strong>Prompt templates</strong> define reusable workflows. Assign a template to a
        prompt task, and it will be applied when you copy that task to your clipboard.
      </p>
    </section>
  </div>
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
  .welcomeContent {
    color: var(--ui-hoverable-text);
  }

  .welcomeContent h2,
  .welcomeContent strong {
    color: var(--ui-normal-text);
  }

  .welcomeGithubLink {
    color: var(--ui-accent-link-text);
  }

  .welcomeGithubLink:hover,
  .welcomeGithubLink:focus-visible {
    color: var(--ui-accent-link-hover-text);
  }
</style>
