// Server-side in-memory room store for passkey-kit multiplayer games
// Define a simple EventEmitter class for browser compatibility
class EventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach(listener => listener(...args));
    return true;
  }

  removeAllListeners(): this {
    this.events = {};
    return this;
  }
}

// Define types matching the client types
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
  lastActivity: number; // timestamp for auto-cleanup
}

// Singleton room manager for the server
export class RoomManager extends EventEmitter {
  // Store rooms in memory with Map for fast lookups
  private rooms: Map<string, GameRoom> = new Map();
  
  // Cleanup interval in ms (default: 1 hour)
  private cleanupInterval: number = 60 * 60 * 1000;
  private cleanupTimer: NodeJS.Timeout;
  
  // Singleton instance
  private static instance: RoomManager;
  
  /**
   * Get the singleton instance of the RoomManager
   */
  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }
  
  private constructor() {
    super();
    // Set up auto-cleanup for inactive rooms
    this.cleanupTimer = setInterval(() => this.cleanupInactiveRooms(), this.cleanupInterval);
  }
  
  /**
   * Clean up rooms that have been inactive for more than 24 hours
   */
  private cleanupInactiveRooms(): void {
    const now = Date.now();
    const maxInactiveTime = 24 * 60 * 60 * 1000; // 24 hours
    
    this.rooms.forEach((room, roomId) => {
      // Check if the room has been inactive for too long
      if (now - room.lastActivity > maxInactiveTime) {
        this.removeRoom(roomId);
      }
    });
  }
  
  /**
   * Generate a unique room ID
   */
  public generateRoomId(): string {
    // Generate a random alphanumeric room ID
    let roomId: string;
    do {
      roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    } while (this.rooms.has(roomId));
    
    return roomId;
  }
  
  /**
   * Create a new game room
   */
  public createRoom(
    hostId: string,
    hostName: string,
    walletAddress: string,
    roomName: string,
    maxPlayers: number = 4,
    shotsPerPlayer: number = 3,
    rewardAmount: number = 10_000_000 // 1 XLM
  ): GameRoom {
    const roomId = this.generateRoomId();
    
    const room: GameRoom = {
      id: roomId,
      name: roomName,
      hostId: hostId,
      players: [{
        id: hostId,
        name: hostName,
        walletAddress,
        score: 0,
        shotsRemaining: shotsPerPlayer,
        isConnected: true,
        isCurrentTurn: true,
      }],
      maxPlayers,
      status: 'waiting',
      currentPlayerIndex: 0,
      shotsPerPlayer,
      rewardAmount,
      created: Date.now(),
      lastActivity: Date.now(),
    };
    
    // Store the new room
    this.rooms.set(roomId, room);
    
    // Emit room created event
    this.emit('roomCreated', room);
    
    return room;
  }
  
  /**
   * Get a room by ID
   */
  public getRoom(roomId: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (room) {
      // Update last activity timestamp
      room.lastActivity = Date.now();
      this.rooms.set(roomId, room);
    }
    return room || null;
  }
  
  /**
   * Get all active rooms (waiting or playing)
   */
  public getActiveRooms(): GameRoom[] {
    const now = Date.now();
    const maxInactiveTime = 24 * 60 * 60 * 1000; // 24 hours
    
    return Array.from(this.rooms.values())
      .filter(room => 
        room.status === 'waiting' || 
        (room.status === 'playing' && now - room.lastActivity < maxInactiveTime)
      )
      .sort((a, b) => b.created - a.created); // newest first
  }
  
  /**
   * Add a player to a room
   */
  public addPlayerToRoom(roomId: string, player: Player): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    // Check if the room is full
    if (room.players.length >= room.maxPlayers) {
      return false;
    }
    
    // Check if the room is not in waiting status
    if (room.status !== 'waiting') {
      return false;
    }
    
    // Check if player is already in the room
    const existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
    if (existingPlayerIndex >= 0) {
      // Update existing player (reconnection)
      room.players[existingPlayerIndex] = { 
        ...player, 
        shotsRemaining: room.shotsPerPlayer,
        isConnected: true 
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
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    // Emit player joined event
    this.emit('playerJoined', { roomId, player });
    
    return true;
  }
  
  /**
   * Remove a player from a room
   */
  public removePlayerFromRoom(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;
    
    // If game is in progress, mark player as disconnected
    // Otherwise, remove them completely
    if (room.status === 'playing') {
      room.players[playerIndex].isConnected = false;
      
      // If it was their turn, advance to the next player
      if (room.players[playerIndex].isCurrentTurn) {
        this.nextTurn(roomId);
      }
    } else {
      // Remove player from array
      room.players.splice(playerIndex, 1);
    }
    
    // If no players left or all disconnected, remove the room
    if (room.players.length === 0 || room.players.every(p => !p.isConnected)) {
      this.removeRoom(roomId);
      return true;
    }
    
    // If the host left, assign a new host
    if (playerId === room.hostId && room.players.length > 0) {
      // Find first connected player
      for (const player of room.players) {
        if (player.isConnected) {
          room.hostId = player.id;
          break;
        }
      }
    }
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    // Emit player left event
    this.emit('playerLeft', { roomId, playerId });
    
    return true;
  }
  
  /**
   * Update a player in a room
   */
  public updatePlayerInRoom(roomId: string, updatedPlayer: Player): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    const playerIndex = room.players.findIndex(p => p.id === updatedPlayer.id);
    if (playerIndex === -1) return false;
    
    // Update player
    room.players[playerIndex] = { ...updatedPlayer };
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    // Emit player updated event
    this.emit('playerUpdated', { roomId, player: updatedPlayer });
    
    return true;
  }
  
  /**
   * Update a room with partial data
   */
  public updateRoom(roomId: string, updates: Partial<GameRoom>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    // Apply updates
    const updatedRoom = { ...room, ...updates, lastActivity: Date.now() };
    this.rooms.set(roomId, updatedRoom);
    
    // Emit room updated event
    this.emit('roomUpdated', updatedRoom);
    
    return true;
  }
  
  /**
   * Start a game in a room
   */
  public startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    if (room.players.length < 2) {
      return false; // Need at least 2 players
    }
    
    // Update room status
    room.status = 'playing';
    room.currentPlayerIndex = 0;
    
    // Set first player's turn
    for (let i = 0; i < room.players.length; i++) {
      room.players[i].isCurrentTurn = i === 0;
    }
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    // Emit game started event
    this.emit('gameStarted', room);
    
    return true;
  }
  
  /**
   * Move to the next player's turn
   */
  public nextTurn(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    if (room.status !== 'playing') return false;
    
    // Find next player with remaining shots
    let nextPlayerIndex = room.currentPlayerIndex;
    let nextPlayer: Player | undefined;
    let fullLoopCount = 0;
    
    // Keep looking for the next player with shots remaining who is connected
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
        
        // Update room
        room.lastActivity = Date.now();
        this.rooms.set(roomId, room);
        
        // Emit game completed event
        this.emit('gameCompleted', room);
        
        return true;
      }
    } while (nextPlayer.shotsRemaining <= 0 || !nextPlayer.isConnected);
    
    // Update current player
    for (const player of room.players) {
      player.isCurrentTurn = false;
    }
    
    nextPlayer.isCurrentTurn = true;
    room.currentPlayerIndex = nextPlayerIndex;
    
    // Check if all shots have been used
    const allShotsUsed = room.players.every(p => p.shotsRemaining <= 0 || !p.isConnected);
    if (allShotsUsed) {
      room.status = 'completed';
      
      // Emit game completed event
      this.emit('gameCompleted', room);
    } else {
      // Emit turn changed event
      this.emit('turnChanged', { roomId, playerId: nextPlayer.id });
    }
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    return true;
  }
  
  /**
   * Update a player's score
   */
  public updatePlayerScore(roomId: string, playerId: string, score: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;
    
    if (!player.isCurrentTurn) return false;
    
    // Update player's score and shots remaining
    player.score += score;
    player.shotsRemaining--;
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    // Emit score updated event
    this.emit('scoreUpdated', { roomId, playerId, newScore: player.score });
    
    return true;
  }
  
  /**
   * Reset a game to start a new round
   */
  public resetGame(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    // Reset all players
    for (const player of room.players) {
      player.score = 0;
      player.shotsRemaining = room.shotsPerPlayer;
    }
    
    // Reset room status
    room.status = 'waiting';
    room.currentPlayerIndex = 0;
    room.players[0].isCurrentTurn = true;
    
    for (let i = 1; i < room.players.length; i++) {
      room.players[i].isCurrentTurn = false;
    }
    
    // Update room
    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    
    // Emit game reset event
    this.emit('gameReset', room);
    
    return true;
  }
  
  /**
   * Remove a room
   */
  public removeRoom(roomId: string): boolean {
    if (!this.rooms.has(roomId)) return false;
    
    // Get room before removal for event
    const room = this.rooms.get(roomId)!;
    
    // Remove room
    this.rooms.delete(roomId);
    
    // Emit room removed event
    this.emit('roomRemoved', room);
    
    return true;
  }
  
  /**
   * Get the winner of a completed game
   */
  public getWinner(roomId: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'completed') return null;
    
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
  
  /**
   * Cleanup when the server shuts down
   */
  public shutdown(): void {
    clearInterval(this.cleanupTimer);
    this.rooms.clear();
    this.removeAllListeners();
  }
}

// Export a singleton instance
export const roomManager = RoomManager.getInstance();