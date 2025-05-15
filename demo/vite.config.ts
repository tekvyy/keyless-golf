import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    target: "ESNext",
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'public/game.html',
      },
    },
  },
})
