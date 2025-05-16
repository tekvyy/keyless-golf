<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import RoomManager from './lib/RoomManager.svelte';
  import Room from './lib/Room.svelte';
  import PasskeyGolf from './PasskeyGolf.svelte';
  import type { GameRoom } from './lib/gameTypes';
  import { LOCAL_PLAYER_ID_KEY } from './lib/roomInterface';
  
  export let walletConnected: boolean = false;
  export let contractId: string = '';
  export let onReturn: () => void;
  
  let playerName: string = localStorage.getItem('playerName') || '';
  let showRoomManager: boolean = true;
  let currentRoom: GameRoom | null = null;
  let playerId: string = '';
  
  const dispatch = createEventDispatcher();
  
  onMount(() => {
    // Get saved player ID
    playerId = localStorage.getItem(LOCAL_PLAYER_ID_KEY) || '';
    
    // Save player name for future sessions
    if (playerName) {
      localStorage.setItem('playerName', playerName);
    }
  });
  
  function handlePlayerNameChange(event: Event) {
    const target = event.target as HTMLInputElement;
    playerName = target.value;
    localStorage.setItem('playerName', playerName);
  }
  
  function handleEnterRoom(event: CustomEvent) {
    currentRoom = event.detail.room;
    showRoomManager = false;
  }
  
  function handleLeaveRoom() {
    currentRoom = null;
    showRoomManager = true;
  }
  
  function handleReturn() {
    if (onReturn) onReturn();
  }
</script>

<div class="multiplayer-container">
  <header>
    <h1>Passkey Golf - Multiplayer</h1>
    <div class="wallet-info">
      {#if walletConnected}
        <div class="connected">✓ Wallet Connected</div>
      {:else}
        <div class="not-connected">✗ No Wallet Connected</div>
      {/if}
    </div>
    
    <button class="return-button" on:click={handleReturn}>
      Return to Main Menu
    </button>
  </header>
  
  {#if showRoomManager}
    <div class="setup">
      <div class="player-name-input">
        <label for="playerName">Your Display Name</label>
        <input 
          type="text" 
          id="playerName" 
          bind:value={playerName} 
          on:change={handlePlayerNameChange}
          placeholder="Enter your name"
        />
      </div>
      
      <RoomManager
        {walletConnected}
        contractId={contractId}
        {playerName}
        on:enterRoom={handleEnterRoom}
      />
    </div>
  {:else if currentRoom}
    <Room
      room={currentRoom}
      playerId={playerId}
      walletAddress={contractId}
      on:leaveRoom={handleLeaveRoom}
    />
  {/if}
</div>

<style>
  .multiplayer-container {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }
  
  h1 {
    margin: 0;
    color: #2c3e50;
    font-size: 24px;
  }
  
  .wallet-info {
    display: flex;
    align-items: center;
  }
  
  .connected {
    color: #27ae60;
    font-weight: bold;
    background-color: #d4edda;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .not-connected {
    color: #e74c3c;
    font-weight: bold;
    background-color: #f8d7da;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .return-button {
    background-color: #7f8c8d;
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  
  .return-button:hover {
    background-color: #6c7a7a;
  }
  
  .setup {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .player-name-input {
    margin-bottom: 20px;
  }
  
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  
  input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
  }
  
  @media (max-width: 768px) {
    header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .wallet-info {
      margin: 10px 0;
    }
  }
</style>