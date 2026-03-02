import './app.css'
import { mount } from 'svelte'
import { loadSystemSettings } from './data/Queries/SystemSettingsQuery'
import { loadUserPersistence } from './data/Queries/UserPersistenceQuery'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'
import { initMonacoVscode } from './lib/monacoVscode'

initializeSvelteVirtualWindowHydrationControls()

const bootstrap = async (): Promise<void> => {
  // Side effect: block first render until authoritative system settings are loaded.
  await loadSystemSettings()
  // Side effect: block first render until authoritative user persistence is loaded.
  await loadUserPersistence()

  // Side effect: initialize Monaco VS Code services once before the first editor is created.
  await initMonacoVscode()
  const { default: App } = await import('./App.svelte')

  mount(App, {
    target: document.getElementById('root')!
  })
}

void bootstrap().catch((error) => {
  console.error('Failed to load startup renderer state.', error)
})

export default bootstrap
