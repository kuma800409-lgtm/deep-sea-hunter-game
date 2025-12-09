const { v4: uuidv4 } = require('uuid');

// Fish type configurations
const FISH_TYPES = {
    small: {
        name: 'Small Fish',
        multiplierRange: [2, 8],
        captureProb: 0.70,
        spawnWeight: 50,
        speed: { min: 80, max: 150 },
        size: 45,
        hitRadius: 30
    },
    medium: {
        name: 'Medium Fish',
        multiplierRange: [15, 30],
        captureProb: 0.40,
        spawnWeight: 25,
        speed: { min: 60, max: 100 },
        size: 70,
        hitRadius: 45
    },
    large: {
        name: 'Large Fish',
        multiplierRange: [50, 150],
        captureProb: 0.18,
        spawnWeight: 15,
        speed: { min: 40, max: 70 },
        size: 110,
        hitRadius: 60
    },
    boss: {
        name: 'Boss Fish',
        multiplierRange: [200, 500],
        captureProb: 0.05,
        spawnWeight: 5,
        speed: { min: 20, max: 40 },
        size: 160,
        hitRadius: 80
    },
    special: {
        name: 'Special Fish',
        multiplierRange: [50, 50],
        captureProb: 0.28,
        spawnWeight: 5,
        speed: { min: 50, max: 80 },
        size: 80,
        hitRadius: 50,
        isSpecial: true
    }
};

class FishManager {
    constructor(room) {
        this.room = room;
        this.fish = new Map();
        this.spawnTimer = null;
        this.maxFish = 15;
        this.fishIdCounter = 0;
    }
    
    startSpawning() {
        // Spawn initial fish
        for (let i = 0; i < 8; i++) {
            this.spawnFish();
        }
        
        // Continue spawning periodically
        this.spawnTimer = setInterval(() => {
            if (this.fish.size < this.maxFish) {
                this.spawnFish();
            }
        }, 1500);
    }
    
    spawnFish() {
        const type = this.selectFishType();
        const config = FISH_TYPES[type];
        
        // Generate spawn position (from edges)
        const spawn = this.generateSpawnPosition();
        const target = this.generateTargetPosition(spawn);
        
        // Calculate path
        const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
        const distance = Math.sqrt(
            Math.pow(target.x - spawn.x, 2) + Math.pow(target.y - spawn.y, 2)
        );
        const duration = (distance / speed) * 1000;
        
        // Generate multiplier
        const multiplier = Math.floor(
            config.multiplierRange[0] + 
            Math.random() * (config.multiplierRange[1] - config.multiplierRange[0] + 1)
        );
        
        const fishId = `fish-${this.fishIdCounter++}`;
        const now = Date.now();
        
        const fish = {
            id: fishId,
            type: type,
            x: spawn.x,
            y: spawn.y,
            startX: spawn.x,
            startY: spawn.y,
            targetX: target.x,
            targetY: target.y,
            speed: speed,
            multiplier: multiplier,
            captureProb: config.captureProb,
            hitRadius: config.hitRadius,
            size: config.size,
            isSpecial: config.isSpecial || false,
            spawnTime: now,
            duration: duration,
            direction: target.x > spawn.x ? 1 : -1
        };
        
        this.fish.set(fishId, fish);
        
        // Broadcast fish spawn to all clients
        this.room.io.to(this.room.id).emit('fish_spawn', {
            fishId: fishId,
            fishType: type,
            position: { x: spawn.x, y: spawn.y },
            target: { x: target.x, y: target.y },
            speed: speed,
            multiplier: multiplier,
            size: config.size,
            duration: duration,
            direction: fish.direction
        });
        
        return fish;
    }
    
    selectFishType() {
        const totalWeight = Object.values(FISH_TYPES).reduce((sum, t) => sum + t.spawnWeight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [type, config] of Object.entries(FISH_TYPES)) {
            random -= config.spawnWeight;
            if (random <= 0) {
                return type;
            }
        }
        return 'small';
    }
    
    generateSpawnPosition() {
        const side = Math.floor(Math.random() * 4);
        const margin = 50;
        
        switch (side) {
            case 0: // Left
                return { x: -margin, y: 100 + Math.random() * 400 };
            case 1: // Right
                return { x: 800 + margin, y: 100 + Math.random() * 400 };
            case 2: // Top
                return { x: 100 + Math.random() * 600, y: -margin };
            case 3: // Bottom (but above cannons)
                return { x: 100 + Math.random() * 600, y: 500 + margin };
            default:
                return { x: -margin, y: 300 };
        }
    }
    
    generateTargetPosition(spawn) {
        // Target is on opposite side
        if (spawn.x < 0) {
            return { x: 850, y: 100 + Math.random() * 400 };
        } else if (spawn.x > 800) {
            return { x: -50, y: 100 + Math.random() * 400 };
        } else if (spawn.y < 0) {
            return { x: 100 + Math.random() * 600, y: 550 };
        } else {
            return { x: 100 + Math.random() * 600, y: -50 };
        }
    }
    
    update(deltaTime) {
        const now = Date.now();
        const fishToRemove = [];
        
        for (const [fishId, fish] of this.fish) {
            // Calculate progress along path
            const elapsed = now - fish.spawnTime;
            const progress = Math.min(elapsed / fish.duration, 1);
            
            // Linear interpolation
            fish.x = fish.startX + (fish.targetX - fish.startX) * progress;
            fish.y = fish.startY + (fish.targetY - fish.startY) * progress;
            
            // Remove fish that reached target
            if (progress >= 1) {
                fishToRemove.push(fishId);
            }
        }
        
        // Remove completed fish
        for (const fishId of fishToRemove) {
            this.fish.delete(fishId);
            this.room.io.to(this.room.id).emit('fish_escaped', { fishId: fishId });
        }
    }
    
    removeFish(fishId) {
        this.fish.delete(fishId);
    }
    
    fishExists(fishId) {
        return this.fish.has(fishId);
    }
    
    getFish(fishId) {
        return this.fish.get(fishId);
    }
    
    getAllFish() {
        return Array.from(this.fish.values());
    }
    
    getAllFishPositions() {
        const positions = {};
        for (const [id, fish] of this.fish) {
            positions[id] = {
                x: fish.x,
                y: fish.y,
                type: fish.type,
                multiplier: fish.multiplier,
                direction: fish.direction
            };
        }
        return positions;
    }
    
    getRandomFish() {
        const fishArray = this.getAllFish();
        if (fishArray.length === 0) return null;
        return fishArray[Math.floor(Math.random() * fishArray.length)];
    }
    
    cleanup() {
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
        }
        this.fish.clear();
    }
}

module.exports = FishManager;
