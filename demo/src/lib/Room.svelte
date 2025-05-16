<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { native, server, account } from './common';
  import type { GameRoom, Player } from './gameTypes';
  import { getRoom, leaveRoom, nextTurn, resetPlayerScore, startGame, updatePlayerScore, getWinner, saveRoom } from './roomInterface';
  import ShareRoomLink from './ShareRoomLink.svelte';
  
  export let room: GameRoom;
  export let playerId: string;
  export let walletAddress: string;
  
  // Local game state
  let currentPlayer: Player | null = null;
  let isHost = false;
  let isTurn = false;
  let gameRoomPollingInterval: number | null = null;
  let transferInProgress = false;
  let transferError = '';
  let shotScores: number[] = [];
  let gameOver = false;
  let winner: Player | null = null;
  
  const dispatch = createEventDispatcher();
  
  // Events from the PasskeyGolf component
  function onShotComplete(event: CustomEvent) {
    if (!isTurn) return;
    
    const score = event.detail.score;
    shotScores = [...shotScores, score];
    
    try {
      // Update player score
      const updatedRoom = updatePlayerScore(room, playerId, score);
      room = updatedRoom;
      
      // Check if game is over
      if (updatedRoom.status === 'completed') {
        gameOver = true;
        winner = getWinner(updatedRoom);
        
        // If we're the host, handle the reward distribution
        if (isHost && winner && winner.walletAddress) {
          setTimeout(() => {
            sendReward(winner.walletAddress);
          }, 2000);
        }
      } else {
        // Move to next player
        room = nextTurn(updatedRoom);
      }
      
      updateLocalPlayerState();
    } catch (err) {
      console.error('Error updating score:', err);
    }
  }
  
  function updateLocalPlayerState() {
    // Find our player
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    
    currentPlayer = player;
    isHost = room.hostId === playerId;
    isTurn = player.isCurrentTurn;
    
    // Update game over state
    gameOver = room.status === 'completed';
    if (gameOver) {
      winner = getWinner(room);
    }
  }
  
  function handleLeaveRoom() {
    try {
      leaveRoom(room, playerId);
      dispatch('leaveRoom');
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  }
  
  function handleStartGame() {
    if (!isHost) return;
    
    try {
      room = startGame(room);
      updateLocalPlayerState();
    } catch (err) {
      console.error('Error starting game:', err);
      alert(err instanceof Error ? err.message : 'Failed to start game');
    }
  }
  
  function handleResetGame() {
    if (!isHost) return;
    
    try {
      room = resetPlayerScore(room);
      shotScores = [];
      gameOver = false;
      winner = null;
      updateLocalPlayerState();
    } catch (err) {
      console.error('Error resetting game:', err);
    }
  }
  
  async function sendReward(winnerAddress: string) {
    if (transferInProgress || !walletAddress) return;
    
    transferInProgress = true;
    transferError = '';
    
    try {
      // Send XLM to the winner
      const { built, ...transfer } = await native.transfer({
        to: winnerAddress,
        from: walletAddress,
        amount: BigInt(room.rewardAmount),
      });
      
      await account.sign(transfer);
      await server.send(built!);
      
      // Update room to mark reward as sent
      room.players.forEach(p => {
        if (p.walletAddress === winnerAddress) {
          p.score += 100; // Additional points for receiving reward
        }
      });
      
      saveRoom(room);
    } catch (err) {
      console.error('Error sending reward:', err);
      transferError = 'Failed to send reward. Try again?';
    } finally {
      transferInProgress = false;
    }
  }
  
  // Poll for room updates - using in-memory store reduces need for polling
  function pollRoomUpdates() {
    if (gameRoomPollingInterval) return;
    
    // With in-memory store, we can poll less frequently, mainly as a backup
    gameRoomPollingInterval = window.setInterval(() => {
      try {
        const updatedRoom = getRoom(room.id);
        if (updatedRoom) {
          room = updatedRoom;
          updateLocalPlayerState();
        }
      } catch (err) {
        console.error('Error polling room:', err);
      }
    }, 5000); // Reduced polling frequency since we now have in-memory store
  }
  
  onMount(() => {
    updateLocalPlayerState();
    pollRoomUpdates();
  });
  
  onDestroy(() => {
    if (gameRoomPollingInterval) {
      clearInterval(gameRoomPollingInterval);
    }
  });
</script>

<div class="game-room">
  <header>
    <h2>{room.name}</h2>
    <div class="room-status">
      <span class="room-id">Room ID: {room.id}</span>
      <span class="status-badge {room.status}">{room.status}</span>
    </div>
  </header>
  
  <div class="game-area">
    <div class="players-panel">
      <h3>Players</h3>
      <ul class="player-list">
        {#each room.players as player}
          <li class:current-player={player.isCurrentTurn} class:is-you={player.id === playerId}>
            <div class="player-name">
              {player.name} {player.id === playerId ? '(You)' : ''}
              {player.id === room.hostId ? '👑' : ''}
            </div>
            <div class="player-score">Score: {player.score}</div>
            <div class="player-shots">Shots left: {player.shotsRemaining}</div>
            {#if !player.isConnected}
              <div class="player-disconnected">Disconnected</div>
            {/if}
          </li>
        {/each}
      </ul>
      
      {#if room.status === 'waiting' && isHost}
        <button 
          class="start-button" 
          on:click={handleStartGame} 
          disabled={room.players.length < 2}
        >
          Start Game
        </button>
        {#if room.players.length < 2}
          <div class="info-message">Need at least 2 players to start</div>
        {/if}
      {/if}
      
      {#if room.status === 'completed' && isHost}
        <button class="reset-button" on:click={handleResetGame}>
          Play Again
        </button>
      {/if}
    </div>
    
    <div class="game-panel">
      {#if room.status === 'waiting'}
        <div class="waiting-screen">
          <h3>Waiting for Game to Start</h3>
          <p>
            {#if isHost}
              <ShareRoomLink roomId={room.id} showQR={true} />
              <br>
              Click "Start Game" when all players have joined.
            {:else}
              Waiting for the host to start the game...
            {/if}
          </p>
          <div class="player-count">
            {room.players.length}/{room.maxPlayers} players joined
          </div>
        </div>
      {:else if room.status === 'playing'}
        {#if isTurn}
          <div class="your-turn">
            <h3>Your Turn!</h3>
            <p>Take your shot!</p>
            <div class="shot-tracker">
              Shot {shotScores.length + 1}/{room.shotsPerPlayer}
            </div>
          </div>
        {:else}
          <div class="waiting-turn">
            <h3>Waiting for Your Turn</h3>
            <p>
              Current player: <strong>{room.players.find(p => p.isCurrentTurn)?.name || 'Unknown'}</strong>
            </p>
          </div>
        {/if}
      {:else if room.status === 'completed'}
        <div class="game-over">
          <h3>Game Over!</h3>
          {#if winner}
            <div class="winner-announcement">
              <span class="winner-label">Winner:</span>
              <span class="winner-name">{winner.name}</span>
              <span class="winner-score">Score: {winner.score}</span>
            </div>
            
            {#if winner.id === playerId}
              <div class="you-won">
                🎉 Congratulations! You won! 🎉
                {#if walletAddress && winner.walletAddress}
                  <div class="reward-info">
                    You will receive {room.rewardAmount / 10_000_000} XLM as a reward!
                  </div>
                {/if}
              </div>
            {/if}
            
            {#if isHost && transferError}
              <div class="error-message">
                {transferError}
                <button 
                  class="retry-button" 
                  on:click={() => sendReward(winner.walletAddress)}
                  disabled={transferInProgress}
                >
                  Retry
                </button>
              </div>
            {/if}
          {:else}
            <p>No winner determined. Try playing again!</p>
          {/if}
          
          <div class="final-scores">
            <h4>Final Scores</h4>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {#each [...room.players].sort((a, b) => b.score - a.score) as player}
                  <tr class:winner-row={winner && player.id === winner.id}>
                    <td>{player.name} {player.id === playerId ? '(You)' : ''}</td>
                    <td>{player.score}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="actions">
    <button class="leave-button" on:click={handleLeaveRoom}>
      Leave Room
    </button>
  </div>
</div>

<style>
  .game-room {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }
  
  h2 {
    margin: 0;
    color: #2c3e50;
  }
  
  .room-status {
    display: flex;
    align-items: center;
  }
  
  .room-id {
    font-family: monospace;
    background-color: #f1f1f1;
    padding: 3px 8px;
    border-radius: 4px;
    margin-right: 10px;
    font-size: 14px;
  }
  
  .status-badge {
    padding: 3px 8px;
    border-radius: 12px;
    color: white;
    font-weight: bold;
    font-size: 12px;
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
  
  .game-area {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  
  .players-panel {
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 15px;
  }
  
  h3 {
    margin-top: 0;
    color: #2c3e50;
    font-size: 18px;
    margin-bottom: 15px;
  }
  
  .player-list {
    list-style-type: none;
    padding: 0;
    margin: 0 0 15px 0;
  }
  
  .player-list li {
    padding: 10px;
    border-bottom: 1px solid #eee;
    position: relative;
  }
  
  .player-list li:last-child {
    border-bottom: none;
  }
  
  .player-list li.current-player {
    background-color: #e1f0fa;
    border-left: 3px solid #3498db;
    font-weight: bold;
    color: #2c3e50;
  }
  
  .player-list li.is-you {
    font-weight: bold;
  }
  
  .player-name {
    margin-bottom: 5px;
  }
  
  .player-score, .player-shots {
    font-size: 12px;
    color: #7f8c8d;
  }
  
  .player-disconnected {
    position: absolute;
    top: 10px;
    right: 10px;
    color: #e74c3c;
    font-size: 12px;
  }
  
  .game-panel {
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 15px;
    display: flex;
    flex-direction: column;
  }
  
  .waiting-screen, .your-turn, .waiting-turn, .game-over {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    padding: 20px;
    overflow-y: auto;
  }
  
  .waiting-screen p, .your-turn p, .waiting-turn p {
    margin-bottom: 20px;
  }
  
  .player-count {
    background-color: #f1f1f1;
    padding: 8px 15px;
    border-radius: 20px;
    font-weight: bold;
  }
  
  .shot-tracker {
    background-color: #f1f1f1;
    padding: 8px 15px;
    border-radius: 20px;
    font-weight: bold;
    margin-top: 10px;
  }
  
  .your-turn h3 {
    color: #2980b9;
    font-size: 24px;
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  .winner-announcement {
    background-color: #fef9e7;
    padding: 15px;
    border-radius: 8px;
    margin: 15px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .winner-label {
    font-size: 14px;
    color: #7f8c8d;
    margin-bottom: 5px;
  }
  
  .winner-name {
    font-size: 24px;
    font-weight: bold;
    color: #e67e22;
    margin-bottom: 5px;
    text-shadow: 0 1px 0 rgba(0,0,0,0.1);
    padding: 2px 6px;
    background-color: #fef9e7;
    border-radius: 4px;
  }
  
  .winner-score {
    font-size: 18px;
  }
  
  .you-won {
    background-color: #d5f5e3;
    padding: 15px;
    border-radius: 8px;
    margin: 15px 0;
    font-weight: bold;
    color: #27ae60;
  }
  
  .reward-info {
    margin-top: 10px;
    font-size: 14px;
  }
  
  .final-scores {
    width: 100%;
    margin-top: 20px;
  }
  
  .final-scores h4 {
    margin-bottom: 10px;
    color: #2c3e50;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  
  th {
    background-color: #f5f5f5;
    font-weight: bold;
  }
  
  .winner-row {
    background-color: #fef9e7;
    font-weight: bold;
  }
  
  .start-button {
    background-color: #27ae60;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
  }
  
  .start-button:hover:not(:disabled) {
    background-color: #219653;
  }
  
  .start-button:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
  
  .reset-button {
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
    margin-top: 10px;
  }
  
  .reset-button:hover {
    background-color: #2980b9;
  }
  
  .info-message {
    font-size: 12px;
    color: #7f8c8d;
    text-align: center;
    margin-top: 5px;
  }
  
  .leave-button {
    background-color: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    font-weight: bold;
    cursor: pointer;
  }
  
  .leave-button:hover {
    background-color: #c0392b;
  }
  
  .error-message {
    background-color: #f8d7da;
    color: #721c24;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
    text-align: center;
    border: 1px solid #f5c6cb;
  }
  
  .retry-button {
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    margin-top: 5px;
  }
  
  .retry-button:hover:not(:disabled) {
    background-color: #2980b9;
  }
  
  .actions {
    display: flex;
    justify-content: flex-end;
  }
  
  @media (max-width: 768px) {
    .game-area {
      grid-template-columns: 1fr;
    }
  }
</style>