<script lang="ts">
  import { mockups } from './mockupCatalog'

  type MockupsScreenProps = {
    activeMockupId?: string | null
  }

  let { activeMockupId = $bindable<string | null>(null) }: MockupsScreenProps = $props()

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
  class="mockups-screen flex min-h-0 flex-1 justify-center overflow-hidden px-6 text-white"
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
    height: 100%;
    min-height: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
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
    flex: 0 0 auto;
    position: relative;
    top: 0;
    z-index: 10;
    width: 100%;
    padding: 0;
    background: rgb(11 14 18 / 94%);
    backdrop-filter: blur(16px);
  }

  .mockups-tablist {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    gap: 8px;
  }

  .mockups-tab {
    appearance: none;
    border: 1px solid var(--ui-neutral-muted-border);
    background: var(--ui-card-normal-surface-gradient-end);
    color: var(--ui-secondary-text);
    padding: 11px 16px;
    border-radius: 16px;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .mockups-tab[data-active='true'] {
    border-color: var(--ui-accent-normal-border);
    background: var(--ui-accent-action-fill);
    color: var(--ui-accent-normal-text);
  }

  .mockups-preview {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    overflow-y: auto;
    padding-bottom: 24px;
    width: 100%;
  }

  .mockups-preview-inner {
    min-width: 0;
    width: 100%;
  }

  .mockups-empty {
    max-width: 544px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--ui-neutral-normal-border);
    background: var(--ui-neutral-normal-surface);
  }

  @media (max-width: 900px) {
    .mockups-screen {
      padding-left: 16px;
      padding-right: 16px;
    }
  }
</style>
