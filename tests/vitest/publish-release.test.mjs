import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { publishRelease } from '../../scripts/publish-release.mjs'

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }))

const repository = 'coxthulhu/Cthulhu-Prompt'
/** CRLF changelog mirrors a Windows checkout on the release runner. */
const changelog = [
  '# Changelog',
  '',
  '## 1.3.0',
  '',
  '### New Features',
  '',
  '- Newer feature.',
  '',
  '## 1.2.3',
  '',
  '### Changes',
  '',
  '- Keep `code`, $variables, and [links](https://example.com).',
  '',
  '### Fixed',
  '',
  '- Fixed a bug.',
  '',
  '## 1.2.2',
  '',
  '### Fixed',
  '',
  '- Older fix.',
  ''
].join('\r\n')

beforeEach(() => {
  vi.resetAllMocks()
})

/** Returns the single gh invocation made by publishRelease. */
function ghCall() {
  expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(1)
  const [command, args, options] = vi.mocked(execFileSync).mock.calls[0]
  expect(command).toBe('gh')
  return { args, notes: options.input }
}

describe('publish release', () => {
  it('publishes tagged download links followed by only the version changelog section', () => {
    publishRelease('v1.2.3', repository, changelog)

    const downloadBase = `https://github.com/${repository}/releases/download/v1.2.3`
    expect(ghCall().notes).toBe([
      '## Downloads',
      '',
      '| Platform | Link |',
      '| --- | --- |',
      `| Windows Installer | [Download](<${downloadBase}/CthulhuPrompt_1.2.3_Windows_Setup.exe>) |`,
      `| Windows Portable | [Download](<${downloadBase}/CthulhuPrompt_1.2.3_Windows_Portable.exe>) |`,
      '',
      '## Changes',
      '',
      '- Keep `code`, $variables, and [links](https://example.com).',
      '',
      '## Fixed',
      '',
      '- Fixed a bug.',
      ''
    ].join('\n'))
  })

  it('reads the oldest section through the end of the changelog', () => {
    publishRelease('v1.2.2', repository, changelog)
    expect(ghCall().notes.endsWith('## Fixed\n\n- Older fix.\n')).toBe(true)
  })

  it.each([
    ['v0.0.37', true],
    ['v1.3.0', true],
    ['v1.2.3', false],
    ['v1.2.10', false]
  ])('publishes the %s draft with prerelease=%s', (tag, prerelease) => {
    publishRelease(tag, repository, `## ${tag.slice(1)}\n\n### Fixed\n\n- Fix.\n`)
    expect(ghCall().args).toEqual([
      'release', 'edit', tag, '--repo', repository, '--title', tag,
      '--draft=false', `--prerelease=${prerelease}`, '--notes-file', '-'
    ])
  })

  it('refuses to publish a version without a changelog section', () => {
    expect(() => publishRelease('v1.2.4', repository, changelog)).toThrow('CHANGELOG.md has no "## 1.2.4" section.')
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })
})
