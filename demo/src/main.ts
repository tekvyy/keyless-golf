import './app.css'
import App from './App.svelte'
import GameConnector from './GameConnector.svelte'

const app = new App({
  target: document.getElementById('app')!,
})

export default app

// Expose GameConnector component for use in game.html
// @ts-ignore - Make the component available in the global window object
window.app = {
  GameConnector
}
