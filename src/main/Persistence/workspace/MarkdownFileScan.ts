import * as path from 'path'
import { getFs } from '../../fs-provider'

/** One parsed markdown file with the suffix that matched it. */
export type ScannedMarkdownFile<TParsed> = {
  parsed: TParsed
  suffix: string
  stem: string
  markdownPath: string
}

/** Parses matching files in name order; the first file wins when copies share an ID. */
export const scanMarkdownFiles = <TParsed extends { id: string }>(
  folderPath: string,
  suffixes: readonly string[],
  parse: (fileText: string, suffix: string) => TParsed | null
): ScannedMarkdownFile<TParsed>[] => {
  const fs = getFs()
  if (!fs.existsSync(folderPath)) {
    return []
  }
  /** IDs already claimed by an earlier file in name order. */
  const seenIds = new Set<string>()
  const files: ScannedMarkdownFile<TParsed>[] = []

  for (const entry of fs
    .readdirSync(folderPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile()) continue
    const suffix = suffixes.find((candidate) => entry.name.endsWith(candidate))
    if (!suffix) continue

    const markdownPath = path.join(folderPath, entry.name)
    const parsed = parse(fs.readFileSync(markdownPath, 'utf8'), suffix)
    if (!parsed) continue
    if (seenIds.has(parsed.id)) {
      console.warn(`Ignoring ${markdownPath}: an earlier file already uses ID ${parsed.id}`)
      continue
    }
    seenIds.add(parsed.id)
    files.push({ parsed, suffix, stem: entry.name.slice(0, -suffix.length), markdownPath })
  }

  return files
}
