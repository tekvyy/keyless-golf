// Client-side store for handling room participants using server communication
import { writable, derived, get } from 'svelte/store';
import type { GameRoom, Player } from './gameTypes';
import { server } from './common';

// Constants
const API_URL = '/api';
const POLLING_INTERVAL = 5000; // 5 seconds
const USE_FALLBACK_STORAGE = true; // Temporary flag until API endpoints are available

// Main store that will hold all rooms
export const rooms = writable<Map<string, GameRoom>>(new Map());

// Initialize with sample data for development
if (USE_FALLBACK_STORAGE && typeof window !== 'undefined') {
  const sampleRoom1: GameRoom = {
    id: 'SAMPLE1',
    name: 'Test Room 1',
    hostId: 'host1',
    players: [{
      id: 'host1',
      name: 'Test Host',
      walletAddress: 'GA2HGBJIJKI7O2CT5ZOGBHDHA5DSCGPGWXRBWIVQIH3FKSGYZ3FBNTT3',
      score: 0,
      shotsRemaining: 3,
      isConnected: true,
      isCurrentTurn: true,
    }],
    maxPlayers: 4,
    status: 'waiting',
    currentPlayerIndex: 0,
    shotsPerPlayer: 3,
    rewardAmount: 10_000_000,
    created: Date.now(),
  };
  
  const sampleRoom2: GameRoom = {
    id: 'SAMPLE2',
    name: 'Test Room 2',
    hostId: 'host2',
    players: [{
      id: 'host2',
      name: 'Player Host',
      walletAddress: 'GB3SFCCFHNKLCOUQEWOTKTYSDAEDAN24KPENRBCAE7XL7JQB5K4EDZ6M',
      score: 0,
      shotsRemaining: 3,
      isConnected: true,
      isCurrentTurn: true,
    }],
    maxPlayers: 4,
    status: 'waiting',
    currentPlayerIndex: 0,
    shotsPerPlayer: 3,
    rewardAmount: 10_000_000,
    created: Date.now() - 1000,
  };
  
  // Add sample rooms to store
  rooms.update(roomsMap => {
    roomsMap.set(sampleRoom1.id, sampleRoom1);
    roomsMap.set(sampleRoom2.id, sampleRoom2);
    return roomsMap;
  });
}

// Polling timer for room updates
let pollingTimer: number | null = null;

// Create a derived store for a specific room by ID
export function createRoomStore(roomId: string) {
  return derived(rooms, $rooms => $rooms.get(roomId) || null);
}

// Helper function to get a specific room
export function getRoom(roomId: string): GameRoom | null {
  if (USE_FALLBACK_STORAGE) {
    // Use local store as fallback
    let foundRoom: GameRoom | null = null;
    rooms.update(roomsMap => {
      foundRoom = roomsMap.get(roomId) || null;
      return roomsMap;
    });
    return foundRoom;
  }
  
  try {
    // For synchronous version, just get from the store
    const roomsMap = get(rooms);
    const foundRoom = roomsMap.get(roomId) || null;
    
    // Start an async fetch to update the store, but don't wait for it
    fetchRoom(roomId);
    
    return foundRoom;
  } catch (e) {
    console.error('Error getting room:', e);
    
    // Fall back to local store if there's an error
    let foundRoom: GameRoom | null = null;
    rooms.update(roomsMap => {
      foundRoom = roomsMap.get(roomId) || null;
      return roomsMap;
    });
    return foundRoom;
  }
}

// Async function to fetch a room from server
async function fetchRoom(roomId: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch room');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error fetching room:', error);
      return;
    }
    
    // Update store with fetched room
    if (data && data.players && Array.isArray(data.players)) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
    }
  } catch (e) {
    console.error('Error fetching room:', e);
  }
}

// Get all active rooms
export function getActiveRooms(): GameRoom[] {
  if (USE_FALLBACK_STORAGE) {
    // Use local store as fallback
    let activeRooms: GameRoom[] = [];
    rooms.update(roomsMap => {
      activeRooms = Array.from(roomsMap.values())
        .filter(room => room.status === 'waiting' || Date.now() - room.created < 24 * 60 * 60 * 1000)
        .sort((a, b) => b.created - a.created);
      return roomsMap;
    });
    return activeRooms;
  }
  
  try {
    // Fetch rooms from server - since we're in a synchronous function
    // we'll just return what's in the store for now and let polling update it later
    const currentRooms = get(rooms);
    const activeRooms = Array.from(currentRooms.values())
      .filter(room => room.status === 'waiting' || Date.now() - room.created < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.created - a.created);
    
    // Start an async fetch to update the store, but don't wait for it
    fetchActiveRooms();
    
    return activeRooms;
  } catch (e) {
    console.error('Error getting active rooms:', e);
    
    // Fall back to local store if there's an error
    let activeRooms: GameRoom[] = [];
    rooms.update(roomsMap => {
      activeRooms = Array.from(roomsMap.values())
        .filter(room => room.status === 'waiting' || Date.now() - room.created < 24 * 60 * 60 * 1000)
        .sort((a, b) => b.created - a.created);
      return roomsMap;
    });
    return activeRooms;
  }
}

// Async function to fetch active rooms from server
async function fetchActiveRooms(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/rooms`);
    if (!response.ok) {
      throw new Error('Failed to fetch rooms');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error fetching rooms:', error);
      return;
    }
    
    // Update store with fetched rooms
    if (data && Array.isArray(data)) {
      const roomsMap = new Map<string, GameRoom>();
      data.forEach((room: GameRoom) => {
        roomsMap.set(room.id, room);
      });
      rooms.set(roomsMap);
    }
  } catch (e) {
    console.error('Error fetching active rooms:', e);
  }
}

// Save or update a room
export async function saveRoom(room: GameRoom): Promise<boolean> {
  if (USE_FALLBACK_STORAGE) {
    // Update local storage directly
    rooms.update(roomsMap => {
      roomsMap.set(room.id, {...room});
      return roomsMap;
    });
    
    // Also save to localStorage for persistence
    try {
      const ROOM_STORAGE_KEY = 'passkey-golf-room-data';
      const roomsObject: Record<string, GameRoom> = {};
      
      // Get current rooms and add the new/updated one
      const currentRooms = get(rooms);
      currentRooms.forEach((r, id) => {
        roomsObject[id] = r;
      });
      
      // Store to localStorage
      localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomsObject));
      
      // Update last updated timestamp
      const timestamp = Date.now();
      localStorage.setItem('passkey-golf-rooms-last-updated', timestamp.toString());
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
    
    return true;
  }
  
  try {
    // Check if room exists
    const existingRoom = await getRoom(room.id);
    
    if (existingRoom) {
      // Update existing room
      return updateRoom(room.id, room);
    } else {
      // Create new room
      const response = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostId: room.hostId,
          hostName: room.players.find(p => p.id === room.hostId)?.name || '',
          walletAddress: room.players.find(p => p.id === room.hostId)?.walletAddress || '',
          roomName: room.name,
          maxPlayers: room.maxPlayers,
          shotsPerPlayer: room.shotsPerPlayer,
          rewardAmount: room.rewardAmount
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save room');
      }
      
      const { success, data, error } = await response.json();
      
      if (!success) {
        console.error('Error saving room:', error);
        return false;
      }
      
      // Update store with created room
      if (data) {
        rooms.update(roomsMap => {
          roomsMap.set(data.id, data);
          return roomsMap;
        });
      }
      
      return true;
    }
  } catch (e) {
    console.error('Error saving room:', e);
    
    // Update local store as fallback
    rooms.update(roomsMap => {
      roomsMap.set(room.id, {...room});
      return roomsMap;
    });
    
    return false;
  }
}

// Remove a room
export async function removeRoom(roomId: string): Promise<boolean> {
  try {
    // Get all players in room
    const room = await getRoom(roomId);
    if (!room) return false;
    
    // Remove all players to trigger room removal on server
    for (const player of room.players) {
      await removePlayerFromRoom(roomId, player.id);
    }
    
    // Update local store
    rooms.update(roomsMap => {
      roomsMap.delete(roomId);
      return roomsMap;
    });
    
    return true;
  } catch (e) {
    console.error('Error removing room:', e);
    
    // Update local store as fallback
    rooms.update(roomsMap => {
      roomsMap.delete(roomId);
      return roomsMap;
    });
    
    return false;
  }
}

// Check if a room exists
export async function roomExists(roomId: string): Promise<boolean> {
  const room = await getRoom(roomId);
  return !!room;
}

// Create a new room
export async function createRoom(room: GameRoom): Promise<boolean> {
  return saveRoom(room);
}

// Add a player to a room
export function addPlayerToRoom(roomId: string, player: Player): boolean {
  if (USE_FALLBACK_STORAGE) {
    // Update local store directly for fallback mode
    let success = false;
    
    rooms.update(roomsMap => {
      const room = roomsMap.get(roomId);
      
      if (room && room.players && Array.isArray(room.players)) {
        // Validate room state
        if (room.players.length >= room.maxPlayers) {
          console.error('Room is full');
          return roomsMap;
        }
        
        if (room.status !== 'waiting') {
          console.error('Game already in progress');
          return roomsMap;
        }
        
        // Check if player already exists
        const existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
        if (existingPlayerIndex >= 0) {
          // Update existing player
          room.players[existingPlayerIndex] = {
            ...player,
            score: 0,
            shotsRemaining: room.shotsPerPlayer, 
            isConnected: true,
            isCurrentTurn: false
          };
        } else {
          // Add new player
          room.players.push({
            ...player,
            score: 0,
            shotsRemaining: room.shotsPerPlayer,
            isConnected: true,
            isCurrentTurn: false
          });
        }
        
        // Mark as last activity
        room.lastActivity = Date.now();
        
        // Save room with updated player
        roomsMap.set(roomId, {...room});
        success = true;
        
        // Also save to localStorage for persistence
        try {
          const ROOM_STORAGE_KEY = 'passkey-golf-room-data';
          const roomsObject: Record<string, GameRoom> = {};
          
          // Get current rooms and add the updated one
          roomsMap.forEach((r, id) => {
            roomsObject[id] = r;
          });
          
          // Store to localStorage
          localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomsObject));
          
          // Update last updated timestamp
          const timestamp = Date.now();
          localStorage.setItem('passkey-golf-rooms-last-updated', timestamp.toString());
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }
      }
      
      return roomsMap;
    });
    
    return success;
  }
  
  try {
    // For non-fallback mode, start async API call but return immediate success
    // to keep UI responsive (we'll get the room update later via polling)
    fetchAddPlayerToRoom(roomId, player);
    
    // Return optimistic success - the actual API result will update via polling
    return true;
  } catch (e) {
    console.error('Error adding player to room:', e);
    return false;
  }
}

// Async function for API call to add player
async function fetchAddPlayerToRoom(roomId: string, player: Player): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playerId: player.id,
        playerName: player.name,
        walletAddress: player.walletAddress
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to add player to room');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error adding player to room:', error);
      return;
    }
    
    // Update store with updated room
    if (data && data.players && Array.isArray(data.players)) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
    }
  } catch (e) {
    console.error('Error in API call to add player to room:', e);
  }
}

// Remove a player from a room
export async function removePlayerFromRoom(roomId: string, playerId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playerId
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove player from room');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error removing player from room:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    } else {
      // Room was deleted on server
      rooms.update(roomsMap => {
        roomsMap.delete(roomId);
        return roomsMap;
      });
      return true;
    }
  } catch (e) {
    console.error('Error removing player from room:', e);
    
    // Update local store as fallback
    rooms.update(roomsMap => {
      const room = roomsMap.get(roomId);
      if (room) {
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        
        if (playerIndex !== -1) {
          // If game is in progress, mark player as disconnected
          // Otherwise, remove them completely
          if (room.status === 'playing') {
            room.players[playerIndex].isConnected = false;
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
    
    return false;
  }
}

// Update a player in a room
export async function updatePlayerInRoom(roomId: string, updatedPlayer: Player): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/players/${updatedPlayer.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        player: updatedPlayer
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update player in room');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error updating player in room:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error updating player in room:', e);
    
    // Update local store as fallback
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
}

// Update multiple properties of a room atomically
export async function updateRoom(roomId: string, updates: Partial<GameRoom>): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        updates
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update room');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error updating room:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error updating room:', e);
    
    // Update local store as fallback
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
}

// Start a game in a room
export async function startGame(roomId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to start game');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error starting game:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error starting game:', e);
    return false;
  }
}

// Advance to next turn
export async function nextTurn(roomId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/next-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to advance turn');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error advancing turn:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error advancing turn:', e);
    return false;
  }
}

// Update player score
export async function updatePlayerScore(roomId: string, playerId: string, score: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playerId,
        score
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update score');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error updating score:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error updating score:', e);
    return false;
  }
}

// Reset game
export async function resetGame(roomId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset game');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error resetting game:', error);
      return false;
    }
    
    // Update store with updated room
    if (data) {
      rooms.update(roomsMap => {
        roomsMap.set(roomId, data);
        return roomsMap;
      });
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error resetting game:', e);
    return false;
  }
}

// Get all players in a room
export async function getPlayersInRoom(roomId: string): Promise<Player[]> {
  const room = await getRoom(roomId);
  return room ? [...room.players] : [];
}

// Count connected players in a room
export async function getConnectedPlayerCount(roomId: string): Promise<number> {
  const room = await getRoom(roomId);
  return room ? room.players.filter(p => p.isConnected).length : 0;
}

// Get winner of a game
export async function getWinner(roomId: string): Promise<Player | null> {
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/winner`);
    
    if (!response.ok) {
      throw new Error('Failed to get winner');
    }
    
    const { success, data, error } = await response.json();
    
    if (!success) {
      console.error('Error getting winner:', error);
      return null;
    }
    
    return data || null;
  } catch (e) {
    console.error('Error getting winner:', e);
    return null;
  }
}

// Initialize from localStorage (for fallback mode)
export function initializeFromLocalStorage(): void {
  if (USE_FALLBACK_STORAGE) {
    try {
      const ROOM_STORAGE_KEY = 'passkey-golf-room-data';
      const roomsData = localStorage.getItem(ROOM_STORAGE_KEY);
      
      if (roomsData) {
        const roomsObject = JSON.parse(roomsData) as Record<string, GameRoom>;
        const roomsMap = new Map<string, GameRoom>();
        
        // Convert object back to Map
        Object.entries(roomsObject).forEach(([id, room]) => {
          roomsMap.set(id, room);
        });
        
        // Update our store
        rooms.set(roomsMap);
      }
      
      // Set up storage event listener to detect changes from other tabs
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (event) => {
          if (event.key === 'passkey-golf-rooms-last-updated') {
            // Reload data from localStorage when it changes in other tabs
            const refreshData = localStorage.getItem(ROOM_STORAGE_KEY);
            if (refreshData) {
              try {
                const refreshRooms = JSON.parse(refreshData) as Record<string, GameRoom>;
                const refreshMap = new Map<string, GameRoom>();
                
                Object.entries(refreshRooms).forEach(([id, room]) => {
                  refreshMap.set(id, room);
                });
                
                rooms.set(refreshMap);
              } catch (e) {
                console.error('Error parsing refreshed room data:', e);
              }
            }
          }
        });
      }
    } catch (e) {
      console.error('Error initializing from localStorage:', e);
    }
  }
}

// Initialize room polling
export function initializeRoomPolling(): void {
  // Initialize from localStorage for fallback mode
  initializeFromLocalStorage();
  
  // Only set up polling if we're using the server API
  if (!USE_FALLBACK_STORAGE) {
    // Stop any existing polling
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }
    
    // Start polling for room updates
    const pollRooms = async () => {
      try {
        // Get current rooms from store
        const currentRooms = get(rooms);
        
        // Get all room IDs to refresh
        const roomIds = Array.from(currentRooms.keys());
        
        // Refresh each room
        for (const roomId of roomIds) {
          await getRoom(roomId);
        }
        
        // Also refresh active rooms list periodically
        await getActiveRooms();
      } catch (e) {
        console.error('Error polling rooms:', e);
      }
    };
    
    // Start polling timer
    pollingTimer = window.setInterval(pollRooms, POLLING_INTERVAL);
    
    // Initial poll
    pollRooms();
  }
}

// Cleanup when unmounting
export function cleanupRoomPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}