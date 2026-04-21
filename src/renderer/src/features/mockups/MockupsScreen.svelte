<script lang="ts">
  import type { MockupEntry, MockupModule } from './mockupTypes'

  type MockupsScreenProps = {
    activeMockupId?: string | null
  }

  let { activeMockupId = $bindable<string | null>(null) }: MockupsScreenProps = $props()

  const mockupModules = import.meta.glob('./entries/**/*.mockup.svelte', {
    eager: true
  }) as Record<string, MockupModule>

  const getMockupBasename = (path: string) => path.split('/').pop()?.replace(/\.mockup\.svelte$/, '') ?? path

  const humanizeMockupName = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const buildMockupEntry = (path: string, module: MockupModule): MockupEntry => {
    const basename = getMockupBasename(path)
    const meta = module.mockupMeta ?? {}

    return {
      path,
      component: module.default,
      id: meta.id ?? basename.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: meta.title ?? humanizeMockupName(basename),
      kicker: meta.kicker ?? 'Mockup',
      description: meta.description ?? 'Preview',
      order: meta.order
    }
  }

  const mockups: MockupEntry[] = Object.entries(mockupModules)
    .map(([path, module]) => buildMockupEntry(path, module))
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) ||
        left.title.localeCompare(right.title) ||
        left.path.localeCompare(right.path)
    )

  const activeMockup = $derived.by(
    () => mockups.find((mockup) => mockup.id === activeMockupId) ?? mockups[0] ?? null
  )
  const ActiveMockup = $derived(activeMockup?.component ?? null)

  // Side effect: keep the selected tab valid during hot reloads when the discovered mockup list changes.
  $effect(() => {
    if (mockups.length === 0) {
      activeMockupId = null
      return
    }

    if (activeMockupId && mockups.some((mockup) => mockup.id === activeMockupId)) {
      return
    }

    activeMockupId = mockups[0].id
  })
</script>

<section
  class="mockups-screen flex min-h-0 flex-1 justify-center overflow-y-auto px-6 py-6 text-white"
  data-testid="mockups-screen"
>
  <div class="mockups-layout">
    {#if activeMockup && ActiveMockup}
      <div class="mockups-tablist-wrap" data-testid="mockups-topbar">
        <div class="mockups-tablist" role="tablist" aria-label="Mockup selector">
          {#each mockups as mockup (mockup.id)}
            <button
              type="button"
              role="tab"
              class="mockups-tab"
              data-testid={`mockup-tab-${mockup.id}`}
              data-active={activeMockup.id === mockup.id}
              aria-selected={activeMockup.id === mockup.id}
              onclick={() => {
                activeMockupId = mockup.id
              }}
            >
              {mockup.title}
            </button>
          {/each}
        </div>
      </div>

      <div class="mockups-preview">
        <div class="mockups-preview-inner">
          <ActiveMockup />
        </div>
      </div>
    {:else}
      <div class="mockups-empty">
        <h2>No mockups found</h2>
        <p>
          Create a self-contained <code>*.mockup.svelte</code> entry under
          <code>features/mockups/entries</code>.
        </p>
      </div>
    {/if}
  </div>
</section>

<style>
  .mockups-screen {
    width: 100%;
  }

  .mockups-layout {
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
  }

  .mockups-empty h2 {
    margin: 0;
    color: var(--ui-normal-text);
    font-weight: 600;
  }

  .mockups-empty p {
    margin: 0;
    line-height: 1.5;
    color: var(--ui-muted-text);
  }

  .mockups-empty code {
    font-family: 'Cascadia Code', Consolas, monospace;
  }

  .mockups-tablist-wrap {
    position: sticky;
    top: 0;
    z-index: 1;
    width: 100%;
    padding: 0;
    background: rgb(from var(--ui-app-background) r g b / 0.94);
    backdrop-filter: blur(16px);
  }

  .mockups-tablist {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    gap: 0.5rem;
  }

  .mockups-tab {
    appearance: none;
    border: 1px solid var(--ui-border-muted);
    background: var(--ui-surface-muted);
    color: var(--ui-secondary-text);
    padding: 0.7rem 1rem;
    border-radius: 1rem;
    font: inherit;
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mockups-tab[data-active='true'] {
    border-color: var(--ui-accent-border);
    background: var(--ui-accent-surface-default);
    color: var(--ui-accent-text);
  }

  .mockups-preview {
    min-width: 0;
    display: flex;
    width: 100%;
  }

  .mockups-preview-inner {
    min-width: 0;
    width: 100%;
  }

  .mockups-empty {
    max-width: 34rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 1rem;
    border: 1px solid var(--ui-border-default);
    background: var(--ui-surface-default);
  }

  @media (max-width: 900px) {
    .mockups-screen {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style>
