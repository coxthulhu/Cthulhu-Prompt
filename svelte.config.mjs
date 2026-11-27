import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { lucideStaticIcons } from './build/svelte/lucideStaticIcons.mjs'

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: [lucideStaticIcons(), vitePreprocess()]
}
