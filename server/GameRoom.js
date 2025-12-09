const FishManager = require('./FishManager');
const CollisionDetector = require('./CollisionDetector');
const RNGEngine = require('./RNGEngine');
const { v4: uuidv4 } = require('uuid');

// Seat positions for 4 players
const SEATS = ['bottom', 'top', 'left', 'right'];

// Cannon positions for each seat (x, y, angle)
const CANNON_POSITIONS = {
    bottom: { x: 400, y: 570, angle: -90 },   // Points up
    top: { x: 400, y: 30, angle: 90 },        // Points down
    left: { x: 30, y: 300, angle: 0 },        // Points right
    right: { x: 770, y: 300, angle: 180 }     // Points left
};

class GameRoom {
    constructor(id, io) {
        this.id = id;
        this.io = io;
        this.players = new Map();
        this.hostId = null;
        this.gameStarted = false;
        this.gamePaused = false;
        
        // Game managers
        this.fishManager = new FishManager(this);
        this.collisionDetector = new CollisionDetector(this);
        this.rngEngine = new RNGEngine();
        
        // Bullets in flight
        this.bullets = new Map();
        this.bulletIdCounter = 0;
        
        // Game loop
        this.gameLoop = null;
        this.lastUpdate = Date.now();
        
        // Auto-mode timers per player
        this.autoModeTimers = new Map();
    }
    
    canJoin() {
        return this.players.size < 4 && !this.gameStarted;
    }
    
    getAvailableSeat() {
        const takenSeats = new Set([...this.players.values()].map(p => p.seat));
        return SEATS.find(seat => !takenSeats.has(seat));
    }
    
    addPlayer(socket, name) {
        if (!this.canJoin()) return null;
        
        const seat = this.getAvailableSeat();
        if (!seat) return null;
        
        const player = {
            id: socket.id,
            socket: socket,
            name: name,
            seat: seat,
            position: CANNON_POSITIONS[seat],
            coins: 1000,
            bulletLevel: 1,
            ready: false,
            autoMode: {
                enabled: false,
                endTime: 0
            },
            lastShotTime: 0,
            shotCooldown: 500 // ms between shots
        };
        
        this.players.set(socket.id, player);
        
        // First player is host
        if (this.players.size === 1) {
            this.hostId = socket.id;
        }
        
        return player;
    }
    
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            // Clear auto-mode timer if active
            if (this.autoModeTimers.has(playerId)) {
                clearTimeout(this.autoModeTimers.get(playerId));
                this.autoModeTimers.delete(playerId);
            }
            this.players.delete(playerId);
            
            // Assign new host if needed
            if (this.hostId === playerId && this.players.size > 0) {
                this.hostId = this.players.keys().next().value;
                this.io.to(this.id).emit('new_host', { hostId: this.hostId });
            }
        }
    }
    
    setPlayerReady(playerId, ready) {
        const player = this.players.get(playerId);
        if (player) {
            player.ready = ready;
        }
    }
    
    allPlayersReady() {
        for (const player of this.players.values()) {
            if (!player.ready) return false;
        }
        return true;
    }
    
    isHost(playerId) {
        return this.hostId === playerId;
    }
    
    getPlayerInfo(playerId) {
        const player = this.players.get(playerId);
        if (!player) return null;
        return {
            id: player.id,
            name: player.name,
            seat: player.seat,
            position: player.position,
            coins: player.coins,
            bulletLevel: player.bulletLevel,
            ready: player.ready,
            autoMode: player.autoMode.enabled,
            isHost: player.id === this.hostId
        };
    }
    
    getPlayersInfo() {
        const info = {};
        for (const [id, player] of this.players) {
            info[id] = this.getPlayerInfo(id);
        }
        return info;
    }
    
    startGame() {
        if (this.gameStarted) return;
        
        this.gameStarted = true;
        console.log(`Game started in room ${this.id}`);
        
        // Broadcast game start
        this.io.to(this.id).emit('game_start', {
            players: this.getPlayersInfo(),
            startCoins: 1000
        });
        
        // Start fish spawning
        this.fishManager.startSpawning();
        
        // Start game loop (60 FPS)
        this.lastUpdate = Date.now();
        this.gameLoop = setInterval(() => this.update(), 1000 / 60);
    }
    
    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        
        if (this.gamePaused) return;
        
        // Update fish positions
        this.fishManager.update(deltaTime);
        
        // Update bullets and check collisions
        this.updateBullets(deltaTime);
        
        // Handle auto-mode shooting
        this.handleAutoMode();
        
        // Broadcast game state sync every 100ms
        if (now % 100 < 20) {
            this.broadcastSync();
        }
    }
    
    updateBullets(deltaTime) {
        const bulletsToRemove = [];
        
        for (const [bulletId, bullet] of this.bullets) {
            // Update bullet position
            bullet.x += bullet.velocityX * deltaTime;
            bullet.y += bullet.velocityY * deltaTime;
            
            // Check if bullet is out of bounds
            if (bullet.x < -50 || bullet.x > 850 || bullet.y < -50 || bullet.y > 650) {
                bulletsToRemove.push(bulletId);
                continue;
            }
            
            // Check collision with fish
            const hitFish = this.collisionDetector.checkBulletFishCollision(bullet);
            if (hitFish) {
                // Run RNG for capture
                const captured = this.rngEngine.rollCapture(hitFish, bullet.bulletLevel);
                
                if (captured) {
                    const reward = this.calculateReward(hitFish, bullet.bulletLevel);
                    const player = this.players.get(bullet.playerId);
                    if (player) {
                        player.coins += reward;
                    }
                    
                    // Broadcast capture
                    this.io.to(this.id).emit('fish_captured', {
                        fishId: hitFish.id,
                        playerId: bullet.playerId,
                        reward: reward,
                        newCoins: player ? player.coins : 0,
                        bulletId: bulletId
                    });
                    
                    // Remove fish
                    this.fishManager.removeFish(hitFish.id);
                    
                    // Check for special fish bonus
                    if (hitFish.type === 'special') {
                        this.triggerBonus(bullet.playerId, hitFish);
                    }
                } else {
                    // Miss - just remove bullet
                    this.io.to(this.id).emit('bullet_miss', {
                        bulletId: bulletId,
                        fishId: hitFish.id
                    });
                }
                
                bulletsToRemove.push(bulletId);
            }
        }
        
        // Remove bullets
        for (const bulletId of bulletsToRemove) {
            this.bullets.delete(bulletId);
        }
    }
    
    calculateReward(fish, bulletLevel) {
        return fish.multiplier * bulletLevel * 10;
    }
    
    handleShoot(playerId, data) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        const now = Date.now();
        
        // Check cooldown
        const cooldown = player.autoMode.enabled ? 2000 : player.shotCooldown;
        if (now - player.lastShotTime < cooldown) return;
        
        // Check bullet level (auto-mode locked to 1x)
        const bulletLevel = player.autoMode.enabled ? 1 : (data.bulletLevel || player.bulletLevel);
        const bulletCost = bulletLevel * 10;
        
        // Check coins
        if (player.coins < bulletCost) {
            player.socket.emit('error', { message: 'Not enough coins' });
            return;
        }
        
        // Deduct coins
        player.coins -= bulletCost;
        player.lastShotTime = now;
        
        // Apply accuracy penalty for auto-mode
        let targetX = data.targetX;
        let targetY = data.targetY;
        if (player.autoMode.enabled && Math.random() > 0.85) {
            // 15% chance to miss - offset target by ±30px
            targetX += (Math.random() - 0.5) * 60;
            targetY += (Math.random() - 0.5) * 60;
        }
        
        // Create bullet
        const bulletId = `${playerId}-${this.bulletIdCounter++}`;
        const angle = Math.atan2(targetY - player.position.y, targetX - player.position.x);
        const speed = 600;
        
        const bullet = {
            id: bulletId,
            playerId: playerId,
            x: player.position.x,
            y: player.position.y,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            bulletLevel: bulletLevel,
            createdAt: now
        };
        
        this.bullets.set(bulletId, bullet);
        
        // Broadcast shot to all clients
        this.io.to(this.id).emit('player_shot', {
            playerId: playerId,
            bulletId: bulletId,
            fromPosition: player.position,
            targetX: targetX,
            targetY: targetY,
            bulletLevel: bulletLevel,
            newCoins: player.coins
        });
    }
    
    changeBulletLevel(playerId, level) {
        const player = this.players.get(playerId);
        if (player && !player.autoMode.enabled) {
            const validLevels = [1, 2, 3, 5, 10];
            if (validLevels.includes(level)) {
                player.bulletLevel = level;
                player.socket.emit('bullet_level_changed', { level: level });
            }
        }
    }
    
    enableAutoMode(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        const autoCost = 100;
        if (player.coins < autoCost) {
            player.socket.emit('error', { message: 'Need 100 coins for auto-mode' });
            return;
        }
        
        // Deduct cost
        player.coins -= autoCost;
        player.autoMode.enabled = true;
        player.autoMode.endTime = Date.now() + 60000; // 60 seconds
        
        // Set timer to disable auto-mode
        const timer = setTimeout(() => {
            this.disableAutoMode(playerId);
        }, 60000);
        this.autoModeTimers.set(playerId, timer);
        
        // Notify player
        player.socket.emit('auto_mode_enabled', {
            duration: 60000,
            newCoins: player.coins
        });
        
        // Notify other players
        this.io.to(this.id).emit('player_auto_mode', {
            playerId: playerId,
            enabled: true
        });
    }
    
    disableAutoMode(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        player.autoMode.enabled = false;
        player.autoMode.endTime = 0;
        
        // Clear timer
        if (this.autoModeTimers.has(playerId)) {
            clearTimeout(this.autoModeTimers.get(playerId));
            this.autoModeTimers.delete(playerId);
        }
        
        player.socket.emit('auto_mode_disabled', {});
        this.io.to(this.id).emit('player_auto_mode', {
            playerId: playerId,
            enabled: false
        });
    }
    
    handleAutoMode() {
        for (const [playerId, player] of this.players) {
            if (player.autoMode.enabled) {
                // Check if auto-mode expired
                if (Date.now() > player.autoMode.endTime) {
                    this.disableAutoMode(playerId);
                    continue;
                }
                
                // Auto-fire at random fish
                const now = Date.now();
                if (now - player.lastShotTime >= 2000) { // 2 second interval
                    const randomFish = this.fishManager.getRandomFish();
                    if (randomFish) {
                        this.handleShoot(playerId, {
                            targetX: randomFish.x,
                            targetY: randomFish.y,
                            bulletLevel: 1
                        });
                    }
                }
            }
        }
    }
    
    triggerBonus(playerId, fish) {
        const bonusType = this.rngEngine.rollBonusType();
        this.io.to(this.id).emit('bonus_triggered', {
            playerId: playerId,
            bonusType: bonusType,
            fishId: fish.id
        });
        
        // Execute bonus based on type
        switch (bonusType) {
            case 'lockAndFreeze':
                this.executeLockAndFreeze(playerId);
                break;
            case 'chainLightning':
                this.executeChainLightning(playerId, fish);
                break;
            case 'fullScreenClear':
                this.executeFullScreenClear(playerId);
                break;
        }
    }
    
    executeLockAndFreeze(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        // Freeze game for 5 seconds
        this.gamePaused = true;
        
        // Auto-target highest value fish
        const fish = this.fishManager.getAllFish();
        const sortedFish = [...fish].sort((a, b) => b.multiplier - a.multiplier);
        
        let shotCount = 0;
        const autoShootInterval = setInterval(() => {
            if (shotCount >= 10 || sortedFish.length === 0) {
                clearInterval(autoShootInterval);
                this.gamePaused = false;
                return;
            }
            
            const targetFish = sortedFish[shotCount % sortedFish.length];
            if (targetFish && this.fishManager.fishExists(targetFish.id)) {
                // 100% capture during freeze
                const reward = this.calculateReward(targetFish, 5);
                player.coins += reward;
                
                this.io.to(this.id).emit('fish_captured', {
                    fishId: targetFish.id,
                    playerId: playerId,
                    reward: reward,
                    newCoins: player.coins,
                    isBonus: true
                });
                
                this.fishManager.removeFish(targetFish.id);
            }
            shotCount++;
        }, 500);
        
        // End freeze after 5 seconds
        setTimeout(() => {
            clearInterval(autoShootInterval);
            this.gamePaused = false;
            this.io.to(this.id).emit('bonus_ended', { bonusType: 'lockAndFreeze' });
        }, 5000);
    }
    
    executeChainLightning(playerId, sourceFish) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        // Get all fish with multiplier < 15
        const fish = this.fishManager.getAllFish();
        const chainTargets = fish.filter(f => f.multiplier < 15 && f.id !== sourceFish.id);
        
        // Capture all chain targets
        const capturedFish = [];
        let totalReward = 0;
        
        for (const target of chainTargets.slice(0, 10)) { // Max 10 chain targets
            const reward = this.calculateReward(target, 1);
            totalReward += reward;
            capturedFish.push({
                fishId: target.id,
                reward: reward
            });
            this.fishManager.removeFish(target.id);
        }
        
        player.coins += totalReward;
        
        this.io.to(this.id).emit('chain_lightning', {
            playerId: playerId,
            sourcePosition: { x: sourceFish.x, y: sourceFish.y },
            capturedFish: capturedFish,
            totalReward: totalReward,
            newCoins: player.coins
        });
    }
    
    executeFullScreenClear(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        // Capture all fish at 80% value
        const fish = this.fishManager.getAllFish();
        let totalReward = 0;
        const capturedFish = [];
        
        for (const f of fish) {
            const reward = Math.floor(this.calculateReward(f, 1) * 0.8);
            totalReward += reward;
            capturedFish.push({
                fishId: f.id,
                reward: reward
            });
            this.fishManager.removeFish(f.id);
        }
        
        player.coins += totalReward;
        
        this.io.to(this.id).emit('full_screen_clear', {
            playerId: playerId,
            capturedFish: capturedFish,
            totalReward: totalReward,
            newCoins: player.coins
        });
    }
    
    broadcastSync() {
        const fishPositions = this.fishManager.getAllFishPositions();
        const playerCoins = {};
        for (const [id, player] of this.players) {
            playerCoins[id] = player.coins;
        }
        
        this.io.to(this.id).emit('game_sync', {
            timestamp: Date.now(),
            fish: fishPositions,
            playerCoins: playerCoins
        });
    }
    
    cleanup() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
        }
        this.fishManager.cleanup();
        for (const timer of this.autoModeTimers.values()) {
            clearTimeout(timer);
        }
    }
}

module.exports = GameRoom;
