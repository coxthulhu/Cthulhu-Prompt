<script lang="ts">
  import { AlertTriangle, FolderOpen, FolderPlus, X } from 'lucide-svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  type OpenSelectWorkspaceFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  let isDialogOpen = $state(true)
  let isBrowsing = $state(false)
  let workspaceName = $state('Client Prompts')
  let workspacePath = $state('C:\\Users\\dmin\\Documents\\Cthulhu Workspaces\\Client Prompts')
  let includeExamplePrompts = $state(true)

  const pathWarning = 'Choose an empty folder. This folder already contains files.'

  const openWorkspaceFolderDialog = async (): Promise<OpenSelectWorkspaceFolderDialogResult> => {
    return await ipcInvoke<OpenSelectWorkspaceFolderDialogResult>('select-workspace-folder')
  }

  const handleBrowseFolder = async () => {
    isBrowsing = true
    try {
      const result = await runIpcBestEffort(openWorkspaceFolderDialog, () => ({
        dialogCancelled: true,
        filePaths: []
      }))

      if (!result.dialogCancelled && result.filePaths.length > 0) {
        workspacePath = result.filePaths[0]
      }
    } finally {
      isBrowsing = false
    }
  }

  const styles = {
    page: 'min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px;background:var(--ui-neutral-normal-surface);color:var(--ui-normal-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    shell: 'width:min(100%,920px);display:flex;flex-direction:column;align-items:center;gap:24px;',
    launchPanel:
      'width:100%;border:1px solid var(--ui-card-normal-border);border-radius:28px;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 14px 36px var(--ui-card-normal-shadow);padding:28px;display:flex;justify-content:center;',
    launchButton:
      'height:56px;border:1px solid var(--ui-accent-normal-border);border-radius:18px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);padding:0 22px;display:inline-flex;align-items:center;gap:12px;font-size:15px;font-weight:700;letter-spacing:0;box-shadow:inset 0 1px 0 var(--ui-neutral-muted-surface);cursor:pointer;',
    overlay:
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:color-mix(in srgb,var(--ui-neutral-normal-surface) 72%,transparent);backdrop-filter:blur(10px);',
    dialog:
      'width:min(100%,640px);border:1px solid var(--ui-card-normal-border);border-radius:30px;background-image:linear-gradient(to bottom,var(--ui-card-normal-surface-gradient-start),var(--ui-card-normal-surface-gradient-end));box-shadow:0 28px 80px var(--ui-card-normal-shadow),0 14px 36px var(--ui-card-normal-shadow);padding:0;overflow:hidden;',
    header:
      'display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:26px 26px 18px;',
    iconTile:
      'width:52px;height:52px;border-radius:18px;border:1px solid var(--ui-accent-icon-ring);background:var(--ui-accent-icon-surface);color:var(--ui-accent-icon-glyph);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 var(--ui-neutral-muted-surface);',
    headerText: 'min-width:0;flex:1;padding-top:2px;',
    title:
      'margin:0;color:var(--ui-normal-text);font-size:20px;line-height:1.2;font-weight:700;letter-spacing:0;',
    description:
      'margin:8px 0 0;color:var(--ui-muted-text);font-size:13px;line-height:1.45;font-weight:600;letter-spacing:0;',
    closeButton:
      'width:40px;height:40px;border:1px solid var(--ui-neutral-normal-border);border-radius:14px;background:var(--ui-neutral-normal-surface);color:var(--ui-secondary-text);display:flex;align-items:center;justify-content:center;cursor:pointer;',
    form: 'display:flex;flex-direction:column;gap:16px;padding:0 26px 24px;',
    fieldGroup: 'display:flex;flex-direction:column;gap:9px;',
    label:
      'color:var(--ui-normal-text);font-size:13px;line-height:1.2;font-weight:700;letter-spacing:0;',
    input:
      'width:100%;height:52px;border:1px solid var(--ui-neutral-normal-border);border-radius:17px;background:var(--ui-card-nested-surface);color:var(--ui-normal-text);padding:0 16px;font-size:14px;font-weight:650;letter-spacing:0;outline:none;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);',
    pathRow: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;',
    browseButton:
      'height:52px;border:1px solid var(--ui-neutral-normal-border);border-radius:17px;background:var(--ui-neutral-normal-surface);color:var(--ui-normal-text);padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:0;box-shadow:inset 0 1px 0 var(--ui-neutral-muted-surface);cursor:pointer;',
    warning:
      'display:flex;align-items:flex-start;gap:9px;border:1px solid var(--ui-accent-normal-border);border-radius:16px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);padding:11px 12px;font-size:12.5px;font-weight:650;line-height:1.35;letter-spacing:0;',
    checkboxRow:
      'display:flex;align-items:flex-start;gap:12px;border:1px solid var(--ui-card-nested-border);border-radius:18px;background:var(--ui-card-nested-surface);padding:15px 16px;box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight);',
    checkbox:
      'margin-top:2px;width:20px;height:20px;accent-color:var(--ui-accent-icon-glyph);cursor:pointer;',
    checkboxText: 'display:flex;flex-direction:column;gap:3px;',
    checkboxLabel:
      'color:var(--ui-normal-text);font-size:13px;font-weight:700;line-height:1.25;letter-spacing:0;',
    checkboxDescription:
      'color:var(--ui-muted-text);font-size:12.5px;font-weight:600;line-height:1.35;letter-spacing:0;',
    footer:
      'display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--ui-card-nested-border);background:var(--ui-card-nested-surface);padding:18px 26px 22px;',
    secondaryButton:
      'height:46px;border:1px solid var(--ui-neutral-normal-border);border-radius:15px;background:var(--ui-neutral-normal-surface);color:var(--ui-normal-text);padding:0 18px;font-size:13px;font-weight:700;letter-spacing:0;cursor:pointer;',
    primaryButton:
      'height:46px;border:1px solid var(--ui-accent-normal-border);border-radius:15px;background:var(--ui-accent-normal-surface);color:var(--ui-accent-normal-text);padding:0 18px;font-size:13px;font-weight:800;letter-spacing:0;box-shadow:inset 0 1px 0 var(--ui-neutral-muted-surface);cursor:pointer;'
  }
</script>

<main style={styles.page}>
  <section style={styles.shell}>
    <div style={styles.launchPanel}>
      <button type="button" style={styles.launchButton} onclick={() => (isDialogOpen = true)}>
        <FolderPlus size={20} strokeWidth={2.2} />
        <span>Create Workspace</span>
      </button>
    </div>
  </section>

  {#if isDialogOpen}
    <div style={styles.overlay}>
      <section aria-modal="true" role="dialog" style={styles.dialog}>
        <header style={styles.header}>
          <div style={styles.iconTile}>
            <FolderPlus size={24} strokeWidth={2.1} />
          </div>
          <div style={styles.headerText}>
            <h1 style={styles.title}>Create Workspace</h1>
            <p style={styles.description}>Set up a new Cthulhu Prompt workspace folder.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            style={styles.closeButton}
            onclick={() => (isDialogOpen = false)}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div style={styles.form}>
          <label style={styles.fieldGroup}>
            <span style={styles.label}>Workspace Name</span>
            <input type="text" bind:value={workspaceName} style={styles.input} />
          </label>

          <div style={styles.fieldGroup}>
            <label for="workspace-path" style={styles.label}>Workspace Folder</label>
            <div style={styles.pathRow}>
              <input
                id="workspace-path"
                type="text"
                bind:value={workspacePath}
                style={styles.input}
              />
              <button type="button" style={styles.browseButton} onclick={handleBrowseFolder}>
                <FolderOpen size={18} strokeWidth={2.1} />
                <span>{isBrowsing ? 'Browsing...' : 'Browse'}</span>
              </button>
            </div>
            <div style={styles.warning}>
              <AlertTriangle size={17} strokeWidth={2.2} />
              <span>{pathWarning}</span>
            </div>
          </div>

          <label style={styles.checkboxRow}>
            <input type="checkbox" bind:checked={includeExamplePrompts} style={styles.checkbox} />
            <span style={styles.checkboxText}>
              <span style={styles.checkboxLabel}>Include example prompts</span>
              <span style={styles.checkboxDescription}>Create a "My Prompts" folder.</span>
            </span>
          </label>
        </div>

        <footer style={styles.footer}>
          <button
            type="button"
            style={styles.secondaryButton}
            onclick={() => (isDialogOpen = false)}
          >
            Cancel
          </button>
          <button type="button" style={styles.primaryButton}>Create Workspace</button>
        </footer>
      </section>
    </div>
  {/if}
</main>
