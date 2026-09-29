import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { updateReleaseDownloads } from '../../scripts/update-release-downloads.mjs'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }))

const tag = 'v1.2.3'
const repository = 'coxthulhu/Cthulhu-Prompt'
const startMarker = '<!-- downloads:start -->'
const endMarker = '<!-- downloads:end -->'
let release

beforeEach(() => {
  vi.resetAllMocks()
  release = {
    tagName: tag,
    isDraft: true,
    body: '## Changes\r\n\r\nKeep `code`, $variables, and [links](https://example.com).\r\n',
    assets: ['Setup.exe', 'Portable.exe', 'Setup.exe.blockmap'].map((suffix) => ({
      name: `CthulhuPrompt_1.2.3_Windows_${suffix}`,
      state: 'uploaded',
      url: `https://github.com/${repository}/releases/download/${tag}/CthulhuPrompt_1.2.3_Windows_${suffix}`
    }))
  }
  vi.mocked(execFileSync).mockImplementation((_command, args) => {
    if (args[1] === 'view') return JSON.stringify(release)
    return ''
  })
})

function writtenNotes() {
  const edit = vi.mocked(execFileSync).mock.calls.find(([, args]) => args[1] === 'edit')
  expect(edit).toBeDefined()
  expect(edit[1]).toEqual(['release', 'edit', tag, '--repo', repository, '--notes-file', '-'])
  return edit[2].input
}

function expectNoEdit() {
  expect(vi.mocked(execFileSync).mock.calls.some(([, args]) => args[1] === 'edit')).toBe(false)
}

describe('release download table', () => {
  it('prepends links to uploaded executables while preserving the original notes exactly', () => {
    updateReleaseDownloads(tag, repository)

    const notes = writtenNotes()
    expect(notes.startsWith(`${startMarker}\n## Downloads\n`)).toBe(true)
    expect(notes).toContain(`| Windows Installer | [Download](<${release.assets[0].url}>) |`)
    expect(notes).toContain(`| Windows Portable | [Download](<${release.assets[1].url}>) |`)
    expect(notes).not.toContain('.blockmap')
    expect(notes.endsWith(`${endMarker}\n\n${release.body}`)).toBe(true)
  })

  it('replaces only the marked section and makes identical reruns a no-op', () => {
    const prefix = 'Introduction\r\n\r\n'
    const suffix = `\r\n\r\n${release.body}`
    release.body = `${prefix}${startMarker}\nOld table\n${endMarker}${suffix}`
    updateReleaseDownloads(tag, repository)
    const notes = writtenNotes()
    expect(notes.startsWith(prefix)).toBe(true)
    expect(notes.endsWith(suffix)).toBe(true)
    expect(notes).not.toContain('Old table')

    release.body = notes
    vi.mocked(execFileSync).mockClear()
    updateReleaseDownloads(tag, repository)
    expectNoEdit()
  })

  it('handles a draft without existing notes', () => {
    release.body = null
    updateReleaseDownloads(tag, repository)
    expect(writtenNotes().endsWith(`${endMarker}\n`)).toBe(true)
  })

  it.each(['missing', 'incomplete'])('refuses an update when an expected upload is %s', (state) => {
    if (state === 'missing') release.assets.shift()
    else release.assets[0].state = 'new'
    expect(() => updateReleaseDownloads(tag, repository)).toThrow('missing a completed upload')
    expectNoEdit()
  })

  it('refuses to change a published release', () => {
    release.isDraft = false
    expect(() => updateReleaseDownloads(tag, repository)).toThrow('must be a draft')
    expectNoEdit()
  })

  it.each([
    startMarker,
    endMarker,
    `${endMarker}\n${startMarker}`,
    `${startMarker}\n${startMarker}\n${endMarker}`,
    `${startMarker}\n${endMarker}\n${endMarker}`
  ])('preserves notes with malformed markers: %s', (body) => {
    release.body = body
    expect(() => updateReleaseDownloads(tag, repository)).toThrow('markers are incomplete or duplicated')
    expectNoEdit()
  })

  it('propagates GitHub failures instead of reporting success', () => {
    vi.mocked(execFileSync).mockImplementation(() => { throw new Error('GitHub unavailable') })
    expect(() => updateReleaseDownloads(tag, repository)).toThrow('GitHub unavailable')
    expectNoEdit()
  })
})
