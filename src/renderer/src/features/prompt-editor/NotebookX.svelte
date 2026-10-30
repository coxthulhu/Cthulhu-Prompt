<script lang="ts">
  import { Icon, type IconProps } from 'lucide-svelte'

  /** Lucide notebook-pen with its lower-right corner opened for a delete mark. */
  let props: IconProps = $props()

  /** Rings, body, and pen follow Lucide's notebook-pen glyph; the X follows its `-x` variants. */
  const iconNode: IconProps['iconNode'] = [
    ['path', { d: 'M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7' }],
    ['path', { d: 'M2 6h4' }],
    ['path', { d: 'M2 10h4' }],
    ['path', { d: 'M2 14h4' }],
    ['path', { d: 'M2 18h4' }],
    ['path', { d: 'M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z' }],
    ['path', { d: 'm17 17 5 5' }],
    ['path', { d: 'm22 17-5 5' }]
  ]
</script>

<Icon name="notebook-x" {...props} {iconNode} />
