import matter from 'gray-matter'

const frontmatterOptions = {
  engines: {
    // Overrides the built-in evaluator, including its case-insensitive js alias.
    javascript: (): never => {
      throw new Error('JavaScript front matter is disabled')
    }
  }
}

/** Parses metadata without allowing documents to select the JavaScript evaluator. */
export const parseMarkdownFrontmatter = (
  source: string
): Pick<matter.GrayMatterFile<string>, 'data' | 'content'> => {
  // Explicit options also bypass gray-matter's shared content cache.
  const { data, content } = matter(source, frontmatterOptions)
  return { data, content }
}

/** Writes YAML metadata without parsing or changing the Markdown body. */
export const serializeMarkdownFrontmatter = (metadata: object, content: string): string => {
  const document = matter.stringify('', metadata, frontmatterOptions)
  const prefix = document.match(/^---\n[\s\S]*?\n---\n/)
  if (!prefix) throw new Error('Failed to serialize prompt frontmatter')
  return `${prefix[0]}${content}`
}
