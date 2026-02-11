import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { getRuntimeConfig } from './app/runtimeConfig'
import { applySystemSettingsSnapshot } from './data/Queries/SystemSettingsQuery'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'

initializeSvelteVirtualWindowHydrationControls()

const runtimeConfig = getRuntimeConfig()
// Seed  system settings from the startup snapshot.
applySystemSettingsSnapshot({
  settings: runtimeConfig.systemSettings,
  revision: runtimeConfig.systemSettingsRevision
})

const app = mount(App, {
  target: document.getElementById('root')!
})

export default app
