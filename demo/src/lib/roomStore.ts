// In-memory store for handling room participants
import { writable, derived, get } from 'svelte/store';
import type { GameRoom, Player } from './gameTypes';

// Main store that will hold all rooms
export const rooms = writable<Map<string, GameRoom>>(new Map());

// Create a derived store for a specific room by ID
export function createRoomStore(roomId: string) {
  return derived(rooms, $rooms => $rooms.get(roomId) || null);
}

// Helper function to get a specific room
export function getRoom(roomId: string): GameRoom | null {
  let foundRoom: GameRoom | null = null;
  rooms.update(roomsMap => {
    foundRoom = roomsMap.get(roomId) || null;
    return roomsMap;
  });
  return foundRoom;
}

// Get all active rooms
export function getActiveRooms(): GameRoom[] {
  let activeRooms: GameRoom[] = [];
  rooms.update(roomsMap => {
    activeRooms = Array.from(roomsMap.values())
      .filter(room => room.status === 'waiting' || Date.now() - room.created < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.created - a.created);
    return roomsMap;
  });
  return activeRooms;
}

// Save or update a room
export function saveRoom(room: GameRoom): void {
  rooms.update(roomsMap => {
    roomsMap.set(room.id, {...room});
    return roomsMap;
  });
}

// Remove a room
export function removeRoom(roomId: string): void {
  rooms.update(roomsMap => {
    roomsMap.delete(roomId);
    return roomsMap;
  });
}

// Check if a room exists
export function roomExists(roomId: string): boolean {
  let exists = false;
  rooms.update(roomsMap => {
    exists = roomsMap.has(roomId);
    return roomsMap;
  });
  return exists;
}

// Create a new room
export function createRoom(room: GameRoom): void {
  saveRoom(room);
}

// Add a player to a room
export function addPlayerToRoom(roomId: string, player: Player): boolean {
  let success = false;
  rooms.update(roomsMap => {
    const room = roomsMap.get(roomId);
    if (room) {
      // Check if player already exists
      const existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
      if (existingPlayerIndex >= 0) {
        // Update existing player
        room.players[existingPlayerIndex] = {...player, isConnected: true};
      } else {
        // Add new player
        room.players.push({...player, isConnected: true});
      }
      roomsMap.set(roomId, room);
      success = true;
    }
    return roomsMap;
  });
  return success;
}

// Remove a player from a room
export function removePlayerFromRoom(roomId: string, playerId: string): void {
  rooms.update(roomsMap => {
    const room = roomsMap.get(roomId);
    if (room) {
      const playerIndex = room.players.findIndex(p => p.id === playerId);
      
      if (playerIndex !== -1) {
        // If game is in progress, mark player as disconnected
        // Otherwise, remove them completely
        if (room.status === 'playing') {
          room.players[playerIndex].isConnected = false;
          
          // If it was their turn, we would handle that elsewhere
        } else {
          room.players.splice(playerIndex, 1);
        }
        
        // If no players left, delete the room
        if (room.players.length === 0 || room.players.every(p => !p.isConnected)) {
          roomsMap.delete(roomId);
        } else {
          // If the host leaves, assign a new host
          if (playerId === room.hostId && room.players.length > 0) {
            for (const player of room.players) {
              if (player.id !== playerId && player.isConnected) {
                room.hostId = player.id;
                break;
              }
            }
          }
          
          roomsMap.set(roomId, room);
        }
      }
    }
    return roomsMap;
  });
}

// Update a player in a room
export function updatePlayerInRoom(roomId: string, updatedPlayer: Player): boolean {
  let success = false;
  rooms.update(roomsMap => {
    const room = roomsMap.get(roomId);
    if (room) {
      const playerIndex = room.players.findIndex(p => p.id === updatedPlayer.id);
      if (playerIndex !== -1) {
        room.players[playerIndex] = {...updatedPlayer};
        roomsMap.set(roomId, room);
        success = true;
      }
    }
    return roomsMap;
  });
  return success;
}

// Update multiple properties of a room atomically
export function updateRoom(roomId: string, updates: Partial<GameRoom>): boolean {
  let success = false;
  rooms.update(roomsMap => {
    const room = roomsMap.get(roomId);
    if (room) {
      const updatedRoom = {...room, ...updates};
      roomsMap.set(roomId, updatedRoom);
      success = true;
    }
    return roomsMap;
  });
  return success;
}

// Get all players in a room
export function getPlayersInRoom(roomId: string): Player[] {
  const room = getRoom(roomId);
  return room ? [...room.players] : [];
}

// Count connected players in a room
export function getConnectedPlayerCount(roomId: string): number {
  const room = getRoom(roomId);
  return room ? room.players.filter(p => p.isConnected).length : 0;
}

// Initialize store from localStorage if needed
export function initializeFromLocalStorage(): void {
  // This can be used to hydrate the store from localStorage if needed for persistence
  const roomsMap = new Map<string, GameRoom>();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('passkey-golf-room-')) {
      try {
        const roomData = localStorage.getItem(key);
        if (roomData) {
          const room = JSON.parse(roomData) as GameRoom;
          roomsMap.set(room.id, room);
        }
      } catch (e) {
        console.error('Error parsing room data from localStorage:', e);
      }
    }
  }
  
  rooms.set(roomsMap);
}