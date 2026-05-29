import type { MockupEntry, MockupModule } from './mockupTypes'

const mockupModules = import.meta.glob('./entries/**/*.mockup.svelte', {
  eager: true
}) as Record<string, MockupModule>

const getMockupFilename = (path: string) => path.split('/').pop() ?? path

const getMockupBasename = (path: string) => getMockupFilename(path).replace(/\.mockup\.svelte$/, '')

const buildMockupEntry = (path: string, module: MockupModule): MockupEntry => {
  const basename = getMockupBasename(path)

  return {
    path,
    component: module.default,
    id: basename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    title: basename
  }
}

export const mockups: MockupEntry[] = Object.entries(mockupModules)
  .map(([path, module]) => buildMockupEntry(path, module))
  .sort(
    (left, right) => left.title.localeCompare(right.title) || left.path.localeCompare(right.path)
  )

export const hasMockup = (mockupId: string): boolean => {
  return mockups.some((mockup) => mockup.id === mockupId)
}
