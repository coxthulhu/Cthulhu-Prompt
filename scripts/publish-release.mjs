import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Builds release notes from download links and the version's CHANGELOG.md section. */
export function buildReleaseNotes(tag, repository, changelog) {
  const version = tag.slice(1)
  /** Changelog lines; Windows checkouts may use CRLF endings. */
  const lines = changelog.split(/\r?\n/)
  /** Index of this version's `## X.Y.Z` heading. */
  const start = lines.indexOf(`## ${version}`)
  if (start === -1) throw new Error(`CHANGELOG.md has no "## ${version}" section.`)
  /** Index of the next version heading, or -1 for the oldest section. */
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  /** Section body with its ### headings promoted to release-note ## headings. */
  const section = lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim().replace(/^### /gm, '## ')
  /** Tagged download path; draft asset URLs 404 once the release is published. */
  const base = `https://github.com/${repository}/releases/download/${tag}`
  return [
    // Markers keep the download table identifiable for any later tooling that edits notes.
    '<!-- downloads:start -->',
    '## Downloads',
    '',
    '| Platform | Link |',
    '| --- | --- |',
    // These names match the NSIS and portable artifactName settings in electron-builder.yml.
    `| Windows Installer | [Download](<${base}/CthulhuPrompt_${version}_Windows_Setup.exe>) |`,
    `| Windows Portable | [Download](<${base}/CthulhuPrompt_${version}_Windows_Portable.exe>) |`,
    '<!-- downloads:end -->',
    '',
    section,
    ''
  ].join('\n')
}

/** Publishes electron-builder's draft; 0.0.x and x.y.0 are prereleases, other x.y.z patches are stable. */
export function publishRelease(tag, repository, changelog) {
  const notes = buildReleaseNotes(tag, repository, changelog)
  const prerelease = /^v0\.0\.|\.0$/.test(tag)
  // Pass the notes through stdin to preserve Markdown without shell quoting or temp files.
  execFileSync(
    'gh',
    ['release', 'edit', tag, '--repo', repository, '--title', tag, '--draft=false', `--prerelease=${prerelease}`, '--notes-file', '-'],
    { input: notes, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] }
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publishRelease(process.argv[2], process.argv[3], readFileSync('CHANGELOG.md', 'utf8'))
}
