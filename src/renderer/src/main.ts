import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { loadSystemSettings } from './data/Queries/SystemSettingsQuery'
import { loadUserPersistence } from './data/Queries/UserPersistenceQuery'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'
import { initializeMonacoVscodeApi, warmupMonacoEditor } from './common/Monaco'

initializeSvelteVirtualWindowHydrationControls()

const bootstrap = async (): Promise<void> => {
  // Side effect: block first render until authoritative system settings are loaded.
  await loadSystemSettings()
  // Side effect: block first render until authoritative user persistence is loaded.
  await loadUserPersistence()

  // Side effect: initialize VSCode-backed Monaco services before first editor/model creation.
  await initializeMonacoVscodeApi()

  try {
    // Side effect: pre-load Monaco editor modules before the first visible editor mounts.
    warmupMonacoEditor()
  } catch (error) {
    console.warn('Monaco warmup failed. Continuing startup without warmup.', error)
  }

  mount(App, {
    target: document.getElementById('root')!
  })
}

void bootstrap().catch((error) => {
  console.error('Failed to load startup renderer state.', error)
})

export default bootstrap
