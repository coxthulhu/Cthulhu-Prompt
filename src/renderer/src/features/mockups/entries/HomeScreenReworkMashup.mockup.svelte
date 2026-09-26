<script lang="ts">
  import { BookOpen, Bug, ExternalLink, FileText, FolderOpen, FolderPlus, Folders, X } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/buttons/LinkButton.svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/layout/CardSurface.svelte'
  import CountDisplay from '@renderer/common/cthulhu-ui/layout/CountDisplay.svelte'
  import CthulhuPromptWordmark from '@renderer/common/cthulhu-ui/layout/CthulhuPromptWordmark.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'

  const recentWorkspaces = [
    { name: 'Product Development', path: 'C:\\Users\\Alex\\Documents\\Prompt Workspaces\\Product Development', prompts: 24, folders: 3 },
    { name: 'Cthulhu Prompt', path: 'C:\\Source\\CthulhuPrompt', prompts: 48, folders: 5 },
    { name: 'Personal Projects', path: 'C:\\Users\\Alex\\Documents\\Prompt Workspaces\\Personal Projects', prompts: 12, folders: 2 }
  ]

  // Local state previews opening and closing a sample workspace without touching the application.
  let workspace = $state<(typeof recentWorkspaces)[number] | null>(recentWorkspaces[0])
</script>

<section class="text-base leading-6" style="display: flex; min-width: 0; min-height: 100%; padding: 48px 32px; color: var(--ui-normal-text); font-family: ui-sans-serif, system-ui, sans-serif;" data-testid="home-screen">
  <main style="width: 100%; max-width: 780px; min-width: 0; margin: auto; display: flex; flex-direction: column; gap: 30px;">
    <header style="display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
      <CthulhuPromptWordmark data-testid="home-title" />
      <div style="display: flex; align-items: center; gap: 8px;">
        <Button
          icon={BookOpen}
          text="Welcome"
          variant={workspace ? 'neutral' : 'accent'}
          appearance={workspace ? 'outline' : 'filled'}
        />
        <LinkButton
          icon={Bug}
          text="Github"
          endIcon={ExternalLink}
          appearance="outline"
          href="https://github.com/coxthulhu/Cthulhu-Prompt"
          target="_blank"
          rel="noreferrer"
        />
      </div>
    </header>

    <CardSurface class="overflow-hidden" role="region" aria-label="Workspaces" data-testid="home-primary-card">
      <Row
        variant="workspace"
        icon={FolderOpen}
        label={workspace?.name ?? 'No workspace open'}
        detail={workspace?.path ?? 'Open a workspace or create one to get started.'}
        detailTitle={workspace?.path}
        detailTestId="workspace-ready-path"
        class="p-4"
      >
        {#snippet trailing()}
          <IconButton
            icon={ExternalLink}
            label="Open workspace folder"
            title="Open workspace folder"
            disabled={!workspace}
          />
        {/snippet}
      </Row>
      <Separator />
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; padding: 16px;">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 22px;">
          <CountDisplay icon={FileText} count={workspace?.prompts ?? 0} label="Prompts" />
          <CountDisplay icon={Folders} count={workspace?.folders ?? 0} label="Prompt Folders" />
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
          <Button
            icon={FolderOpen}
            text="Open"
            variant="accent"
            testId="open-workspace-button"
            onclick={() => workspace = recentWorkspaces[0]}
          />
          <Button
            icon={FolderPlus}
            text="Create"
            variant={workspace ? 'neutral' : 'accent'}
            appearance={workspace ? 'outline' : 'filled'}
            testId="create-workspace-button"
          />
          <Button
            icon={X}
            text="Close"
            appearance="outline"
            state={workspace ? 'enabled' : 'disabled'}
            testId="close-workspace-button"
            onclick={() => workspace = null}
          />
        </div>
      </div>
    </CardSurface>
  </main>
</section>
