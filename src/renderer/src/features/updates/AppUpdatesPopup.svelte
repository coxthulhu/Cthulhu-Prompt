<script lang="ts">
  import { ChevronRight, Download, ExternalLink, RefreshCw, X } from 'lucide-svelte'
  import { APP_RELEASES_URL, type AppUpdateState } from '@shared/runtime/AppUpdates'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/buttons/LinkButton.svelte'
  import Popup from '@renderer/common/cthulhu-ui/dialogs/Popup.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import ProgressBar from '@renderer/common/cthulhu-ui/loading/ProgressBar.svelte'

  /** Main-process snapshot and shell-owned popup actions. */
  let { open = $bindable(false), state, onclose, ondownload, oninstall } = $props<{
    open?: boolean
    state: AppUpdateState
    onclose: () => void
    /** Starts or retries a download without blocking the workspace. */
    ondownload: () => void
    /** Installs the downloaded release after explicit user consent. */
    oninstall: () => void
  }>()
  /** Both operations report activity, while only restart preparation blocks interaction. */
  const busy = $derived(state.status === 'downloading' || state.status === 'restarting')
  /** Downloads remain dismissible; only an explicit restart makes the popup modal. */
  const restarting = $derived(state.status === 'restarting')
  /** Failed checks retain their retry action even when an older check found an update. */
  const showUpdate = $derived(state.hasUpdate && state.status !== 'checking' && state.status !== 'check-error')
  /** Non-installed distributions may inspect releases but never launch an installer. */
  const disabled = $derived(busy || state.status === 'checking' || (showUpdate && state.mode !== 'installed'))
  /** Progress messages remain visible at every stage. */
  const label = $derived({
    checking: 'Checking for updates…', current: 'No updates available', available: 'Update available',
    downloading: 'Downloading update…', ready: 'Update ready', restarting: 'Restarting to install',
    'check-error': 'Unable to check for updates', 'update-error': 'Update failed'
  }[state.status])
  /** Context for the current operation, including transfer measurements when known. */
  const detail = $derived.by(() => {
    if (state.status === 'checking') return 'Looking for the latest release.'
    if (state.status === 'check-error') return 'We couldn’t check for a new version. Try again or visit GitHub Releases.'
    if (state.status === 'update-error') return 'The update couldn’t be completed. Try again or visit GitHub Releases.'
    if (state.status === 'downloading') return state.total
      ? `${(state.transferred / 1048576).toFixed(1)} MB of ${(state.total / 1048576).toFixed(1)} MB`
      : 'Preparing the update download.'
    if (state.status === 'restarting') return 'The application will restart to install the update.'
    if (state.status === 'ready') return 'Ready to update and restart.'
    if (state.mode === 'development') return 'Automatic updates are unavailable in development builds.'
    if (state.hasUpdate) return state.mode === 'portable' ? 'A new portable version is available.' : 'A new version is available to download.'
    return state.latestVersion === state.currentVersion ? 'You are using the latest version.' : 'No newer stable release is available.'
  })

  /** Missing or malformed publication timestamps match the mockup's dash placeholder. */
  const releaseDate = (date: string | null): string => {
    /** Parsed timestamp is used only for display, never version comparison. */
    const parsed = date ? new Date(date) : null
    return parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : '—'
  }
</script>

<!-- Persistent update surface follows the approved mockup without its preview controls. -->
<Popup bind:open title="App Updates" backdrop={restarting} closeDisabled={restarting} {busy}
  placement="bottom-left" offsetX={58} offsetY={10}
  class="flex w-[340px] flex-col text-sm leading-5" testId="app-updates-popup" {onclose}>
  {#snippet children(closeUpdates)}
    <header class="flex min-w-0 items-center gap-2 px-4 py-3">
      <Download size={24} class="shrink-0" aria-hidden="true" />
      <h2 class="m-0 flex-1 text-lg font-semibold">App Updates</h2>
      <IconButton icon={X} label="Close updates" disabled={restarting} onclick={closeUpdates} />
    </header>
    <Separator />
    <div class="appUpdatesBody min-w-0 p-4">
      <div class="mb-[18px] flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="mb-1 text-sm text-[var(--ui-muted-text)]">Current version</div>
          <div class="text-xl leading-7 font-semibold tabular-nums" data-testid="update-current-version">{state.mode === 'development' ? 'DEV BUILD' : state.currentVersion}</div>
          <div class="mt-1 text-sm text-[var(--ui-secondary-text)]" data-testid="update-current-date">{releaseDate(state.currentReleaseDate)}</div>
        </div>
        <ChevronRight size={18} class="shrink-0 text-[var(--ui-muted-icon-glyph)]" />
        <div class="latestVersion min-w-0 flex-1 rounded-md border px-[13px] py-[9px]" data-available={showUpdate} data-testid="update-latest-card">
          <div class="mb-1 text-sm text-[var(--ui-secondary-text)]">Latest version</div>
          <div class="text-xl leading-7 font-semibold tabular-nums" data-testid="update-latest-version">{state.latestVersion ?? '—'}</div>
          <div class="mt-1 text-sm text-[var(--ui-secondary-text)]" data-testid="update-latest-date">{releaseDate(state.latestReleaseDate)}</div>
        </div>
      </div>
      <div aria-live="polite" class="border-t border-[var(--ui-neutral-muted-border)] pt-[14px] pb-[17px]">
        <ProgressBar value={Math.round(state.percent)} {label} {detail} ariaLabel="Update progress" />
      </div>
      {#if state.mode === 'portable'}
        <p class="m-0 mb-2 text-sm leading-5">Portable copies cannot auto-update. Go to GitHub Releases and download the new version.</p>
      {/if}
      <Button variant="accent" state={disabled ? 'disabled' : 'enabled'} icon={RefreshCw}
        text={state.status === 'ready' || restarting ? 'Update & Restart' : showUpdate ? 'Download Update' : 'Check for Updates'} testId="update-action"
        onclick={() => state.status === 'ready' ? oninstall() : showUpdate ? ondownload() : void window.appUpdates.check()}
        style="width:100%;max-width:none;justify-content:center;" />
      <LinkButton href={APP_RELEASES_URL} appearance="outline" endIcon={ExternalLink}
        text="Open GitHub Releases" class="updateReleasesLink mt-2"
        target="_blank" rel="noreferrer" testId="update-releases-link" />
    </div>
  {/snippet}
</Popup>

<style>
  /* Match the primary action width instead of the shared button's 14rem cap. */
  .appUpdatesBody :global(.updateReleasesLink) {
    width: 100%;
    max-width: none;
    justify-content: center;
  }

  .latestVersion {
    border-color: var(--ui-neutral-muted-border);
    background: var(--ui-neutral-normal-surface);
  }
  .latestVersion[data-available='true'] {
    border-color: var(--ui-accent-muted-border);
    background: var(--ui-accent-action-fill);
  }
</style>
