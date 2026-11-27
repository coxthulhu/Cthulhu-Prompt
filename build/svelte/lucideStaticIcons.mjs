// Compiles every @lucide/svelte icon to static SVG markup while Svelte builds it, so the app keeps importing icons
// from '@lucide/svelte' with Lucide's own types. Lucide's shared Icon component builds each icon's children at runtime
// through `{#each}` and `<svelte:element {...attrs}>`; the rewritten icon clones its children from a compiled template.
// Vite builds and the dev server's dependency prebundling both run Svelte preprocessors, so both get static icons.
//
// Not supported: `setLucideProps` context defaults and the `nonScalingStroke` prop. The app uses neither.

const LUCIDE_ICON_FILE = /[\\/]@lucide[\\/]svelte[\\/]dist[\\/]icons[\\/][^\\/]+\.svelte$/
const LUCIDE_ICON_MARKUP = '<Icon {...props} icon={__iconData} />'

/** @param {unknown} value */
const escapeAttribute = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')

/** @param {[string, Record<string, unknown>, unknown[]?]} node */
const renderNode = ([tag, attributes, children]) => {
  const renderedAttributes = Object.entries(attributes)
    .filter(([name]) => name !== 'key')
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
  if (!children?.length) return `<${tag}${renderedAttributes} />`
  return `<${tag}${renderedAttributes}>${children.map(renderNode).join('')}</${tag}>`
}

/**
 * Renders the same attributes and classes as Lucide's Icon (`utils/buildLucideIconNode.js`): caller attributes spread
 * last and win, and the icon is `aria-hidden` unless it has children or an accessibility prop.
 * @param {{ name: string, size?: number, width?: number, height?: number, aliases?: unknown[], node: [string, Record<string, unknown>, unknown[]?][] }} icon
 */
const renderIcon = (icon) => {
  const viewBoxWidth = icon.size ?? icon.width ?? 24
  const viewBoxHeight = icon.size ?? icon.height ?? 24
  const iconSize = icon.size ?? icon.width ?? 24
  const aliasClasses = (icon.aliases ?? [])
    .filter((alias) => typeof alias === 'string' && alias.trim() !== '')
    .map((alias) => `lucide-${alias}`)
  const classNames = ['lucide', `lucide-${icon.name}`, ...aliasClasses, 'lucide-icon'].join(' ')

  return `<script>
  import { hasA11yProp } from '../utils/hasA11yProp.js'

  let {
    color = 'currentColor',
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth = false,
    class: className,
    children,
    ...rest
  } = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}"
  fill="none"
  stroke={color}
  stroke-width={absoluteStrokeWidth ? (Number(strokeWidth) * ${iconSize}) / Number(size) : strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={['${classNames}', className]}
  aria-hidden={children || hasA11yProp(rest) ? undefined : 'true'}
  {...rest}
>${icon.node.map(renderNode).join('')}{@render children?.()}</svg>
`
}

/**
 * Svelte preprocessor that replaces each @lucide/svelte icon component with static markup.
 * @returns {import('svelte/compiler').PreprocessorGroup}
 */
export const lucideStaticIcons = () => ({
  name: 'lucide-static-icons',
  markup({ content, filename }) {
    if (!filename || !LUCIDE_ICON_FILE.test(filename)) return undefined

    const moduleScript = content.match(/<script module[^>]*>[\s\S]*?<\/script>/)?.[0]
    const iconData = moduleScript?.match(/__iconData = (\{.*\});$/m)?.[1]
    if (!moduleScript || !iconData || !content.includes(LUCIDE_ICON_MARKUP)) {
      throw new Error(`lucide-static-icons: unexpected @lucide/svelte icon layout in ${filename}`)
    }
    return { code: `${moduleScript}\n\n${renderIcon(JSON.parse(iconData))}` }
  }
})
