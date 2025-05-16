// Room API endpoints for server integration
import { GameRoom, Player } from './roomManager';
import { PasskeyServer } from './server';

// Types for API requests and responses
export interface CreateRoomRequest {
  hostId: string;
  hostName: string;
  walletAddress: string;
  roomName: string;
  maxPlayers?: number;
  shotsPerPlayer?: number;
  rewardAmount?: number;
}

export interface JoinRoomRequest {
  roomId: string;
  playerId: string;
  playerName: string;
  walletAddress: string;
}

export interface LeaveRoomRequest {
  roomId: string;
  playerId: string;
}

export interface UpdatePlayerRequest {
  roomId: string;
  player: Player;
}

export interface UpdateScoreRequest {
  roomId: string;
  playerId: string;
  score: number;
}

export interface UpdateRoomRequest {
  roomId: string;
  updates: Partial<GameRoom>;
}

export interface StartGameRequest {
  roomId: string;
}

export interface NextTurnRequest {
  roomId: string;
}

export interface ResetGameRequest {
  roomId: string;
}

export interface RoomAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Room API middleware class to handle room operations via HTTP endpoints
 */
export class RoomAPI {
  private server: PasskeyServer;

  constructor(server: PasskeyServer) {
    this.server = server;
  }

  /**
   * Register API routes with an Express-like server
   */
  public registerRoutes(app: any): void {
    // Get all active rooms
    app.get('/api/rooms', (req: any, res: any) => {
      try {
        const rooms = this.server.getActiveRooms();
        res.json({ success: true, data: rooms });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get a specific room
    app.get('/api/rooms/:roomId', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        const room = this.server.getRoom(roomId);
        
        if (!room) {
          return res.status(404).json({
            success: false,
            error: 'Room not found'
          });
        }
        
        res.json({ success: true, data: room });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Create a new room
    app.post('/api/rooms', (req: any, res: any) => {
      try {
        const { hostId, hostName, walletAddress, roomName, maxPlayers, shotsPerPlayer, rewardAmount } = req.body as CreateRoomRequest;
        
        // Validate required fields
        if (!hostId || !hostName || !walletAddress || !roomName) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields'
          });
        }
        
        const room = this.server.createRoom(
          hostId,
          hostName,
          walletAddress,
          roomName,
          maxPlayers,
          shotsPerPlayer,
          rewardAmount
        );
        
        res.status(201).json({ success: true, data: room });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Join a room
    app.post('/api/rooms/:roomId/join', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        const { playerId, playerName, walletAddress } = req.body as JoinRoomRequest;
        
        // Validate required fields
        if (!playerId || !playerName || !walletAddress) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields'
          });
        }
        
        const room = this.server.getRoom(roomId);
        if (!room) {
          return res.status(404).json({
            success: false,
            error: 'Room not found'
          });
        }
        
        // Create player object
        const player: Player = {
          id: playerId,
          name: playerName,
          walletAddress,
          score: 0,
          shotsRemaining: room.shotsPerPlayer,
          isConnected: true,
          isCurrentTurn: false
        };
        
        const success = this.server.addPlayerToRoom(roomId, player);
        if (!success) {
          return res.status(400).json({
            success: false,
            error: 'Failed to join room'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Leave a room
    app.post('/api/rooms/:roomId/leave', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        const { playerId } = req.body as LeaveRoomRequest;
        
        // Validate required fields
        if (!playerId) {
          return res.status(400).json({
            success: false,
            error: 'Missing player ID'
          });
        }
        
        const success = this.server.removePlayerFromRoom(roomId, playerId);
        if (!success) {
          return res.status(404).json({
            success: false,
            error: 'Room or player not found'
          });
        }
        
        // Get updated room if it still exists
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Update player in a room
    app.put('/api/rooms/:roomId/players/:playerId', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        const { player } = req.body as UpdatePlayerRequest;
        
        // Validate required fields
        if (!player || !player.id) {
          return res.status(400).json({
            success: false,
            error: 'Invalid player data'
          });
        }
        
        const success = this.server.updatePlayerInRoom(roomId, player);
        if (!success) {
          return res.status(404).json({
            success: false,
            error: 'Room or player not found'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Update player score
    app.post('/api/rooms/:roomId/score', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        const { playerId, score } = req.body as UpdateScoreRequest;
        
        // Validate required fields
        if (!playerId || score === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields'
          });
        }
        
        const success = this.server.updatePlayerScore(roomId, playerId, score);
        if (!success) {
          return res.status(404).json({
            success: false,
            error: 'Failed to update score'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Update room
    app.put('/api/rooms/:roomId', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        const { updates } = req.body as UpdateRoomRequest;
        
        // Validate required fields
        if (!updates) {
          return res.status(400).json({
            success: false,
            error: 'Missing room updates'
          });
        }
        
        const success = this.server.updateRoom(roomId, updates);
        if (!success) {
          return res.status(404).json({
            success: false,
            error: 'Room not found'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Start game
    app.post('/api/rooms/:roomId/start', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        
        const success = this.server.startGame(roomId);
        if (!success) {
          return res.status(400).json({
            success: false,
            error: 'Failed to start game'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Next turn
    app.post('/api/rooms/:roomId/next-turn', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        
        const success = this.server.nextTurn(roomId);
        if (!success) {
          return res.status(400).json({
            success: false,
            error: 'Failed to advance turn'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Reset game
    app.post('/api/rooms/:roomId/reset', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        
        const success = this.server.resetGame(roomId);
        if (!success) {
          return res.status(400).json({
            success: false,
            error: 'Failed to reset game'
          });
        }
        
        // Get updated room
        const updatedRoom = this.server.getRoom(roomId);
        res.json({ success: true, data: updatedRoom });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get winner
    app.get('/api/rooms/:roomId/winner', (req: any, res: any) => {
      try {
        const { roomId } = req.params;
        
        const winner = this.server.getWinner(roomId);
        res.json({ success: true, data: winner });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
}

// Export a factory function to create RoomAPI instances
export function createRoomAPI(server: PasskeyServer): RoomAPI {
  return new RoomAPI(server);
}