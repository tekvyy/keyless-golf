// Interface for room management - bridges between client and server
import type { GameRoom, Player } from './gameTypes';
import * as roomStore from './roomStore';

// Constants for client-side
export const LOCAL_PLAYER_ID_KEY = 'passkey-golf-player-id';

// Initialize room polling when module is imported
roomStore.initializeRoomPolling();

// Helper functions for room management
export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 12);
}

// Room management functions
export async function saveRoom(room: GameRoom): Promise<void> {
  await roomStore.saveRoom(room);
}

export function getRoom(roomId: string): GameRoom | null {
  const room = roomStore.getRoom(roomId);
  // Verify room data is valid
  if (room && (!room.players || !Array.isArray(room.players))) {
    console.error('Invalid room data - missing players array');
    return null;
  }
  return room;
}

export function createNewRoom(
  hostId: string,
  hostName: string,
  walletAddress: string,
  roomName: string
): GameRoom {
  // Create room object
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
  
  // Save room to server (don't wait for the async operation)
  roomStore.saveRoom(room);
  
  // Directly return the room we just created
  // This ensures the component gets valid data right away
  return room;
}

export function joinRoom(room: GameRoom, playerId: string, playerName: string, walletAddress: string): GameRoom {
  // Validate room data
  if (!room || !room.players || !Array.isArray(room.players)) {
    throw new Error('Invalid room data');
  }
  
  // Input validation
  if (room.players.length >= room.maxPlayers) {
    throw new Error('Room is full');
  }
  
  if (room.status !== 'waiting') {
    throw new Error('Game already in progress');
  }
  
  // Create player object
  const player: Player = {
    id: playerId,
    name: playerName,
    walletAddress,
    score: 0,
    shotsRemaining: room.shotsPerPlayer,
    isConnected: true,
    isCurrentTurn: false,
  };
  
  // Add player to room on server (now synchronous)
  const success = roomStore.addPlayerToRoom(room.id, player);
  
  if (!success) {
    throw new Error('Failed to join room');
  }
  
  // Get updated room from store (now synchronous)
  const updatedRoom = roomStore.getRoom(room.id);
  
  if (!updatedRoom) {
    throw new Error('Failed to get updated room');
  }
  
  return updatedRoom;
}

export async function leaveRoom(room: GameRoom, playerId: string): Promise<GameRoom> {
  // Remove player from room on server
  const success = await roomStore.removePlayerFromRoom(room.id, playerId);
  
  if (!success) {
    throw new Error('Failed to leave room');
  }
  
  // Get updated room from server (if it still exists)
  const updatedRoom = await roomStore.getRoom(room.id);
  
  // If room was deleted, return empty room
  return updatedRoom || { ...room, players: [] };
}

export function getActiveRooms(): GameRoom[] {
  return roomStore.getActiveRooms();
}

export async function nextTurn(room: GameRoom): Promise<GameRoom> {
  // Advance to next turn on server
  const success = await roomStore.nextTurn(room.id);
  
  if (!success) {
    throw new Error('Failed to advance turn');
  }
  
  // Get updated room from server
  const updatedRoom = await roomStore.getRoom(room.id);
  
  if (!updatedRoom) {
    throw new Error('Failed to get updated room');
  }
  
  return updatedRoom;
}

export async function startGame(room: GameRoom): Promise<GameRoom> {
  // Input validation
  if (room.players.length < 2) {
    throw new Error('Need at least 2 players to start');
  }
  
  // Start game on server
  const success = await roomStore.startGame(room.id);
  
  if (!success) {
    throw new Error('Failed to start game');
  }
  
  // Get updated room from server
  const updatedRoom = await roomStore.getRoom(room.id);
  
  if (!updatedRoom) {
    throw new Error('Failed to get updated room');
  }
  
  return updatedRoom;
}

export async function getWinner(room: GameRoom): Promise<Player | null> {
  if (room.status !== 'completed') {
    return null;
  }
  
  return roomStore.getWinner(room.id);
}

export async function updatePlayerScore(
  room: GameRoom, 
  playerId: string, 
  score: number
): Promise<GameRoom> {
  // Input validation
  const player = room.players.find(p => p.id === playerId);
  
  if (!player) {
    throw new Error('Player not found');
  }
  
  if (!player.isCurrentTurn) {
    throw new Error('Not player\'s turn');
  }
  
  // Update score on server
  const success = await roomStore.updatePlayerScore(room.id, playerId, score);
  
  if (!success) {
    throw new Error('Failed to update score');
  }
  
  // Get updated room from server
  const updatedRoom = await roomStore.getRoom(room.id);
  
  if (!updatedRoom) {
    throw new Error('Failed to get updated room');
  }
  
  return updatedRoom;
}

export async function resetPlayerScore(room: GameRoom): Promise<GameRoom> {
  // Reset game on server
  const success = await roomStore.resetGame(room.id);
  
  if (!success) {
    throw new Error('Failed to reset game');
  }
  
  // Get updated room from server
  const updatedRoom = await roomStore.getRoom(room.id);
  
  if (!updatedRoom) {
    throw new Error('Failed to get updated room');
  }
  
  return updatedRoom;
}

// URL parameter helper
export function checkForJoinParameter(): string | null {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('join');
  }
  return null;
}

// Cleanup room polling when user navigates away
window.addEventListener('beforeunload', () => {
  roomStore.cleanupRoomPolling();
});