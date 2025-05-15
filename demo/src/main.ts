import './app.css'
import './light-theme.css'
import App from './App.svelte'
import Game from './Game.svelte'

// Check if we should display the game
const urlParams = new URLSearchParams(window.location.search);
const showGame = urlParams.get('game') === 'true';

// Create the appropriate component
const app = showGame 
  ? new Game({ target: document.getElementById('app')! })
  : new App({ target: document.getElementById('app')! });

export default app
