<script lang="ts">
  import Input from '@renderer/common/ui/input/input.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'

  type Props = {
    title: string
    draftText: string
    onTitleChange: (value: string) => void
    onDelete: () => void
  }

  let { title, draftText, onTitleChange, onDelete }: Props = $props()
</script>

<div class="flex items-center gap-2 py-0.5">
  <Input
    data-testid="prompt-title"
    placeholder="Title"
    value={title}
    oninput={(event) => onTitleChange((event.currentTarget as HTMLInputElement).value)}
    class="flex-1 h-[28px] font-mono text-[16px] leading-[20px] md:text-[16px] md:leading-[20px] text-[#D4D4D4] placeholder:text-[#D4D4D4]"
  />
  <PromptEditorButtonBar {title} {draftText} {onDelete} />
</div>
