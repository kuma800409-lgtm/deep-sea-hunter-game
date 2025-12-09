const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameRoom = require('./GameRoom');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Store all active rooms
const rooms = new Map();

// Helper to find available room or create new one
function findOrCreateRoom() {
    for (const [roomId, room] of rooms) {
        if (room.canJoin()) {
            return room;
        }
    }
    // Create new room
    const roomId = uuidv4().substring(0, 8);
    const room = new GameRoom(roomId, io);
    rooms.set(roomId, room);
    return room;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Join room
    socket.on('join_room', (data) => {
        const { playerName, roomId } = data;
        let room;
        
        if (roomId && rooms.has(roomId)) {
            room = rooms.get(roomId);
            if (!room.canJoin()) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }
        } else {
            room = findOrCreateRoom();
        }
        
        const player = room.addPlayer(socket, playerName || `Player${Math.floor(Math.random() * 1000)}`);
        if (player) {
            socket.roomId = room.id;
            socket.playerId = player.id;
            socket.join(room.id);
            
            socket.emit('joined_room', {
                roomId: room.id,
                playerId: player.id,
                seat: player.seat,
                players: room.getPlayersInfo()
            });
            
            // Notify other players
            socket.to(room.id).emit('player_joined', {
                player: room.getPlayerInfo(player.id),
                players: room.getPlayersInfo()
            });
            
            console.log(`${playerName} joined room ${room.id} at seat ${player.seat}`);
        } else {
            socket.emit('error', { message: 'Could not join room' });
        }
    });
    
    // Player ready
    socket.on('ready', () => {
        const room = rooms.get(socket.roomId);
        if (room) {
            room.setPlayerReady(socket.playerId, true);
            io.to(room.id).emit('player_ready', {
                playerId: socket.playerId,
                players: room.getPlayersInfo()
            });
            
            // Check if all players are ready
            if (room.allPlayersReady() && room.players.size >= 2) {
                room.startGame();
            }
        }
    });
    
    // Host starts game
    socket.on('start_game', () => {
        const room = rooms.get(socket.roomId);
        if (room && room.isHost(socket.playerId)) {
            if (room.players.size >= 1) {
                room.startGame();
            } else {
                socket.emit('error', { message: 'Need at least 1 player to start' });
            }
        }
    });
    
    // Player shoots
    socket.on('shoot', (data) => {
        const room = rooms.get(socket.roomId);
        if (room && room.gameStarted) {
            room.handleShoot(socket.playerId, data);
        }
    });
    
    // Change bullet level
    socket.on('change_bullet', (data) => {
        const room = rooms.get(socket.roomId);
        if (room) {
            room.changeBulletLevel(socket.playerId, data.level);
        }
    });
    
    // Enable auto mode
    socket.on('enable_auto', () => {
        const room = rooms.get(socket.roomId);
        if (room && room.gameStarted) {
            room.enableAutoMode(socket.playerId);
        }
    });
    
    // Disable auto mode
    socket.on('disable_auto', () => {
        const room = rooms.get(socket.roomId);
        if (room) {
            room.disableAutoMode(socket.playerId);
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        const room = rooms.get(socket.roomId);
        if (room) {
            room.removePlayer(socket.playerId);
            io.to(room.id).emit('player_left', {
                playerId: socket.playerId,
                players: room.getPlayersInfo()
            });
            
            // Remove empty rooms
            if (room.players.size === 0) {
                room.cleanup();
                rooms.delete(room.id);
                console.log(`Room ${room.id} deleted (empty)`);
            }
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Deep Sea Hunter V2.0 Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play`);
});
