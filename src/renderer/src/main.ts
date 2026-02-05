import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { getRuntimeConfig } from './app/runtimeConfig'
import { setTanstackSystemSettings } from './data/tanstack/TanstackSystemSettings'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'

initializeSvelteVirtualWindowHydrationControls()

const runtimeConfig = getRuntimeConfig()
// Seed Tanstack system settings from the startup snapshot.
setTanstackSystemSettings(runtimeConfig.systemSettings)

const app = mount(App, {
  target: document.getElementById('root')!
})

export default app
