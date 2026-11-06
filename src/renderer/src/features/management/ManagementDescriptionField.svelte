<script lang="ts">
  import { createDescriptionDraftModelUri } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import AutoSizingMonacoEditor from '../prompt-editor/AutoSizingMonacoEditor.svelte'

  /** Fixed-height Monaco field for one draft's optional full description. */
  type Props = {
    id: string
    help: string
    /** Unique per draft and dialog opening so drafts never share Monaco models. */
    modelKey: string
    value: string
  }

  /** Exact Monaco content height used by the full-description field. */
  const FULL_DESCRIPTION_EDITOR_HEIGHT_PX = 176

  /** Field identity and bound draft description supplied by the management editor. */
  let { id, help, modelKey, value = $bindable() }: Props = $props()
  /** Current system settings used for Monaco typography. */
  const systemSettings = getSystemSettingsContext()
  /** Monaco typography following the prompt font size with a fixed-height viewport. */
  const sizingConfig = $derived({ fontSize: systemSettings.promptFontSize, minLines: 1, maxLines: 35 })
  /** Stable Monaco model URI for this draft in this dialog opening. */
  const modelUri = $derived(createDescriptionDraftModelUri(modelKey))
  /** Measured width supplied to Monaco layout updates. */
  let editorWidthPx = $state(0)
  /** Border host shared by Monaco and its overflow widgets. */
  let editorHost = $state<HTMLDivElement | null>(null)

  // Side effect: keep fixed-height Monaco width aligned with the responsive dialog pane.
  $effect(() => {
    if (!editorHost) return
    /** Copies the editor host width into Monaco's explicit layout input. */
    const updateEditorWidth = (): void => {
      editorWidthPx = editorHost?.getBoundingClientRect().width ?? 0
    }
    updateEditorWidth()
    /** Observes responsive dialog width changes while the selected editor is mounted. */
    const resizeObserver = new ResizeObserver(updateEditorWidth)
    resizeObserver.observe(editorHost)
    return () => resizeObserver.disconnect()
  })
</script>

<!-- Shared management-dialog full description; the field ID doubles as its test ID. -->
<div>
  <TitleSubtitleStack class="mb-[7px]">
    <Title title="Full Description" variant="small" />
    <Subtitle text={help} />
  </TitleSubtitleStack>
  <div
    bind:this={editorHost}
    class="cthulhuManagementDescriptionEditor overflow-hidden rounded-[var(--cthulhu-ui-radius-control)] border bg-[var(--ui-editor-content-surface)]"
    data-testid={id}
  >
    {#if editorHost}
      <AutoSizingMonacoEditor
        class="bg-[var(--ui-editor-content-surface)]"
        initialValue={value}
        {modelUri}
        containerWidthPx={editorWidthPx}
        overflowWidgetsDomNode={editorHost}
        rowId={`${id}-${modelKey}`}
        {sizingConfig}
        fixedHeightPx={FULL_DESCRIPTION_EDITOR_HEIGHT_PX}
        ariaLabel="Full Description"
        findSectionKey={`${id}-${modelKey}`}
        onChange={(nextValue) => {
          value = nextValue
        }}
      />
    {/if}
  </div>
</div>

<style>
  .cthulhuManagementDescriptionEditor {
    border-color: var(--ui-neutral-normal-border);
  }
</style>
