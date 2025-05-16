<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { native, server } from './common';
  import type { GameRoom, Player } from './gameTypes';
  import { createNewRoom, generatePlayerId, getActiveRooms, getRoom, joinRoom, LOCAL_PLAYER_ID_KEY, checkForJoinParameter } from './roomInterface';
  
  export let walletConnected = false;
  export let contractId = '';
  export let playerName = '';
  
  let isCreatingRoom = false;
  let isJoiningRoom = false;
  let roomName = '';
  let selectedRoomId = '';
  let errorMessage = '';
  let activeRooms: GameRoom[] = [];
  let playerId = '';
  
  const dispatch = createEventDispatcher();
  
  onMount(() => {
    // Get stored player ID or generate a new one
    playerId = localStorage.getItem(LOCAL_PLAYER_ID_KEY) || '';
    
    if (!playerId) {
      playerId = generatePlayerId();
      localStorage.setItem(LOCAL_PLAYER_ID_KEY, playerId);
    }
    
    // Load active rooms
    refreshRooms();
    
    // Check if there's a join parameter in URL
    const joinRoomId = checkForJoinParameter();
    if (joinRoomId) {
      selectedRoomId = joinRoomId;
      // Trigger join room if we have a player name and are connected
      if (playerName && walletConnected) {
        setTimeout(() => handleJoinRoom(), 500);
      }
    }
    
    // Set up auto-refresh of room list (more frequent to ensure cross-browser visibility)
    const interval = setInterval(refreshRooms, 3000);
    
    // Listen for storage events from other browser windows
    window.addEventListener('storage', (event) => {
      if (event.key?.includes('passkey-golf')) {
        refreshRooms();
      }
    });
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', () => {});
    };
  });
  
  function refreshRooms() {
    try {
      activeRooms = getActiveRooms();
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  }
  
  function handleCreateRoom() {
    if (!walletConnected) {
      errorMessage = 'Connect your wallet to create a room';
      return;
    }
    
    if (!roomName.trim()) {
      errorMessage = 'Please enter a room name';
      return;
    }
    
    if (!playerName.trim()) {
      errorMessage = 'Please enter your name';
      return;
    }
    
    isCreatingRoom = true;
    errorMessage = '';
    
    try {
      // Create a new room - now synchronous
      const room = createNewRoom(playerId, playerName, contractId, roomName);
      
      // Enter the room
      dispatch('enterRoom', { room, playerId });
    } catch (err) {
      console.error('Error creating room:', err);
      errorMessage = err instanceof Error ? err.message : 'Failed to create room';
    } finally {
      isCreatingRoom = false;
    }
  }
  
  async function handleJoinRoom() {
    if (!walletConnected) {
      errorMessage = 'Connect your wallet to join a room';
      return;
    }
    
    if (!selectedRoomId) {
      errorMessage = 'Please select a room to join';
      return;
    }
    
    if (!playerName.trim()) {
      errorMessage = 'Please enter your name';
      return;
    }
    
    isJoiningRoom = true;
    errorMessage = '';
    
    try {
      // Get the selected room
      const room = getRoom(selectedRoomId);
      
      if (!room) {
        throw new Error('Room no longer exists');
      }
      
      // Join the room
      const updatedRoom = joinRoom(room, playerId, playerName, contractId);
      
      // Enter the room
      dispatch('enterRoom', { room: updatedRoom, playerId });
    } catch (err) {
      console.error('Error joining room:', err);
      errorMessage = err instanceof Error ? err.message : 'Failed to join room';
    } finally {
      isJoiningRoom = false;
    }
  }
  
  function selectRoom(roomId: string) {
    selectedRoomId = roomId;
  }
</script>

<div class="room-manager">
  <div class="player-info">
    {#if !walletConnected}
      <div class="warning">
        Connect your wallet to create or join rooms.
      </div>
    {:else}
      <div class="input-group">
        <label for="playerName">Your Name</label>
        <input 
          type="text" 
          id="playerName" 
          bind:value={playerName} 
          placeholder="Enter your name"
        />
      </div>
    {/if}
  </div>
  
  <div class="room-actions">
    <div class="create-room">
      <h3>Create a New Room</h3>
      <div class="input-group">
        <label for="roomName">Room Name</label>
        <input 
          type="text" 
          id="roomName" 
          bind:value={roomName} 
          placeholder="Enter room name"
          disabled={!walletConnected}
        />
      </div>
      <button 
        on:click={handleCreateRoom} 
        disabled={isCreatingRoom || !walletConnected || !roomName.trim() || !playerName.trim()}
      >
        {isCreatingRoom ? 'Creating...' : 'Create Room'}
      </button>
    </div>
    
    <div class="join-room">
      <h3>Join an Existing Room</h3>
      <div class="room-list">
        {#if activeRooms.length === 0}
          <p class="no-rooms">No active rooms available. Create a new one!</p>
        {:else}
          <ul>
            {#each activeRooms as room}
              <li class:selected={selectedRoomId === room.id} on:click={() => selectRoom(room.id)}>
                <div class="room-name">{room.name}</div>
                <div class="room-status">
                  <span class="player-count">{room.players.length}/{room.maxPlayers} players</span>
                  <span class={`status-badge ${room.status}`}>{room.status}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <button 
        on:click={handleJoinRoom} 
        disabled={isJoiningRoom || !walletConnected || !selectedRoomId || !playerName.trim()}
      >
        {isJoiningRoom ? 'Joining...' : 'Join Room'}
      </button>
      <button class="refresh-button" on:click={refreshRooms}>
        Refresh Rooms
      </button>
    </div>
  </div>
  
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .room-manager {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .player-info {
    margin-bottom: 20px;
  }
  
  .room-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  
  .create-room, .join-room {
    padding: 15px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  h3 {
    margin-top: 0;
    color: #2c3e50;
    font-size: 18px;
    border-bottom: 1px solid #eee;
    padding-bottom: 8px;
  }
  
  .input-group {
    margin-bottom: 15px;
  }
  
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
    color: #555;
  }
  
  input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  button {
    padding: 10px 15px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
    margin-bottom: 10px;
  }
  
  button:hover:not(:disabled) {
    background-color: #2980b9;
  }
  
  button:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
  
  .refresh-button {
    background-color: #7f8c8d;
  }
  
  .refresh-button:hover {
    background-color: #6c7a7a;
  }
  
  .room-list {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 15px;
    border: 1px solid #eee;
    border-radius: 4px;
  }
  
  ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }
  
  li {
    padding: 10px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
  }
  
  li:last-child {
    border-bottom: none;
  }
  
  li:hover {
    background-color: #f5f5f5;
  }
  
  li.selected {
    background-color: #e1f0fa;
    border-left: 3px solid #3498db;
  }
  
  .room-name {
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .room-status {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  
  .status-badge {
    padding: 2px 6px;
    border-radius: 12px;
    color: white;
    font-weight: bold;
  }
  
  .status-badge.waiting {
    background-color: #28a745;
    color: white;
    font-weight: bold;
  }
  
  .status-badge.playing {
    background-color: #fd7e14;
    color: white;
    font-weight: bold;
  }
  
  .status-badge.completed {
    background-color: #6c757d;
    color: white;
    font-weight: bold;
  }
  
  .no-rooms {
    padding: 15px;
    text-align: center;
    color: #7f8c8d;
  }
  
  .warning {
    background-color: #fff3cd;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
    color: #856404;
    border: 1px solid #ffeeba;
    font-weight: bold;
  }
  
  .error-message {
    color: #721c24;
    margin-top: 15px;
    padding: 10px;
    background-color: #f8d7da;
    border-radius: 4px;
    text-align: center;
    border: 1px solid #f5c6cb;
    font-weight: bold;
  }
  
  @media (max-width: 768px) {
    .room-actions {
      grid-template-columns: 1fr;
    }
  }
</style>