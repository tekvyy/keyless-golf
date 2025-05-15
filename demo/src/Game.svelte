<script lang="ts">
  import { onMount } from 'svelte';
  import PasskeyGolf from './PasskeyGolf.svelte';
  import MultiplayerGame from './MultiplayerGame.svelte';
  
  export let walletConnected = false;
  export let contractId = "";
  export let onReturn = () => {};
  
  let gameMode: 'single' | 'multi' | 'menu' = 'menu';
  
  function startSinglePlayer() {
    gameMode = 'single';
  }
  
  function startMultiplayer() {
    gameMode = 'multi';
  }
  
  function returnToMenu() {
    gameMode = 'menu';
  }
</script>

<div class="game-container">
  {#if gameMode === 'menu'}
    <header>
      <h1>Passkey Golf</h1>
      <p>A fun game powered by Stellar passkeys!</p>
    </header>
    
    <div class="game-menu">
      <button on:click={startSinglePlayer} class="menu-button single">
        Single Player
      </button>
      <button on:click={startMultiplayer} class="menu-button multi">
        Multiplayer
      </button>
      <button on:click={onReturn} class="menu-button return">
        Return to Demo App
      </button>
    </div>
    
    {#if !walletConnected}
      <div class="wallet-warning">
        <p>⚠️ Connect your wallet in the main app to earn rewards while playing!</p>
      </div>
    {/if}
  {:else if gameMode === 'single'}
    <PasskeyGolf 
      {walletConnected} 
      {contractId} 
      gameMode="single"
    />
    
    <div class="actions">
      <button on:click={returnToMenu} class="return-button">Back to Menu</button>
    </div>
  {:else if gameMode === 'multi'}
    <MultiplayerGame 
      {walletConnected} 
      {contractId} 
      onReturn={returnToMenu}
    />
  {/if}
</div>

<style>
  .game-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  h1 {
    color: #2c3e50;
    margin-bottom: 5px;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
  }
  
  .spinner {
    border: 5px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top: 5px solid #3498db;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .game-menu {
    display: flex;
    flex-direction: column;
    gap: 15px;
    max-width: 400px;
    margin: 40px auto;
  }
  
  .menu-button {
    padding: 15px 20px;
    font-size: 18px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .menu-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .menu-button.single {
    background-color: #3498db;
    color: white;
  }
  
  .menu-button.multi {
    background-color: #e67e22;
    color: white;
  }
  
  .menu-button.return {
    background-color: #7f8c8d;
    color: white;
    margin-top: 20px;
  }
  
  .wallet-warning {
    background-color: #fff3cd;
    border: 1px solid #ffeeba;
    color: #856404;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    margin-top: 20px;
  }
  
  button {
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    background-color: #3498db;
    color: white;
    cursor: pointer;
    font-weight: bold;
  }
  
  button:hover {
    background-color: #2980b9;
  }
  
  .skip-button {
    background-color: #95a5a6;
  }
  
  .skip-button:hover {
    background-color: #7f8c8d;
  }
  
  .return-button {
    background-color: #34495e;
    margin-top: 20px;
  }
  
  .return-button:hover {
    background-color: #2c3e50;
  }
  
  .actions {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
</style>