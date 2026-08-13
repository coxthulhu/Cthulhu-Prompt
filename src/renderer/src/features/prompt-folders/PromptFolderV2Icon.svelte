<script lang="ts">
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  // Props supported when the V2 numeral is used through the application's icon components.
  type Props = {
    size?: number
    class?: string
    'aria-hidden'?: 'true' | 'false'
  }

  // The requested icon size controls the numeral's square layout.
  let { size = 20, class: className, ...restProps }: Props = $props()
</script>

<!-- Dedicated version marker used anywhere Prompt Folder V2 needs an icon. -->
<span
  class={mergeClasses('promptFolderV2Icon', className)}
  data-testid="prompt-folder-v2-icon"
  style={`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.8)}px;`}
  {...restProps}
>2</span>

<style>
  .promptFolderV2Icon {
    align-items: center;
    color: var(--ui-accent-normal-text);
    display: inline-flex;
    font-weight: 800;
    justify-content: center;
    line-height: 1;
  }
</style>
