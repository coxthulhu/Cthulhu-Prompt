import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { getRuntimeConfig } from './app/runtimeConfig'
import { applyTanstackSystemSettingsSnapshot } from './data/tanstack/Queries/TanstackSystemSettingsQuery'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'

initializeSvelteVirtualWindowHydrationControls()

const runtimeConfig = getRuntimeConfig()
// Seed Tanstack system settings from the startup snapshot.
applyTanstackSystemSettingsSnapshot({
  settings: runtimeConfig.systemSettings,
  revision: runtimeConfig.systemSettingsRevision
})

const app = mount(App, {
  target: document.getElementById('root')!
})

export default app
