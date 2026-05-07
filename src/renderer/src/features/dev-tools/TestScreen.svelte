<script lang="ts">
  import {
    AlertCircle,
    Bell,
    Check,
    CircleGauge,
    ClipboardList,
    FileText,
    FolderOpen,
    Home,
    Info,
    Minus,
    Plus,
    Save,
    Settings,
    ShieldAlert,
    Sparkles,
    Trash2,
    X
  } from 'lucide-svelte'
  import AccentIconTile from '@renderer/common/cthulhu-ui/AccentIconTile.svelte'
  import CardSurface, {
    type CardSurfaceVariant
  } from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import CheckboxInput from '@renderer/common/cthulhu-ui/CheckboxInput.svelte'
  import CthulhuDialog from '@renderer/common/cthulhu-ui/CthulhuDialog.svelte'
  import ErrorDialog from '@renderer/common/cthulhu-ui/ErrorDialog.svelte'
  import FileInput from '@renderer/common/cthulhu-ui/FileInput.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import IconDescriptionButton, {
    type IconDescriptionButtonVariant
  } from '@renderer/common/cthulhu-ui/IconDescriptionButton.svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
  import IconPillButton from '@renderer/common/cthulhu-ui/IconPillButton.svelte'
  import IconPillSurface from '@renderer/common/cthulhu-ui/IconPillSurface.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import LabeledDisplayField from '@renderer/common/cthulhu-ui/LabeledDisplayField.svelte'
  import LogDetails from '@renderer/common/cthulhu-ui/LogDetails.svelte'
  import MessageRow, {
    type MessageRowVariant
  } from '@renderer/common/cthulhu-ui/MessageRow.svelte'
  import NumericInput from '@renderer/common/cthulhu-ui/NumericInput.svelte'
  import NumericStatCard from '@renderer/common/cthulhu-ui/NumericStatCard.svelte'
  import StatusBadge, {
    type StatusBadgeVariant
  } from '@renderer/common/cthulhu-ui/StatusBadge.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import type { CthulhuSize } from '@renderer/common/cthulhu-ui/types'

  type AccentIconTileVariant = 'accent' | 'accent-bordered' | 'danger'
  type IconOnlyButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill'
  type IconOnlyButtonVariant = 'outline' | 'transparent' | 'muted-border' | 'accent' | 'danger'
  type IconPillButtonVariant = 'accent' | 'neutral'
  type IconTextButtonState = 'active' | 'enabled' | 'disabled'
  type IconTextButtonVariant = 'neutral' | 'accent' | 'nav'
  type TitleBlockIconVariant = 'accent' | 'danger'

  const accentIconTileVariants: AccentIconTileVariant[] = ['accent', 'accent-bordered', 'danger']
  const accentIconTileSizes: CthulhuSize[] = ['small', 'medium', 'large']
  const cardSurfaceVariants: CardSurfaceVariant[] = ['panel', 'panel-flat', 'solid', 'inset']
  const iconDescriptionButtonVariants: IconDescriptionButtonVariant[] = [
    'neutral',
    'accent',
    'danger'
  ]
  const iconOnlyButtonVariants: IconOnlyButtonVariant[] = [
    'outline',
    'transparent',
    'muted-border',
    'accent',
    'danger'
  ]
  const iconOnlyButtonSizes: IconOnlyButtonSize[] = ['default', 'compact', 'rail', 'rail-fill']
  const iconPillButtonVariants: IconPillButtonVariant[] = ['neutral', 'accent']
  const iconTextButtonVariants: IconTextButtonVariant[] = ['neutral', 'accent', 'nav']
  const iconTextButtonStates: IconTextButtonState[] = ['enabled', 'active', 'disabled']
  const messageRowVariants: MessageRowVariant[] = ['danger', 'warning']
  const statusBadgeVariants: StatusBadgeVariant[] = ['success', 'accent']
  const titleBlockIconVariants: TitleBlockIconVariant[] = ['accent', 'danger']
  const logDetailsText = 'Queued revision sync\nworkspaceId: demo-workspace\nstatus: ready'
  const errorDialogText = 'Invalid workspace path\nC:\\Source\\PromptApps\\MissingWorkspace'

  let checked = $state(true)
  let unchecked = $state(false)
  let standardText = $state('Renderer prompt collection')
  let invalidText = $state('')
  let readonlyPath = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let folderPath = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let numericValue = $state('14')
  let invalidNumericValue = $state('abc')
  let togglePressed = $state(true)
  let accentDialogOpen = $state(false)
  let dangerDialogOpen = $state(false)
  let errorDialogOpen = $state(false)
</script>

<div class="test-screen-shell" data-testid="test-screen">
  <div class="test-screen-content">
    <header class="test-screen-header">
      <TitleBlock
        title="Cthulhu UI Test Screen"
        description="Renderer component gallery for the shared Cthulhu UI surface."
        icon={Sparkles}
        size="large"
      />

      <StatusBadge icon={Check} text="Dev screen restored" variant="success" />
    </header>

    <section class="component-grid">
      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="CardSurface" description="All surface variants." size="small" />

        <div class="variant-grid">
          {#each cardSurfaceVariants as variant (variant)}
            <CardSurface {variant} class="sample-card">
              <div class="sample-title">{variant}</div>
              <p>Prompt workspace metadata, compact controls, or nested content.</p>
            </CardSurface>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="AccentIconTile" description="Every tile variant and size." size="small" />

        <div class="tile-matrix">
          {#each accentIconTileVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls">
                {#each accentIconTileSizes as size (size)}
                  <AccentIconTile icon={Sparkles} {variant} {size} />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section component-section-wide">
        <TitleBlock title="IconTextButton" description="Neutral, accent, and nav states." size="small" />

        <div class="button-matrix">
          {#each iconTextButtonVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls">
                {#each iconTextButtonStates as state (state)}
                  <IconTextButton icon={Home} text={state} {variant} {state} />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section component-section-wide">
        <TitleBlock title="IconOnlyButton" description="Every icon-only variant and size." size="small" />

        <div class="button-matrix">
          {#each iconOnlyButtonVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls icon-only-controls">
                {#each iconOnlyButtonSizes as size (size)}
                  <div class="icon-only-sample" data-fill-size={size === 'rail-fill'}>
                    <IconOnlyButton
                      icon={variant === 'danger' ? Trash2 : Settings}
                      label={`${variant} ${size}`}
                      {variant}
                      {size}
                      title={`${variant} ${size}`}
                    />
                  </div>
                {/each}
                <IconOnlyButton icon={Minus} label={`${variant} disabled`} {variant} disabled />
              </div>
            </div>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="IconDescriptionButton"
          description="Action cards with descriptive copy."
          size="small"
        />

        <div class="stack">
          {#each iconDescriptionButtonVariants as variant (variant)}
            <IconDescriptionButton
              icon={variant === 'danger' ? ShieldAlert : FolderOpen}
              text={variant}
              description="Select a workspace action with supporting context."
              {variant}
            />
          {/each}
          <IconDescriptionButton
            icon={FolderOpen}
            text="disabled"
            description="Disabled action state."
            state="disabled"
          />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="IconPillButton" description="Compact pill action variants." size="small" />

        <div class="variant-controls">
          {#each iconPillButtonVariants as variant (variant)}
            <IconPillButton icon={Plus} text={variant} {variant} />
          {/each}
          <IconPillButton icon={X} text="disabled" disabled />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="Inputs" description="Text, numeric, file, checkbox, and toggle controls." size="small" />

        <div class="form-grid">
          <TextInput bind:value={standardText} aria-label="Standard text input" />
          <TextInput
            bind:value={invalidText}
            aria-label="Invalid text input"
            aria-invalid="true"
            placeholder="Invalid text"
          />
          <TextInput bind:value={readonlyPath} aria-label="Readonly display input" readonlyDisplay />
          <NumericInput bind:value={numericValue} aria-label="Numeric input" />
          <NumericInput
            bind:value={invalidNumericValue}
            aria-label="Invalid numeric input"
            aria-invalid="true"
          />
          <FileInput bind:value={folderPath} aria-label="File input" buttonText="Browse" />
          <CheckboxInput bind:checked label="Checked checkbox" />
          <CheckboxInput bind:checked={unchecked} label="Unchecked checkbox" />
          <CheckboxInput checked label="Disabled checkbox" disabled />
          <ToggleTextButton
            pressed={togglePressed}
            onclick={() => {
              togglePressed = !togglePressed
            }}
          />
          <ToggleTextButton pressed={false} disabled />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="MessageRow" description="Validation and warning rows." size="small" />

        <div class="stack">
          {#each messageRowVariants as variant (variant)}
            <MessageRow text={`${variant} message row`} {variant} />
          {/each}
          <FloatingValidationMessage message="Prompt folder name is required.">
            <TextInput value="" placeholder="Floating validation anchor" aria-label="Validation field" />
          </FloatingValidationMessage>
          <FloatingValidationMessage message="Review this value before saving." variant="warning">
            <TextInput value="Draft value" aria-label="Warning validation field" />
          </FloatingValidationMessage>
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="StatusBadge" description="Current badge variants." size="small" />

        <div class="variant-controls">
          {#each statusBadgeVariants as variant (variant)}
            <StatusBadge
              icon={variant === 'success' ? Check : Sparkles}
              text={variant}
              {variant}
            />
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="TitleBlock" description="Sizes and icon treatments." size="small" />

        <div class="stack">
          <TitleBlock title="Small title" size="small" />
          <TitleBlock title="Large title" description="Large title with default icon variant." icon={Info} size="large" />
          {#each titleBlockIconVariants as iconVariant (iconVariant)}
            <TitleBlock
              title={iconVariant}
              description="Icon variant sample."
              icon={iconVariant === 'danger' ? AlertCircle : Sparkles}
              {iconVariant}
              size="large"
            />
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="Display Components" description="Read-only fields and stat cards." size="small" />

        <div class="display-grid">
          <IconPillSurface label="Workspace" icon={FolderOpen}>
            <div class="display-value">CthulhuPromptPublic</div>
          </IconPillSurface>
          <IconPillSurface label="No icon">
            <div class="display-value">Inline metadata surface</div>
          </IconPillSurface>
          <LabeledDisplayField
            label="Path"
            text="C:\\Source\\PromptApps\\CthulhuPromptPublic"
            icon={FileText}
            valueTitle="C:\Source\PromptApps\CthulhuPromptPublic"
          />
          <NumericStatCard label="Prompts" text="128" icon={ClipboardList} />
          <NumericStatCard label="Folders" text="12" icon={CircleGauge} />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="LogDetails" description="Technical details block." size="small" />

        <LogDetails title="Autosave" text={logDetailsText} />
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="Dialogs" description="Dialog icon and submit variants plus error dialog." size="small" />

        <div class="variant-controls">
          <IconTextButton
            icon={Bell}
            text="Accent dialog"
            variant="accent"
            onclick={() => {
              accentDialogOpen = true
            }}
          />
          <IconTextButton
            icon={ShieldAlert}
            text="Danger dialog"
            onclick={() => {
              dangerDialogOpen = true
            }}
          />
          <IconTextButton
            icon={AlertCircle}
            text="Error dialog"
            onclick={() => {
              errorDialogOpen = true
            }}
          />
        </div>
      </CardSurface>
    </section>
  </div>
</div>

<CthulhuDialog
  bind:open={accentDialogOpen}
  title="Accent dialog"
  description="Dialog with accent icon and accent submit button."
  icon={Sparkles}
  iconVariant="accent"
  submitText="Save"
  submitVariant="accent"
  submitIcon={Save}
  onsubmit={() => {
    accentDialogOpen = false
  }}
/>

<CthulhuDialog
  bind:open={dangerDialogOpen}
  title="Danger dialog"
  description="Dialog with danger icon and neutral submit button."
  icon={ShieldAlert}
  iconVariant="danger"
  submitText="Acknowledge"
  submitVariant="neutral"
  onsubmit={() => {
    dangerDialogOpen = false
  }}
>
  <MessageRow text="This dialog demonstrates the danger icon treatment." variant="warning" />
</CthulhuDialog>

<ErrorDialog
  bind:open={errorDialogOpen}
  title="Workspace error"
  description="The selected folder did not load."
  errorText={errorDialogText}
/>

<style>
  .test-screen-shell {
    background: var(--background);
    color: var(--ui-normal-text);
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: auto;
    width: 100%;
  }

  .test-screen-content {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100%;
    padding: 1rem;
    width: 100%;
  }

  .test-screen-header {
    align-items: flex-start;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    padding-bottom: 1rem;
  }

  .component-grid {
    align-items: start;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
  }

  .variant-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .sample-title,
  .variant-row > span,
  .display-value {
    color: var(--ui-normal-text);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .tile-matrix,
  .button-matrix,
  .stack,
  .display-grid,
  .form-grid {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .variant-row {
    align-items: center;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    display: grid;
    gap: 0.75rem;
    grid-template-columns: 10rem minmax(0, 1fr);
    min-width: 0;
    padding: 0.75rem;
  }

  .variant-controls {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    min-width: 0;
  }

  .icon-only-controls {
    align-items: stretch;
  }

  .icon-only-sample {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-height: 2.25rem;
    min-width: 2.25rem;
  }

  .icon-only-sample[data-fill-size='true'] {
    height: 2.75rem;
  }

  .form-grid,
  .display-grid {
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  }

  .display-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 48rem) {
    .test-screen-header,
    .variant-row {
      grid-template-columns: 1fr;
    }

    .test-screen-header {
      flex-direction: column;
    }

    .component-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
