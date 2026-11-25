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

/** gh's CRLF asset listing for a release that has every required file. */
const completeAssetListing = (version) => [
  `CthulhuPrompt_${version}_Windows_Portable.exe`,
  `CthulhuPrompt_${version}_Windows_Setup.exe`,
  `CthulhuPrompt_${version}_Windows_Setup.exe.blockmap`,
  'latest.yml',
  ''
].join('\r\n')

beforeEach(() => {
  vi.resetAllMocks()
  // Every draft is complete unless a test supplies its own asset listing.
  vi.mocked(execFileSync).mockImplementation((_command, args) =>
    args[1] === 'view' ? completeAssetListing(args[2].slice(1)) : ''
  )
})

/** Returns the gh edit invocation after checking that the asset check ran first. */
function ghCall() {
  expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(2)
  const [[viewCommand, viewArgs], [command, args, options]] = vi.mocked(execFileSync).mock.calls
  expect(viewCommand).toBe('gh')
  expect(viewArgs[1]).toBe('view')
  expect(command).toBe('gh')
  return { args, notes: options.input }
}

describe('publish release', () => {
  it('publishes tagged download links followed by only the version changelog section', () => {
    publishRelease('v1.2.3', repository, changelog)

    const downloadBase = `https://github.com/${repository}/releases/download/v1.2.3`
    expect(ghCall().notes).toBe([
      '<!-- downloads:start -->',
      '## Downloads',
      '',
      '| Platform | Link |',
      '| --- | --- |',
      `| Windows Installer | [Download](<${downloadBase}/CthulhuPrompt_1.2.3_Windows_Setup.exe>) |`,
      `| Windows Portable | [Download](<${downloadBase}/CthulhuPrompt_1.2.3_Windows_Portable.exe>) |`,
      '<!-- downloads:end -->',
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

  it('lists the release assets before publishing', () => {
    publishRelease('v1.2.3', repository, changelog)
    expect(vi.mocked(execFileSync).mock.calls[0][1]).toEqual([
      'release', 'view', 'v1.2.3', '--repo', repository, '--json', 'assets', '--jq', '.assets[].name'
    ])
  })

  it('refuses to publish a release missing installers or update files', () => {
    vi.mocked(execFileSync).mockReturnValueOnce('CthulhuPrompt_1.2.3_Windows_Setup.exe.blockmap\r\n')
    expect(() => publishRelease('v1.2.3', repository, changelog)).toThrow(
      'Release v1.2.3 is missing CthulhuPrompt_1.2.3_Windows_Setup.exe, CthulhuPrompt_1.2.3_Windows_Portable.exe, latest.yml.'
    )
    expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(1)
  })

  it('refuses to publish a version without a changelog section', () => {
    expect(() => publishRelease('v1.2.4', repository, changelog)).toThrow('CHANGELOG.md has no "## 1.2.4" section.')
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })
})
