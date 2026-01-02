import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { initializeSvelteVirtualWindowHydrationControls } from './features/virtualizer/SvelteVirtualWindowHydrationControls'

initializeSvelteVirtualWindowHydrationControls()

const app = mount(App, {
  target: document.getElementById('root')!
})

export default app
