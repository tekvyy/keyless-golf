// Game room and multiplayer types

export interface Player {
  id: string;
  name: string;
  walletAddress: string;
  score: number;
  shotsRemaining: number;
  isConnected: boolean;
  isCurrentTurn: boolean;
}

export interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'completed';
  currentPlayerIndex: number;
  shotsPerPlayer: number;
  rewardAmount: number; // in stroops (10^-7 XLM)
  created: number; // timestamp
}

export interface GameState {
  currentRoom: GameRoom | null;
  playerScores: Record<string, number[]>;
  currentTurnPlayerName: string;
  isHost: boolean;
  isTurn: boolean;
  gameOver: boolean;
  winner: Player | null;
}

// In a real implementation, we would set up a backend service
// to handle room creation, joining, and state synchronization.
// For this demo, we're simulating it client-side.

export const ROOM_STORAGE_KEY = 'passkey-golf-room';
export const LOCAL_PLAYER_ID_KEY = 'passkey-golf-player-id';

// Helper functions
export function createNewRoom(
  hostId: string,
  hostName: string,
  walletAddress: string,
  roomName: string
): GameRoom {
  const room: GameRoom = {
    id: generateRoomId(),
    name: roomName,
    hostId: hostId,
    players: [{
      id: hostId,
      name: hostName,
      walletAddress,
      score: 0,
      shotsRemaining: 3,
      isConnected: true,
      isCurrentTurn: true,
    }],
    maxPlayers: 4,
    status: 'waiting',
    currentPlayerIndex: 0,
    shotsPerPlayer: 3,
    rewardAmount: 10_000_000, // 1 XLM
    created: Date.now(),
  };
  
  return room;
}

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 12);
}

// Mock localStorage storage for rooms (in a real app, this would be on a server)
export function saveRoom(room: GameRoom): void {
  localStorage.setItem(ROOM_STORAGE_KEY + '-' + room.id, JSON.stringify(room));
}

export function getRoom(roomId: string): GameRoom | null {
  const roomData = localStorage.getItem(ROOM_STORAGE_KEY + '-' + roomId);
  return roomData ? JSON.parse(roomData) : null;
}

export function joinRoom(room: GameRoom, playerId: string, playerName: string, walletAddress: string): GameRoom {
  if (room.players.length >= room.maxPlayers) {
    throw new Error('Room is full');
  }
  
  if (room.status !== 'waiting') {
    throw new Error('Game already in progress');
  }
  
  // Check if player already in room
  const existingPlayer = room.players.find(p => p.id === playerId);
  if (existingPlayer) {
    // Update player connection status if they're rejoining
    existingPlayer.isConnected = true;
    saveRoom(room);
    return room;
  }
  
  // Add player to room
  room.players.push({
    id: playerId,
    name: playerName,
    walletAddress,
    score: 0,
    shotsRemaining: room.shotsPerPlayer,
    isConnected: true,
    isCurrentTurn: false,
  });
  
  saveRoom(room);
  return room;
}

export function nextTurn(room: GameRoom): GameRoom {
  // Find next player with remaining shots
  let nextPlayerIndex = room.currentPlayerIndex;
  let nextPlayer: Player | undefined;
  let fullLoopCount = 0;
  
  // Keep looking for the next player with shots remaining
  do {
    nextPlayerIndex = (nextPlayerIndex + 1) % room.players.length;
    nextPlayer = room.players[nextPlayerIndex];
    
    // If we've gone through all players, increment our loop counter
    if (nextPlayerIndex === 0) {
      fullLoopCount++;
    }
    
    // If we've gone through all players twice, the game is over
    if (fullLoopCount > 1) {
      room.status = 'completed';
      return room;
    }
  } while (nextPlayer.shotsRemaining <= 0);
  
  // Update current player
  for (const player of room.players) {
    player.isCurrentTurn = false;
  }
  
  nextPlayer.isCurrentTurn = true;
  room.currentPlayerIndex = nextPlayerIndex;
  
  // Check if all shots have been used
  const allShotsUsed = room.players.every(p => p.shotsRemaining <= 0);
  if (allShotsUsed) {
    room.status = 'completed';
  }
  
  saveRoom(room);
  return room;
}

export function startGame(room: GameRoom): GameRoom {
  if (room.players.length < 2) {
    throw new Error('Need at least 2 players to start');
  }
  
  room.status = 'playing';
  room.currentPlayerIndex = 0;
  room.players[0].isCurrentTurn = true;
  
  for (let i = 1; i < room.players.length; i++) {
    room.players[i].isCurrentTurn = false;
  }
  
  saveRoom(room);
  return room;
}

export function getWinner(room: GameRoom): Player | null {
  if (room.status !== 'completed') {
    return null;
  }
  
  // Find player with highest score
  let highestScore = -1;
  let winner: Player | null = null;
  
  for (const player of room.players) {
    if (player.score > highestScore) {
      highestScore = player.score;
      winner = player;
    } else if (player.score === highestScore && highestScore > 0) {
      // Handle tie - first player with that score wins
      if (!winner) {
        winner = player;
      }
    }
  }
  
  return winner;
}

export function updatePlayerScore(
  room: GameRoom, 
  playerId: string, 
  score: number
): GameRoom {
  const player = room.players.find(p => p.id === playerId);
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  if (!player.isCurrentTurn) {
    throw new Error('Not player\'s turn');
  }
  
  player.score += score;
  player.shotsRemaining--;
  
  saveRoom(room);
  return room;
}

export function resetPlayerScore(room: GameRoom): GameRoom {
  for (const player of room.players) {
    player.score = 0;
    player.shotsRemaining = room.shotsPerPlayer;
  }
  
  room.status = 'waiting';
  room.currentPlayerIndex = 0;
  room.players[0].isCurrentTurn = true;
  
  for (let i = 1; i < room.players.length; i++) {
    room.players[i].isCurrentTurn = false;
  }
  
  saveRoom(room);
  return room;
}

export function leaveRoom(room: GameRoom, playerId: string): GameRoom {
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  
  if (playerIndex === -1) {
    return room;
  }
  
  // If the host leaves, assign a new host
  if (playerId === room.hostId && room.players.length > 1) {
    // Find first player who isn't the leaving player
    for (const player of room.players) {
      if (player.id !== playerId) {
        room.hostId = player.id;
        break;
      }
    }
  }
  
  // If game is in progress, mark player as disconnected
  // Otherwise, remove them completely
  if (room.status === 'playing') {
    room.players[playerIndex].isConnected = false;
    
    // If it was their turn, move to next player
    if (room.players[playerIndex].isCurrentTurn) {
      room = nextTurn(room);
    }
  } else {
    room.players.splice(playerIndex, 1);
  }
  
  // If no players left, delete the room
  if (room.players.length === 0 || room.players.every(p => !p.isConnected)) {
    localStorage.removeItem(ROOM_STORAGE_KEY + '-' + room.id);
    return { ...room, players: [] };
  }
  
  saveRoom(room);
  return room;
}

export function getActiveRooms(): GameRoom[] {
  const rooms: GameRoom[] = [];
  
  // Find all room keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ROOM_STORAGE_KEY + '-')) {
      try {
        const room = JSON.parse(localStorage.getItem(key) || '');
        // Only include rooms that are waiting or recently created (last 24 hours)
        if (room && (room.status === 'waiting' || Date.now() - room.created < 24 * 60 * 60 * 1000)) {
          rooms.push(room);
        }
      } catch (e) {
        // Skip invalid room data
      }
    }
  }
  
  // Sort by creation time, newest first
  return rooms.sort((a, b) => b.created - a.created);
}

// Check URL for a join parameter
export function checkForJoinParameter(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('join');
}