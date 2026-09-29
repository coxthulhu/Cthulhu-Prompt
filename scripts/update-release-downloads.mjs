import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const startMarker = '<!-- downloads:start -->'
const endMarker = '<!-- downloads:end -->'

export function updateReleaseDownloads(tag, repository) {
  if (!tag?.startsWith('v') || tag.length === 1 || !repository) {
    throw new Error('Usage: node scripts/update-release-downloads.mjs <vVERSION> <OWNER/REPO>')
  }

  const release = JSON.parse(
    execFileSync(
      'gh',
      ['release', 'view', tag, '--repo', repository, '--json', 'tagName,isDraft,body,assets'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  )
  if (release.tagName !== tag || release.isDraft !== true) {
    throw new Error(`Release ${tag} must be a draft before updating its download table.`)
  }

  const version = tag.slice(1)
  // These names match the NSIS and portable artifactName settings in electron-builder.yml.
  const downloads = [
    ['Windows Installer', `CthulhuPrompt_${version}_Windows_Setup.exe`],
    ['Windows Portable', `CthulhuPrompt_${version}_Windows_Portable.exe`]
  ]
  const rows = downloads.map(([label, name]) => {
    const asset = release.assets.find((candidate) => candidate.name === name)
    if (!asset || asset.state !== 'uploaded' || !asset.url) {
      throw new Error(`Release ${tag} is missing a completed upload for ${name}.`)
    }
    return `| ${label} | [Download](<${asset.url}>) |`
  })
  const table = [
    startMarker,
    '## Downloads',
    '',
    '| Version | Download |',
    '| --- | --- |',
    ...rows,
    endMarker
  ].join('\n')

  const body = release.body ?? ''
  const start = body.indexOf(startMarker)
  const end = body.indexOf(endMarker)
  let notes
  if (start === -1 && end === -1) {
    notes = `${table}\n${body ? `\n${body}` : ''}`
  } else {
    if (
      start === -1 ||
      end < start ||
      body.indexOf(startMarker, start + startMarker.length) !== -1 ||
      body.indexOf(endMarker, end + endMarker.length) !== -1
    ) {
      throw new Error('Download table markers are incomplete or duplicated; release notes were not updated.')
    }
    notes = body.slice(0, start) + table + body.slice(end + endMarker.length)
  }

  if (notes === body) return

  // Pass the complete notes through stdin to preserve Markdown without shell quoting or temp files.
  execFileSync('gh', ['release', 'edit', tag, '--repo', repository, '--notes-file', '-'], {
    input: notes,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit']
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    updateReleaseDownloads(process.argv[2], process.argv[3])
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
