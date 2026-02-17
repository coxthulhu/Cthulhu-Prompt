import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { loadSystemSettings } from './data/Queries/SystemSettingsQuery'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'

initializeSvelteVirtualWindowHydrationControls()

const bootstrap = async (): Promise<void> => {
  // Side effect: block first render until authoritative system settings are loaded.
  await loadSystemSettings()

  mount(App, {
    target: document.getElementById('root')!
  })
}

void bootstrap().catch((error) => {
  console.error('Failed to load startup system settings.', error)
})

export default bootstrap
