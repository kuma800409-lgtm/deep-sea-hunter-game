/**
 * Deep Sea Hunter - Fishing Arcade Game
 * Built with Phaser 3
 * 
 * PHASE 2: Advanced Animation & Polish
 */

const PROBABILITY_TABLE = {
    baseBulletCost: 10,
    fishTypes: {
        small: { name: 'Small Fish', multiplierRange: [2, 5], baseCaptureProb: 0.255, spawnWeight: 50, speed: { min: 80, max: 150 }, size: 45, hitRadius: 30, color: 0x00e5ff, bodyColor: 0x00bcd4, finColor: 0x4dd0e1, glowColor: 0x27c8ff, swimSpeed: 1.5, tailSpeed: 2.0 },
        medium: { name: 'Medium Fish', multiplierRange: [6, 12], baseCaptureProb: 0.1025, spawnWeight: 25, speed: { min: 60, max: 100 }, size: 70, hitRadius: 45, color: 0xff7043, bodyColor: 0xff5722, finColor: 0xffab91, glowColor: 0xff6b35, hasPattern: true, swimSpeed: 1.2, tailSpeed: 1.5 },
        large: { name: 'Large Fish', multiplierRange: [15, 35], baseCaptureProb: 0.037, spawnWeight: 15, speed: { min: 40, max: 70 }, size: 110, hitRadius: 60, color: 0x9c27b0, bodyColor: 0x7b1fa2, finColor: 0xce93d8, glowColor: 0xff3da8, swimSpeed: 0.8, tailSpeed: 1.0 },
        boss: { name: 'Boss Fish', multiplierRange: [50, 100], baseCaptureProb: 0.0135, spawnWeight: 5, speed: { min: 20, max: 40 }, size: 160, hitRadius: 80, color: 0xc62828, bodyColor: 0xb71c1c, finColor: 0xffd700, glowColor: 0xff3da8, hasGlow: true, swimSpeed: 0.5, tailSpeed: 0.7, hasScreenShake: true },
        special: { name: 'Special Fish', multiplierRange: [20, 20], baseCaptureProb: 0.044, spawnWeight: 5, speed: { min: 50, max: 80 }, size: 80, hitRadius: 50, color: 0xffc107, bodyColor: 0xffb300, finColor: 0xffe082, glowColor: 0xffc857, isSpecial: true, hasSparkle: true, swimSpeed: 1.0, tailSpeed: 1.3 }
    },
    bulletLevelBonus: { 1: 1.0, 2: 1.01, 3: 1.02, 5: 1.04, 10: 1.08 },
    bonusFeatures: { lockAndFreeze: { probability: 0.33, name: 'LOCK & FREEZE' }, chainLightning: { probability: 0.33, name: 'CHAIN LIGHTNING' }, fullScreenClear: { probability: 0.34, name: 'FULL SCREEN CLEAR' } }
};

const GameState = { coins: 1000, bulletLevel: 1, bulletCost: 10, isInBonusMode: false, bonusType: null, bonusTimeRemaining: 0, totalSpent: 0, totalWon: 0, cannonAngle: -90 };

function getRandomInRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getRandomFloat(min, max) { return Math.random() * (max - min) + min; }
function selectFishType() { const types = Object.keys(PROBABILITY_TABLE.fishTypes); const weights = types.map(t => PROBABILITY_TABLE.fishTypes[t].spawnWeight); const totalWeight = weights.reduce((a, b) => a + b, 0); let random = Math.random() * totalWeight; for (let i = 0; i < types.length; i++) { random -= weights[i]; if (random <= 0) return types[i]; } return types[0]; }
function calculateCaptureChance(fishType, bulletLevel) { const fish = PROBABILITY_TABLE.fishTypes[fishType]; const baseProb = fish.baseCaptureProb; const levelBonus = PROBABILITY_TABLE.bulletLevelBonus[bulletLevel] || 1.0; return Math.min(baseProb * levelBonus, 0.95); }
function selectBonusFeature() { const features = PROBABILITY_TABLE.bonusFeatures; const random = Math.random(); if (random < features.lockAndFreeze.probability) return 'lockAndFreeze'; else if (random < features.lockAndFreeze.probability + features.chainLightning.probability) return 'chainLightning'; else return 'fullScreenClear'; }
function getMultiplierColor(multiplier) { if (multiplier <= 10) return { color: '#00ff88', stroke: '#006633' }; else if (multiplier <= 30) return { color: '#ffaa00', stroke: '#885500' }; else if (multiplier <= 150) return { color: '#ff4444', stroke: '#880000' }; else return { color: '#ffd700', stroke: '#996600' }; }

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.fish = []; this.bullets = []; this.cannon = null; this.cannonAngle = -90;
        this.lastShotTime = 0; this.shotCooldown = 150; this.bonusTimer = null; this.autoTargetTimer = null;
        this.lightRays = []; this.coralElements = []; this.rockElements = []; this.bubbles = []; this.lightParticles = [];
        this.gameTime = 0; this.coinDisplayValue = 1000;
    }
    
    create() {
        this.createOceanBackground(); this.createCausticPatterns(); this.createCoralReef();
        this.createRockFormations(); this.createLightRays(); this.createLightParticles();
        
        // Create physics groups for reliable collision detection
        this.fishGroup = this.physics.add.group();
        this.bulletGroup = this.physics.add.group();
        
        this.createCannon(); this.createParticleTextures();
        
        // Set up physics overlap with validation callback
        this.physics.add.overlap(this.bulletGroup, this.fishGroup, this.onBulletHitFish, this.validateCollision, this);
        
        this.input.on('pointerdown', this.handleClick, this);
        this.input.on('pointermove', this.handlePointerMove, this);
        this.time.addEvent({ delay: 1500, callback: this.spawnFish, callbackScope: this, loop: true });
        for (let i = 0; i < 8; i++) this.spawnFish();
        this.setupUIListeners(); this.updateUI(); this.animateLightRays(); this.startCoinAnimation();
    }
    
    createOceanBackground() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const graphics = this.add.graphics();
        for (let y = 0; y < height; y++) {
            const ratio = y / height;
            const r = Math.floor(0 + ratio * 10); const g = Math.floor(20 + ratio * 40); const b = Math.floor(60 + ratio * 80);
            graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b)); graphics.fillRect(0, y, width, 1);
        }
        for (let i = 0; i < 30; i++) {
            const bubble = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 4 + 1, 0xffffff, 0.15 + Math.random() * 0.15);
            this.bubbles.push({ sprite: bubble, speed: Math.random() * 25 + 15, wobbleSpeed: Math.random() * 2 + 1, wobbleAmount: Math.random() * 15 + 5, startX: bubble.x, phase: Math.random() * Math.PI * 2 });
        }
        for (let i = 0; i < 8; i++) { const x = (width / 8) * i + Math.random() * 50; this.createSeaweed(x, height); }
    }
    
    createSeaweed(x, y) {
        const graphics = this.add.graphics(); graphics.fillStyle(0x006633, 0.6);
        const h = Math.random() * 60 + 40; const w = 8;
        graphics.beginPath(); graphics.moveTo(x, y);
        for (let i = 0; i < h; i += 5) { const wave = Math.sin(i * 0.1) * 10; graphics.lineTo(x + wave, y - i); }
        graphics.lineTo(x + w, y - h);
        for (let i = h; i > 0; i -= 5) { const wave = Math.sin(i * 0.1) * 10; graphics.lineTo(x + w + wave, y - i); }
        graphics.closePath(); graphics.fill();
    }
    
    createCausticPatterns() {
        this.causticGraphics = this.add.graphics(); this.causticGraphics.setAlpha(0.03);
        this.time.addEvent({ delay: 100, callback: () => this.updateCaustics(), callbackScope: this, loop: true });
    }
    
    updateCaustics() {
        if (!this.causticGraphics) return;
        const width = this.cameras.main.width; const height = this.cameras.main.height; const time = this.gameTime * 0.001;
        this.causticGraphics.clear(); this.causticGraphics.fillStyle(0xffffff);
        for (let i = 0; i < 15; i++) {
            const x = (Math.sin(time + i * 0.5) * 0.5 + 0.5) * width;
            const y = (Math.cos(time * 0.7 + i * 0.3) * 0.5 + 0.5) * height * 0.7;
            const size = 30 + Math.sin(time + i) * 15;
            this.causticGraphics.fillEllipse(x, y, size, size * 0.6);
        }
    }
    
    createLightParticles() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        for (let i = 0; i < 25; i++) {
            const particle = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 2 + 0.5, 0xffffff, 0.1 + Math.random() * 0.2);
            this.lightParticles.push({ sprite: particle, speedX: (Math.random() - 0.5) * 10, speedY: (Math.random() - 0.5) * 8, pulseSpeed: Math.random() * 2 + 1, phase: Math.random() * Math.PI * 2 });
        }
    }
    
    createCoralReef() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const coralColors = [{ main: 0xff69b4, highlight: 0xffb6c1 }, { main: 0xff7f50, highlight: 0xffa07a }, { main: 0x9370db, highlight: 0xb19cd9 }, { main: 0xff6347, highlight: 0xff7f7f }, { main: 0x20b2aa, highlight: 0x48d1cc }];
        for (let i = 0; i < 10; i++) { const x = (width / 10) * i + Math.random() * 60 - 30; const colorSet = coralColors[Math.floor(Math.random() * coralColors.length)]; this.createCoral(x, height, colorSet); }
    }
    
    createCoral(x, baseY, colorSet) {
        const graphics = this.add.graphics(); const coralType = Math.floor(Math.random() * 3);
        if (coralType === 0) this.drawBranchingCoral(graphics, x, baseY, colorSet, 50 + Math.random() * 30);
        else if (coralType === 1) this.drawFanCoral(graphics, x, baseY, colorSet, 40 + Math.random() * 25);
        else this.drawTubeCoral(graphics, x, baseY, colorSet, 35 + Math.random() * 25);
        this.coralElements.push(graphics);
    }
    
    drawBranchingCoral(graphics, x, baseY, colorSet, height) {
        graphics.fillStyle(colorSet.main); graphics.fillRect(x - 3, baseY - height, 6, height);
        for (let i = 0; i < 3; i++) {
            const branchY = baseY - height * (0.4 + i * 0.2); const branchLength = 12 + Math.random() * 15; const direction = i % 2 === 0 ? 1 : -1;
            graphics.fillStyle(colorSet.highlight); graphics.beginPath(); graphics.moveTo(x, branchY);
            graphics.lineTo(x + direction * branchLength, branchY - 12); graphics.lineTo(x + direction * branchLength, branchY - 8);
            graphics.lineTo(x, branchY + 4); graphics.closePath(); graphics.fill();
            graphics.fillCircle(x + direction * branchLength, branchY - 10, 4);
        }
        graphics.fillStyle(colorSet.highlight); graphics.fillCircle(x, baseY - height - 4, 6);
    }
    
    drawFanCoral(graphics, x, baseY, colorSet, size) {
        graphics.fillStyle(colorSet.main, 0.8); graphics.beginPath(); graphics.moveTo(x, baseY);
        const segments = 10;
        for (let i = 0; i <= segments; i++) { const angle = Math.PI + (Math.PI * i / segments); const radius = size * (0.8 + Math.sin(i * 0.8) * 0.2); graphics.lineTo(x + Math.cos(angle) * radius, baseY - 8 + Math.sin(angle) * radius * 0.6); }
        graphics.closePath(); graphics.fill();
    }
    
    drawTubeCoral(graphics, x, baseY, colorSet, height) {
        const tubeCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < tubeCount; i++) {
            const tubeX = x + (i - tubeCount/2) * 7; const tubeHeight = height * (0.6 + Math.random() * 0.4);
            graphics.fillStyle(colorSet.main); graphics.fillRoundedRect(tubeX - 3, baseY - tubeHeight, 6, tubeHeight, 3);
            graphics.fillStyle(colorSet.highlight); graphics.fillCircle(tubeX, baseY - tubeHeight, 4);
        }
    }
    
    createRockFormations() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        this.createRock(25, height - 40, 60, 80); this.createRock(70, height - 25, 40, 50);
        this.createRock(width - 40, height - 35, 55, 70); this.createRock(width - 85, height - 20, 35, 45);
    }
    
    createRock(x, y, rockWidth, rockHeight) {
        const graphics = this.add.graphics();
        graphics.fillStyle(0x2d3436); graphics.beginPath(); graphics.moveTo(x - rockWidth/2, y);
        graphics.lineTo(x - rockWidth/3, y - rockHeight * 0.7); graphics.lineTo(x, y - rockHeight);
        graphics.lineTo(x + rockWidth/3, y - rockHeight * 0.8); graphics.lineTo(x + rockWidth/2, y);
        graphics.closePath(); graphics.fill();
        graphics.fillStyle(0x636e72); graphics.beginPath(); graphics.moveTo(x - rockWidth/4, y - rockHeight * 0.3);
        graphics.lineTo(x, y - rockHeight * 0.9); graphics.lineTo(x + rockWidth/4, y - rockHeight * 0.5);
        graphics.closePath(); graphics.fill();
        this.rockElements.push(graphics);
    }
    
    createLightRays() {
        const width = this.cameras.main.width;
        for (let i = 0; i < 4; i++) {
            const rayX = width * (0.15 + i * 0.22) + Math.random() * 40;
            const ray = this.add.graphics(); ray.fillStyle(0xffffff, 0.025);
            ray.beginPath(); ray.moveTo(rayX - 15, 0); ray.lineTo(rayX + 15, 0);
            ray.lineTo(rayX + 60, this.cameras.main.height); ray.lineTo(rayX - 30, this.cameras.main.height);
            ray.closePath(); ray.fill(); this.lightRays.push(ray);
        }
    }
    
    animateLightRays() {
        this.lightRays.forEach((ray, index) => {
            this.tweens.add({ targets: ray, alpha: { from: 0.3, to: 0.6 }, duration: 3000 + index * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
    }

    createCannon() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const cannonX = width / 2; const cannonY = height - 30;
        this.cannon = this.add.container(cannonX, cannonY);
        const base = this.add.graphics(); base.fillStyle(0x455a64); base.fillRoundedRect(-35, 10, 70, 25, 8);
        base.fillStyle(0x37474f); base.fillRoundedRect(-30, 15, 60, 15, 5);
        const turret = this.add.graphics(); turret.fillStyle(0x78909c); turret.fillRoundedRect(-25, -20, 50, 35, 10);
        turret.fillStyle(0x90a4ae); turret.fillRoundedRect(-20, -15, 40, 25, 8);
        this.cannonCore = this.add.circle(0, -5, 12, 0x00e5ff);
        this.cannonCoreGlow = this.add.circle(0, -5, 18, 0x00e5ff, 0.3);
        const barrel = this.add.graphics(); barrel.fillStyle(0x546e7a); barrel.fillRoundedRect(-8, -50, 16, 35, 4);
        barrel.fillStyle(0x607d8b); barrel.fillRect(-6, -48, 12, 30);
        barrel.fillStyle(0x00e5ff, 0.5); barrel.fillRect(-3, -45, 6, 25);
        barrel.fillStyle(0x455a64); barrel.fillRoundedRect(-10, -55, 20, 8, 3);
        this.cannon.add([base, turret, this.cannonCoreGlow, this.cannonCore, barrel]);
        this.tweens.add({ targets: [this.cannonCore, this.cannonCoreGlow], scaleX: 1.2, scaleY: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: this.cannonCoreGlow, alpha: { from: 0.3, to: 0.6 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    
    createParticleTextures() {
        const pg = this.make.graphics({ x: 0, y: 0, add: false });
        pg.fillStyle(0x00ffff); pg.fillCircle(8, 8, 8); pg.generateTexture('bulletParticle', 16, 16); pg.clear();
        pg.fillStyle(0xffff00); pg.fillCircle(6, 6, 6); pg.generateTexture('captureParticle', 12, 12); pg.clear();
        pg.fillStyle(0xffffff); pg.fillCircle(3, 3, 3); pg.generateTexture('sparkleParticle', 6, 6);
    }
    
    startCoinAnimation() { const coinIcon = document.querySelector('.coin-icon'); if (coinIcon) coinIcon.classList.add('spinning'); }
    
    spawnFish() {
        if (GameState.isInBonusMode && GameState.bonusType === 'lockAndFreeze') return;
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const fishType = selectFishType(); const fishConfig = PROBABILITY_TABLE.fishTypes[fishType];
        const side = Math.floor(Math.random() * 4); let x, y, targetX, targetY;
        switch (side) {
            case 0: x = -50; y = Math.random() * (height - 150) + 50; targetX = width + 50; targetY = Math.random() * (height - 150) + 50; break;
            case 1: x = width + 50; y = Math.random() * (height - 150) + 50; targetX = -50; targetY = Math.random() * (height - 150) + 50; break;
            case 2: x = Math.random() * width; y = -50; targetX = Math.random() * width; targetY = height - 100; break;
            case 3: x = Math.random() * width; y = height - 80; targetX = Math.random() * width; targetY = 50; break;
        }
        const fish = this.createAnimatedFish(x, y, fishType, fishConfig);
        const speed = getRandomFloat(fishConfig.speed.min, fishConfig.speed.max);
        const distance = Phaser.Math.Distance.Between(x, y, targetX, targetY);
        const duration = (distance / speed) * 1000;
        fish.multiplier = getRandomInRange(fishConfig.multiplierRange[0], fishConfig.multiplierRange[1]);
        fish.fishType = fishType; fish.captureProb = fishConfig.baseCaptureProb;
        fish.isSpecial = fishConfig.isSpecial || false; fish.direction = targetX > x ? 1 : -1;
        fish.hitCooldown = 0; // Initialize hit cooldown for collision detection
        fish.hitRadius = fishConfig.hitRadius || fishConfig.size * 0.7;
        const colorInfo = getMultiplierColor(fish.multiplier);
        const multiplierText = this.add.text(x, y - fishConfig.size - 5, fish.multiplier + 'x', {
            fontSize: fishType === 'boss' ? '18px' : '14px', fontFamily: 'Orbitron, Arial', fontStyle: 'bold',
            color: colorInfo.color, stroke: colorInfo.stroke, strokeThickness: 3
        }).setOrigin(0.5);
        fish.multiplierText = multiplierText;
        this.tweens.add({ targets: multiplierText, y: multiplierText.y - 5, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: fish, x: targetX, y: targetY, duration: duration, ease: 'Linear',
            onUpdate: () => { if (fish.multiplierText) { fish.multiplierText.x = fish.x; fish.multiplierText.y = fish.y - fishConfig.size - 5; } if (fish.direction < 0) fish.scaleX = -1; },
            onComplete: () => this.removeFish(fish)
        });
        if (fishConfig.hasScreenShake) { this.cameras.main.shake(300, 0.01); this.showBossEntrance(fish); }
        this.fishGroup.add(fish); this.fish.push(fish);
    }
    
    createAnimatedFish(x, y, fishType, config) {
        const fish = this.add.container(x, y); const s = config.size;
        fish.bodyGraphics = this.add.graphics(); fish.tailGraphics = this.add.graphics();
        fish.finGraphics = this.add.graphics(); fish.eyeGraphics = this.add.graphics(); fish.glowGraphics = null;
        fish.eyeOpenness = 1.0; fish.fishSize = s; fish.fishConfig = config; fish.fishType = fishType;
        this.drawFishBody(fish, fishType, config); this.drawFishTail(fish, fishType, config);
        this.drawFishFins(fish, fishType, config); this.drawFishEye(fish, fishType, config);
        if (config.hasGlow || config.hasSparkle) {
            fish.glowGraphics = this.add.graphics(); this.drawFishGlow(fish, fishType, config);
            fish.add(fish.glowGraphics); fish.sendToBack(fish.glowGraphics);
        }
        fish.add([fish.bodyGraphics, fish.tailGraphics, fish.finGraphics, fish.eyeGraphics]);
        this.startFishAnimations(fish, config);
        if (config.hasSparkle) this.createSparkleTrail(fish);
        if (fishType === 'boss') this.createBossParticles(fish);
        return fish;
    }

    drawFishBody(fish, fishType, config) {
        const g = fish.bodyGraphics; const s = config.size; g.clear();
        const glowColor = config.glowColor || config.color;
        
        // Add rim lighting effect for all fish (outer glow)
        g.fillStyle(glowColor, 0.15); g.fillEllipse(0, 0, s * 0.55, s * 0.4);
        
        if (fishType === 'boss') {
            // Boss fish - mythical creature with dramatic appearance
            g.fillStyle(glowColor, 0.2); g.fillEllipse(0, 0, s * 1.5, s * 0.9); // Outer glow
            g.fillStyle(config.bodyColor); g.fillEllipse(0, 0, s * 1.4, s * 0.8);
            g.fillStyle(config.color, 0.8); g.fillEllipse(0, -s * 0.1, s * 1.2, s * 0.6);
            // Rim highlight on top
            g.fillStyle(0xffffff, 0.3); g.fillEllipse(0, -s * 0.25, s * 0.9, s * 0.15);
            // Gold scales
            g.fillStyle(0xffd700, 0.4); for (let i = 0; i < 6; i++) g.fillCircle(-s * 0.35 + i * s * 0.14, 0, s * 0.09);
            // Crown spikes
            g.fillStyle(0xffd700); g.beginPath(); g.moveTo(s * 0.3, -s * 0.35);
            g.lineTo(s * 0.35, -s * 0.6); g.lineTo(s * 0.45, -s * 0.4); g.lineTo(s * 0.5, -s * 0.65);
            g.lineTo(s * 0.6, -s * 0.35); g.closePath(); g.fill();
            // Crown highlight
            g.fillStyle(0xffe082, 0.6); g.beginPath(); g.moveTo(s * 0.35, -s * 0.4);
            g.lineTo(s * 0.38, -s * 0.52); g.lineTo(s * 0.42, -s * 0.4); g.closePath(); g.fill();
        } else if (fishType === 'special') {
            // Special fish - golden with sparkle effect
            g.fillStyle(glowColor, 0.25); g.fillEllipse(0, 0, s * 0.95, s * 0.6); // Outer glow
            g.fillStyle(config.bodyColor); g.fillEllipse(0, 0, s * 0.85, s * 0.55);
            g.fillStyle(0xffe082, 0.7); g.fillEllipse(0, -s * 0.08, s * 0.65, s * 0.35);
            // Rim highlight
            g.fillStyle(0xffffff, 0.4); g.fillEllipse(0, -s * 0.18, s * 0.45, s * 0.12);
            // Sparkle spots
            g.fillStyle(0xffffff, 0.6); g.fillCircle(s * 0.15, -s * 0.1, s * 0.04);
            g.fillCircle(-s * 0.1, s * 0.05, s * 0.03);
        } else if (fishType === 'large') {
            // Large fish - shark-like predator with sleek body
            g.fillStyle(glowColor, 0.15); g.fillEllipse(0, 0, s * 0.6, s * 0.35); // Outer glow
            g.fillStyle(config.bodyColor); g.beginPath(); g.moveTo(s * 0.55, 0);
            g.lineTo(s * 0.35, -s * 0.28); g.lineTo(-s * 0.25, -s * 0.22); g.lineTo(-s * 0.55, 0);
            g.lineTo(-s * 0.25, s * 0.22); g.lineTo(s * 0.35, s * 0.22); g.closePath(); g.fill();
            // Body highlight
            g.fillStyle(config.color, 0.7); g.beginPath(); g.moveTo(s * 0.45, -s * 0.05);
            g.lineTo(s * 0.25, -s * 0.2); g.lineTo(-s * 0.35, -s * 0.14); g.lineTo(-s * 0.35, s * 0.05);
            g.lineTo(s * 0.25, s * 0.05); g.closePath(); g.fill();
            // Rim highlight
            g.fillStyle(0xffffff, 0.25); g.fillEllipse(0, -s * 0.15, s * 0.35, s * 0.08);
        } else if (fishType === 'medium') {
            // Medium fish - tropical with patterns
            g.fillStyle(glowColor, 0.12); g.fillEllipse(0, 0, s * 0.58, s * 0.38); // Outer glow
            g.fillStyle(config.bodyColor); g.fillEllipse(0, 0, s * 0.52, s * 0.32);
            g.fillStyle(config.color, 0.8); g.fillEllipse(0, -s * 0.05, s * 0.42, s * 0.22);
            // Stripe patterns
            g.fillStyle(0xffffff, 0.35); g.fillRect(-s * 0.12, -s * 0.16, s * 0.05, s * 0.32);
            g.fillRect(s * 0.06, -s * 0.14, s * 0.05, s * 0.28);
            // Rim highlight
            g.fillStyle(0xffffff, 0.3); g.fillEllipse(0, -s * 0.12, s * 0.28, s * 0.08);
        } else {
            // Small fish - cute rounded shape
            g.fillStyle(glowColor, 0.1); g.fillEllipse(0, 0, s * 0.52, s * 0.36); // Outer glow
            g.fillStyle(config.bodyColor); g.fillEllipse(0, 0, s * 0.48, s * 0.32);
            g.fillStyle(config.color, 0.75); g.fillEllipse(0, -s * 0.05, s * 0.38, s * 0.2);
            // Belly highlight
            g.fillStyle(0xffffff, 0.35); g.fillEllipse(0, s * 0.08, s * 0.28, s * 0.1);
            // Rim highlight
            g.fillStyle(0xffffff, 0.25); g.fillEllipse(0, -s * 0.1, s * 0.22, s * 0.06);
        }
    }
    
    drawFishTail(fish, fishType, config) {
        const g = fish.tailGraphics; const s = config.size; g.clear(); g.fillStyle(config.finColor);
        if (fishType === 'boss') {
            g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(-s * 1.3, -s * 0.5);
            g.lineTo(-s * 1.1, 0); g.lineTo(-s * 1.3, s * 0.5); g.closePath(); g.fill();
        } else if (fishType === 'large') {
            g.beginPath(); g.moveTo(-s * 0.45, 0); g.lineTo(-s * 0.7, -s * 0.3);
            g.lineTo(-s * 0.55, 0); g.lineTo(-s * 0.7, s * 0.25); g.closePath(); g.fill();
        } else {
            g.beginPath(); g.moveTo(-s * 0.22, 0); g.lineTo(-s * 0.4, -s * 0.15);
            g.lineTo(-s * 0.32, 0); g.lineTo(-s * 0.4, s * 0.15); g.closePath(); g.fill();
        }
    }
    
    drawFishFins(fish, fishType, config) {
        const g = fish.finGraphics; const s = config.size; g.clear(); g.fillStyle(config.finColor);
        if (fishType === 'boss') {
            g.beginPath(); g.moveTo(-s * 0.3, -s * 0.35); g.lineTo(0, -s * 0.7);
            g.lineTo(s * 0.3, -s * 0.35); g.closePath(); g.fill();
            g.fillStyle(config.finColor, 0.8); g.fillEllipse(s * 0.1, s * 0.25, s * 0.3, s * 0.15);
        } else if (fishType === 'large') {
            g.beginPath(); g.moveTo(-s * 0.05, -s * 0.2); g.lineTo(s * 0.1, -s * 0.45);
            g.lineTo(s * 0.25, -s * 0.2); g.closePath(); g.fill();
            g.fillStyle(config.finColor, 0.8); g.fillEllipse(s * 0.1, s * 0.15, s * 0.2, s * 0.08);
        } else {
            g.beginPath(); g.moveTo(-s * 0.02, -s * 0.14); g.lineTo(s * 0.05, -s * 0.25);
            g.lineTo(s * 0.12, -s * 0.14); g.closePath(); g.fill();
            g.fillStyle(config.finColor, 0.8); g.fillEllipse(s * 0.05, s * 0.1, s * 0.1, s * 0.05);
        }
    }
    
    drawFishEye(fish, fishType, config, openness = 1.0) {
        const g = fish.eyeGraphics; const s = config.size; g.clear();
        let eyeX, eyeY, eyeSize;
        if (fishType === 'boss') { eyeX = s * 0.45; eyeY = -s * 0.05; eyeSize = s * 0.12; }
        else if (fishType === 'large') { eyeX = s * 0.35; eyeY = -s * 0.05; eyeSize = s * 0.08; }
        else if (fishType === 'medium' || fishType === 'special') { eyeX = s * 0.18; eyeY = -s * 0.03; eyeSize = s * 0.07; }
        else { eyeX = s * 0.15; eyeY = -s * 0.03; eyeSize = s * 0.06; }
        g.fillStyle(0xffffff); g.fillEllipse(eyeX, eyeY, eyeSize, eyeSize * openness);
        if (openness > 0.3) {
            const cannonAngle = GameState.cannonAngle || -90;
            const trackOffset = Math.sin((cannonAngle + 90) * Math.PI / 180) * eyeSize * 0.2;
            g.fillStyle(0x000000); g.fillCircle(eyeX + trackOffset * 0.3, eyeY, eyeSize * 0.6 * openness);
            g.fillStyle(0xffffff); g.fillCircle(eyeX + eyeSize * 0.2, eyeY - eyeSize * 0.2, eyeSize * 0.2);
        }
    }
    
    drawFishGlow(fish, fishType, config) {
        const g = fish.glowGraphics; const s = config.size; g.clear();
        if (fishType === 'boss') { g.fillStyle(0xffd700, 0.15); g.fillEllipse(0, 0, s * 1.8, s * 1.2); }
        else if (fishType === 'special') { g.fillStyle(0xffc107, 0.2); g.fillCircle(0, 0, s * 0.9); }
    }
    
    startFishAnimations(fish, config) {
        this.tweens.add({ targets: fish.bodyGraphics, x: { from: -2, to: 2 }, duration: 500 / (config.swimSpeed || 1), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: fish.tailGraphics, angle: { from: -15, to: 15 }, duration: 300 / (config.tailSpeed || 1), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: fish.finGraphics, scaleY: { from: 0.9, to: 1.1 }, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: fish, scaleY: { from: 0.97, to: 1.03 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.time.addEvent({ delay: 2000 + Math.random() * 3000, callback: () => this.blinkFishEye(fish), callbackScope: this, loop: true });
        if (fish.glowGraphics) {
            this.tweens.add({ targets: fish.glowGraphics, alpha: { from: 0.5, to: 1.0 }, scaleX: { from: 1.0, to: 1.1 }, scaleY: { from: 1.0, to: 1.1 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
    }
    
    blinkFishEye(fish) {
        if (!fish.active || !fish.eyeGraphics) return;
        this.tweens.add({ targets: fish, eyeOpenness: 0.1, duration: 80,
            onUpdate: () => this.drawFishEye(fish, fish.fishType, fish.fishConfig, fish.eyeOpenness),
            onComplete: () => { this.tweens.add({ targets: fish, eyeOpenness: 1.0, duration: 80, onUpdate: () => this.drawFishEye(fish, fish.fishType, fish.fishConfig, fish.eyeOpenness) }); }
        });
    }
    
    createSparkleTrail(fish) {
        this.time.addEvent({ delay: 150, callback: () => {
            if (!fish.active) return;
            const sparkle = this.add.circle(fish.x - fish.direction * 20 + (Math.random() - 0.5) * 20, fish.y + (Math.random() - 0.5) * 20, 3 + Math.random() * 3, 0xffd700, 0.8);
            this.tweens.add({ targets: sparkle, alpha: 0, scale: 0, duration: 500, onComplete: () => sparkle.destroy() });
        }, callbackScope: this, loop: true });
    }
    
    createBossParticles(fish) {
        this.time.addEvent({ delay: 100, callback: () => {
            if (!fish.active) return;
            const angle = Math.random() * Math.PI * 2; const distance = fish.fishSize * 0.8;
            const particle = this.add.circle(fish.x + Math.cos(angle) * distance, fish.y + Math.sin(angle) * distance, 4 + Math.random() * 4, Math.random() > 0.5 ? 0xff6600 : 0xffd700, 0.7);
            this.tweens.add({ targets: particle, x: fish.x + Math.cos(angle) * distance * 1.5, y: fish.y + Math.sin(angle) * distance * 1.5, alpha: 0, scale: 0.3, duration: 400, onComplete: () => particle.destroy() });
        }, callbackScope: this, loop: true });
    }
    
    showBossEntrance(fish) {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const flash = this.add.rectangle(width/2, height/2, width, height, 0xffd700, 0.3);
        this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
        const bossText = this.add.text(width/2, height/3, 'BOSS APPEARED!', { fontSize: '28px', fontFamily: 'Orbitron, Arial Black', color: '#ffd700', stroke: '#8b0000', strokeThickness: 4 }).setOrigin(0.5);
        this.tweens.add({ targets: bossText, y: bossText.y - 30, alpha: 0, scale: 1.5, duration: 1500, ease: 'Power2', onComplete: () => bossText.destroy() });
    }

    handlePointerMove(pointer) {
        const cannonX = this.cameras.main.width / 2; const cannonY = this.cameras.main.height - 30;
        const angle = Phaser.Math.Angle.Between(cannonX, cannonY, pointer.x, pointer.y);
        const degrees = Phaser.Math.RadToDeg(angle);
        const clampedAngle = Phaser.Math.Clamp(degrees, -170, -10);
        this.cannon.angle = clampedAngle + 90; this.cannonAngle = clampedAngle; GameState.cannonAngle = clampedAngle;
    }
    
    handleClick(pointer) {
        if (GameState.isInBonusMode && GameState.bonusType === 'lockAndFreeze') return;
        const currentTime = this.time.now;
        if (currentTime - this.lastShotTime < this.shotCooldown) return;
        const bulletCost = PROBABILITY_TABLE.baseBulletCost * GameState.bulletLevel;
        if (GameState.coins < bulletCost) { this.showFloatingText(this.cameras.main.width / 2, this.cameras.main.height / 2, 'Not enough coins!', '#ff0000', 20); return; }
        GameState.coins -= bulletCost; GameState.totalSpent += bulletCost;
        this.lastShotTime = currentTime;
        this.fireBullet(pointer.x, pointer.y, GameState.bulletLevel, false);
        this.updateUI(); this.animateCoinChange(-bulletCost);
    }
    
    fireBullet(targetX, targetY, bulletLevel, isFree = false) {
        const cannonX = this.cameras.main.width / 2; const cannonY = this.cameras.main.height - 30;
        const angle = Math.atan2(targetY - cannonY, targetX - cannonX);
        const startX = cannonX + Math.cos(angle) * 40; const startY = cannonY + Math.sin(angle) * 40;
        const bulletContainer = this.add.container(startX, startY);
        const bulletGraphics = this.add.graphics();
        if (bulletLevel >= 10) { this.drawGoldenRocket(bulletGraphics, bulletLevel); bulletContainer.trailColor = 0xffd700; bulletContainer.trailSize = 8; }
        else if (bulletLevel >= 5) { this.drawCyanPlasma(bulletGraphics, bulletLevel); bulletContainer.trailColor = 0x00ffff; bulletContainer.trailSize = 5; }
        else { this.drawBlueEnergyBolt(bulletGraphics, bulletLevel); bulletContainer.trailColor = 0x0088ff; bulletContainer.trailSize = 3; }
        bulletContainer.add(bulletGraphics);
        bulletContainer.angle = Phaser.Math.RadToDeg(angle) + 90;
        bulletContainer.bulletLevel = bulletLevel; bulletContainer.isFree = isFree; bulletContainer.isAutoTarget = isFree;
        const speed = 600;
        bulletContainer.velocityX = Math.cos(angle) * speed; bulletContainer.velocityY = Math.sin(angle) * speed;
        this.bulletGroup.add(bulletContainer); this.bullets.push(bulletContainer);
        const muzzleFlash = this.add.circle(startX, startY - 30, 15, 0x00e5ff, 0.8);
        this.tweens.add({ targets: muzzleFlash, alpha: 0, scale: 2, duration: 100, onComplete: () => muzzleFlash.destroy() });
        this.tweens.add({ targets: this.cannon, scaleY: 0.85, duration: 50, yoyo: true });
        this.createBulletTrail(bulletContainer);
    }
    
    drawBlueEnergyBolt(g, level) {
        const size = 8 + level * 2;
        g.fillStyle(0x0088ff, 0.3); g.fillCircle(0, 0, size * 1.5);
        g.fillStyle(0x00aaff); g.fillEllipse(0, 0, size, size * 1.5);
        g.fillStyle(0xffffff, 0.8); g.fillCircle(0, 0, size * 0.4);
    }
    
    drawCyanPlasma(g, level) {
        const size = 12 + level;
        g.fillStyle(0x00ffff, 0.2); g.fillCircle(0, 0, size * 2);
        g.fillStyle(0x00e5ff); g.fillEllipse(0, 0, size * 1.2, size * 1.8);
        g.fillStyle(0x88ffff, 0.8); g.fillEllipse(0, 0, size * 0.6, size);
        g.fillStyle(0xffffff); g.fillCircle(0, 0, size * 0.3);
    }
    
    drawGoldenRocket(g, level) {
        const size = 15 + level;
        g.fillStyle(0xffd700, 0.3); g.fillCircle(0, 0, size * 2);
        g.fillStyle(0xffc107); g.beginPath(); g.moveTo(0, -size);
        g.lineTo(size * 0.5, size * 0.3); g.lineTo(size * 0.3, size);
        g.lineTo(-size * 0.3, size); g.lineTo(-size * 0.5, size * 0.3); g.closePath(); g.fill();
        g.fillStyle(0xffe082, 0.8); g.beginPath(); g.moveTo(0, -size * 0.8);
        g.lineTo(size * 0.25, size * 0.2); g.lineTo(-size * 0.25, size * 0.2); g.closePath(); g.fill();
        g.fillStyle(0xff6600); g.beginPath(); g.moveTo(-size * 0.2, size);
        g.lineTo(0, size * 1.5); g.lineTo(size * 0.2, size); g.closePath(); g.fill();
        g.fillStyle(0xffff00, 0.8); g.beginPath(); g.moveTo(-size * 0.1, size);
        g.lineTo(0, size * 1.3); g.lineTo(size * 0.1, size); g.closePath(); g.fill();
    }
    
    createBulletTrail(bullet) {
        this.time.addEvent({ delay: 30, callback: () => {
            if (!bullet.active) return;
            const trail = this.add.circle(bullet.x, bullet.y, bullet.trailSize || 3, bullet.trailColor || 0x00ffff, 0.6);
            this.tweens.add({ targets: trail, alpha: 0, scale: 0.3, duration: 200, onComplete: () => trail.destroy() });
        }, callbackScope: this, repeat: 30 });
    }
    
    update(time, delta) {
        this.gameTime = time;
        this.bubbles.forEach(bubble => {
            bubble.sprite.y -= bubble.speed * delta / 1000;
            bubble.phase += delta * 0.003 * bubble.wobbleSpeed;
            bubble.sprite.x = bubble.startX + Math.sin(bubble.phase) * bubble.wobbleAmount;
            if (bubble.sprite.y < -10) { bubble.sprite.y = this.cameras.main.height + 10; bubble.startX = Math.random() * this.cameras.main.width; bubble.sprite.x = bubble.startX; }
        });
        this.lightParticles.forEach(particle => {
            particle.sprite.x += particle.speedX * delta / 1000;
            particle.sprite.y += particle.speedY * delta / 1000;
            particle.phase += delta * 0.002 * particle.pulseSpeed;
            particle.sprite.alpha = 0.15 + Math.sin(particle.phase) * 0.1;
            const width = this.cameras.main.width; const height = this.cameras.main.height;
            if (particle.sprite.x < 0) particle.sprite.x = width;
            if (particle.sprite.x > width) particle.sprite.x = 0;
            if (particle.sprite.y < 0) particle.sprite.y = height;
            if (particle.sprite.y > height) particle.sprite.y = 0;
        });
        this.updateBullets(delta); this.checkCollisions(); this.updateCoinDisplay();
    }
    
    updateCoinDisplay() {
        const target = GameState.coins; const current = this.coinDisplayValue;
        if (Math.abs(target - current) > 1) { this.coinDisplayValue += (target - current) * 0.1; document.getElementById('coin-value').textContent = Math.round(this.coinDisplayValue); }
        else if (current !== target) { this.coinDisplayValue = target; document.getElementById('coin-value').textContent = target; }
    }
    
    animateCoinChange(amount) {
        const coinDisplay = document.getElementById('coin-display');
        if (amount > 0) { coinDisplay.classList.add('coin-gain'); setTimeout(() => coinDisplay.classList.remove('coin-gain'), 300); }
        else { coinDisplay.classList.add('coin-loss'); setTimeout(() => coinDisplay.classList.remove('coin-loss'), 300); }
    }
    
    updateBullets(delta) {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.x += bullet.velocityX * delta / 1000;
            bullet.y += bullet.velocityY * delta / 1000;
            if (bullet.x < -50 || bullet.x > width + 50 || bullet.y < -50 || bullet.y > height + 50) { this.removeBullet(bullet); }
        }
    }
    
    // Collision validation callback - checks hit cooldown and velocity
    validateCollision(bullet, fish) {
        if (!bullet.active || !fish.active) return false;
        const now = this.time.now;
        // Check hit cooldown (100ms) to prevent double-hit registration
        if (fish.hitCooldown && fish.hitCooldown > now) return false;
        // Check bullet velocity (min 50px/s) before registering hit
        const velocity = Math.abs(bullet.velocityX || 0) + Math.abs(bullet.velocityY || 0);
        if (velocity < 50) return false;
        // Manual distance check for precise collision validation
        const dx = bullet.x - fish.x;
        const dy = bullet.y - fish.y;
        const fishConfig = PROBABILITY_TABLE.fishTypes[fish.fishType];
        const hitRadius = fishConfig.hitRadius || fishConfig.size * 0.7;
        if (dx * dx + dy * dy > hitRadius * hitRadius) return false;
        return true;
    }
    
    // Physics overlap callback - handles the actual hit
    onBulletHitFish(bullet, fish) {
        if (!bullet.active || !fish.active) return;
        // Set hit cooldown
        fish.hitCooldown = this.time.now + 100;
        // Add screen shake for feedback (small shake)
        this.cameras.main.shake(60, 0.005);
        // Handle capture logic
        this.handleCapture(bullet, fish);
    }
    
    checkCollisions() {
        // Physics overlap handles collisions now, but keep manual check as fallback
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet.active) continue;
            for (let j = this.fish.length - 1; j >= 0; j--) {
                const fish = this.fish[j];
                if (!fish.active) continue;
                if (fish.hitCooldown && fish.hitCooldown > this.time.now) continue;
                const distance = Phaser.Math.Distance.Between(bullet.x, bullet.y, fish.x, fish.y);
                const fishConfig = PROBABILITY_TABLE.fishTypes[fish.fishType];
                const hitRadius = fishConfig.hitRadius || fishConfig.size * 0.7;
                const bulletRadius = 12 + (bullet.bulletLevel || 1) * 3;
                if (distance < hitRadius + bulletRadius) {
                    fish.hitCooldown = this.time.now + 100;
                    this.cameras.main.shake(60, 0.005);
                    this.handleCapture(bullet, fish);
                    return;
                }
            }
        }
    }

    handleCapture(bullet, fish) {
        const fishConfig = PROBABILITY_TABLE.fishTypes[fish.fishType];
        let captureChance = bullet.isAutoTarget ? 1.0 : calculateCaptureChance(fish.fishType, bullet.bulletLevel);
        const roll = Math.random(); const captured = roll < captureChance;
        if (captured) {
            const bulletCost = bullet.isFree ? 0 : PROBABILITY_TABLE.baseBulletCost * bullet.bulletLevel;
            const reward = bulletCost > 0 ? bulletCost * fish.multiplier : fish.multiplier * 10;
            GameState.coins += reward; GameState.totalWon += reward;
            this.showCaptureEffect(fish.x, fish.y, reward, fishConfig.color);
            this.animateCoinChange(reward);
            if (fish.isSpecial) this.triggerBonus();
            this.removeFish(fish);
        } else { this.showMissEffect(fish.x, fish.y); }
        this.removeBullet(bullet); this.updateUI();
    }
    
    showCaptureEffect(x, y, reward, color) {
        const flash = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.1);
        this.tweens.add({ targets: flash, alpha: 0, duration: 100, onComplete: () => flash.destroy() });
        for (let i = 0; i < 16; i++) {
            const particle = this.add.circle(x, y, 5 + Math.random() * 5, color);
            const angle = (i / 16) * Math.PI * 2; const distance = 60 + Math.random() * 40;
            this.tweens.add({ targets: particle, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, alpha: 0, scale: 0, duration: 600, ease: 'Power2', onComplete: () => particle.destroy() });
        }
        const coinPop = this.add.circle(x, y - 20, 12, 0xffd700);
        this.tweens.add({ targets: coinPop, y: y - 60, alpha: 0, scale: 1.5, duration: 500, ease: 'Power2', onComplete: () => coinPop.destroy() });
        this.showFloatingText(x, y, '+' + reward, '#ffff00', 26);
    }
    
    showMissEffect(x, y) {
        const ripple = this.add.circle(x, y, 10, 0xffffff, 0.5);
        this.tweens.add({ targets: ripple, scale: 2, alpha: 0, duration: 300, onComplete: () => ripple.destroy() });
    }
    
    showFloatingText(x, y, text, color, size = 16) {
        const floatText = this.add.text(x, y, text, { fontSize: size + 'px', fontFamily: 'Orbitron, Arial', color: color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5);
        this.tweens.add({ targets: floatText, y: y - 70, alpha: 0, scale: 1.2, duration: 1200, ease: 'Power2', onComplete: () => floatText.destroy() });
    }
    
    removeFish(fish) {
        const index = this.fish.indexOf(fish); if (index > -1) this.fish.splice(index, 1);
        if (fish.multiplierText) fish.multiplierText.destroy();
        this.tweens.killTweensOf(fish); this.tweens.killTweensOf(fish.bodyGraphics);
        this.tweens.killTweensOf(fish.tailGraphics); this.tweens.killTweensOf(fish.finGraphics);
        if (fish.glowGraphics) this.tweens.killTweensOf(fish.glowGraphics);
        fish.destroy();
    }
    
    removeBullet(bullet) {
        const index = this.bullets.indexOf(bullet); if (index > -1) this.bullets.splice(index, 1);
        bullet.destroy();
    }
    
    triggerBonus() {
        const bonusType = selectBonusFeature();
        const bonusConfig = PROBABILITY_TABLE.bonusFeatures[bonusType];
        GameState.isInBonusMode = true; GameState.bonusType = bonusType;
        const indicator = document.getElementById('bonus-indicator');
        indicator.textContent = bonusConfig.name; indicator.classList.add('active');
        setTimeout(() => indicator.classList.remove('active'), 2000);
        switch (bonusType) {
            case 'lockAndFreeze': this.executeLockAndFreeze(); break;
            case 'chainLightning': this.executeChainLightning(); break;
            case 'fullScreenClear': this.executeFullScreenClear(); break;
        }
    }
    
    executeLockAndFreeze() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        this.fish.forEach(fish => { this.tweens.killTweensOf(fish); this.tweens.killTweensOf(fish.bodyGraphics); this.tweens.killTweensOf(fish.tailGraphics); });
        const freezeOverlay = this.add.graphics();
        freezeOverlay.fillStyle(0x00bfff, 0.15); freezeOverlay.fillRect(0, 0, width, height);
        freezeOverlay.lineStyle(8, 0x87ceeb, 0.6); freezeOverlay.strokeRect(10, 10, width - 20, height - 20);
        for (let i = 0; i < 30; i++) {
            const snowflake = this.add.text(Math.random() * width, -20, '*', { fontSize: (12 + Math.random() * 16) + 'px', color: '#ffffff' });
            this.tweens.add({ targets: snowflake, y: height + 20, x: snowflake.x + (Math.random() - 0.5) * 100, duration: 3000 + Math.random() * 2000, onComplete: () => snowflake.destroy() });
        }
        this.fish.forEach(fish => {
            const crystal = this.add.graphics();
            crystal.fillStyle(0x87ceeb, 0.5); crystal.fillCircle(fish.x, fish.y, fish.fishSize * 0.6);
            crystal.lineStyle(2, 0xffffff, 0.8); crystal.strokeCircle(fish.x, fish.y, fish.fishSize * 0.6);
            this.time.delayedCall(5000, () => crystal.destroy());
        });
        const freezeText = this.add.text(width / 2, 80, 'LOCK & FREEZE!', { fontSize: '32px', fontFamily: 'Orbitron, Arial Black', color: '#00ffff', stroke: '#0066aa', strokeThickness: 4 }).setOrigin(0.5);
        this.tweens.add({ targets: freezeText, alpha: 0, y: 60, duration: 2000, onComplete: () => freezeText.destroy() });
        let shotsFired = 0; const maxShots = 10;
        this.autoTargetTimer = this.time.addEvent({ delay: 400, callback: () => {
            if (shotsFired >= maxShots || this.fish.length === 0) { this.time.delayedCall(500, () => { freezeOverlay.destroy(); this.endBonus(); }); return; }
            let targetFish = this.fish[0];
            this.fish.forEach(fish => { if (fish.multiplier > targetFish.multiplier) targetFish = fish; });
            if (targetFish) {
                const target = this.add.graphics();
                target.lineStyle(3, 0x00ffff, 0.8); target.strokeCircle(targetFish.x, targetFish.y, 30); target.strokeCircle(targetFish.x, targetFish.y, 20);
                this.tweens.add({ targets: target, alpha: 0, scale: 1.5, duration: 300, onComplete: () => target.destroy() });
                this.fireBullet(targetFish.x, targetFish.y, 5, true); shotsFired++;
            }
        }, callbackScope: this, repeat: maxShots });
    }

    executeChainLightning() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const lightningOverlay = this.add.graphics();
        lightningOverlay.fillStyle(0x001133, 0.3); lightningOverlay.fillRect(0, 0, width, height);
        const lightningText = this.add.text(width / 2, 80, 'CHAIN LIGHTNING!', { fontSize: '32px', fontFamily: 'Orbitron, Arial Black', color: '#00ffff', stroke: '#0066ff', strokeThickness: 4 }).setOrigin(0.5);
        const eligibleFish = this.fish.filter(f => f.multiplier < 15);
        if (eligibleFish.length > 0) {
            let prevX = width / 2; let prevY = height - 50;
            eligibleFish.forEach((fish, index) => {
                this.time.delayedCall(index * 150, () => {
                    this.drawLightning(prevX, prevY, fish.x, fish.y);
                    this.createSparkParticles(fish.x, fish.y);
                    const reward = fish.multiplier * 10;
                    GameState.coins += reward; GameState.totalWon += reward;
                    this.showFloatingText(fish.x, fish.y, '+' + reward, '#00ffff', 20);
                    this.animateCoinChange(reward);
                    prevX = fish.x; prevY = fish.y;
                    this.removeFish(fish); this.updateUI();
                });
            });
        }
        this.time.delayedCall(eligibleFish.length * 150 + 1000, () => { lightningOverlay.destroy(); lightningText.destroy(); this.endBonus(); });
    }
    
    createSparkParticles(x, y) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2; const speed = 80 + Math.random() * 60;
            const spark = this.add.circle(x, y, 3, 0x00ffff);
            this.tweens.add({ targets: spark, x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed, alpha: 0, duration: 300 + Math.random() * 200, ease: 'Power2', onComplete: () => spark.destroy() });
        }
    }
    
    drawLightning(x1, y1, x2, y2) {
        const g = this.add.graphics();
        g.lineStyle(4, 0x00ffff, 0.9); this.drawLightningPath(g, x1, y1, x2, y2, 30);
        g.lineStyle(8, 0x00ffff, 0.3); this.drawLightningPath(g, x1, y1, x2, y2, 25);
        g.lineStyle(2, 0xffffff, 1); this.drawLightningPath(g, x1, y1, x2, y2, 20);
        this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
    }
    
    drawLightningPath(g, x1, y1, x2, y2, jitter) {
        g.beginPath(); g.moveTo(x1, y1);
        const segments = 6;
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const midX = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter;
            const midY = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter;
            g.lineTo(midX, midY);
        }
        g.lineTo(x2, y2); g.strokePath();
    }
    
    executeFullScreenClear() {
        const width = this.cameras.main.width; const height = this.cameras.main.height;
        const centerX = width / 2; const centerY = height / 2;
        const flash = this.add.rectangle(centerX, centerY, width, height, 0xffd700, 0.9);
        this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
        for (let i = 0; i < 4; i++) {
            this.time.delayedCall(i * 100, () => {
                const ring = this.add.graphics();
                ring.lineStyle(4, 0xffd700, 0.8); ring.strokeCircle(centerX, centerY, 20);
                this.tweens.add({ targets: ring, scaleX: 15, scaleY: 15, alpha: 0, duration: 600, ease: 'Power2', onComplete: () => ring.destroy() });
            });
        }
        const goldenOverlay = this.add.graphics();
        goldenOverlay.fillStyle(0xffd700, 0.2); goldenOverlay.fillRect(0, 0, width, height);
        const clearText = this.add.text(centerX, 80, 'FULL SCREEN CLEAR!', { fontSize: '32px', fontFamily: 'Orbitron, Arial Black', color: '#ffd700', stroke: '#8b4513', strokeThickness: 4 }).setOrigin(0.5);
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2; const distance = 100 + Math.random() * 200;
            const particle = this.add.circle(centerX, centerY, 4 + Math.random() * 6, Math.random() > 0.5 ? 0xffd700 : 0xffaa00);
            this.tweens.add({ targets: particle, x: centerX + Math.cos(angle) * distance, y: centerY + Math.sin(angle) * distance, alpha: 0, duration: 800, ease: 'Power2', onComplete: () => particle.destroy() });
        }
        let totalValue = 0;
        const fishToCapture = [...this.fish];
        fishToCapture.forEach(fish => { totalValue += fish.multiplier * 10; });
        const reward = Math.floor(totalValue * 0.8);
        GameState.coins += reward; GameState.totalWon += reward;
        fishToCapture.forEach((fish, index) => {
            this.time.delayedCall(index * 50, () => {
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const particle = this.add.circle(fish.x, fish.y, 4, 0xffd700);
                    this.tweens.add({ targets: particle, x: fish.x + Math.cos(angle) * 40, y: fish.y + Math.sin(angle) * 40, alpha: 0, duration: 300, onComplete: () => particle.destroy() });
                }
                this.removeFish(fish);
            });
        });
        this.time.delayedCall(500, () => { this.showFloatingText(centerX, centerY, '+' + reward, '#ffd700', 36); this.animateCoinChange(reward); });
        this.time.delayedCall(2000, () => { goldenOverlay.destroy(); clearText.destroy(); this.endBonus(); this.updateUI(); });
    }
    
    endBonus() {
        GameState.isInBonusMode = false; GameState.bonusType = null;
        if (this.autoTargetTimer) { this.autoTargetTimer.destroy(); this.autoTargetTimer = null; }
    }
    
    setupUIListeners() {
        const buttons = document.querySelectorAll('.bullet-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const level = parseInt(btn.dataset.level);
                GameState.bulletLevel = level;
                GameState.bulletCost = PROBABILITY_TABLE.baseBulletCost * level;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => { btn.style.transform = ''; }, 100);
                this.updateUI();
            });
        });
    }
    
    updateUI() {
        document.getElementById('bullet-level').textContent = GameState.bulletLevel;
        document.getElementById('bullet-cost').textContent = GameState.bulletCost;
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-canvas',
    backgroundColor: '#001428',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: GameScene
};

const game = new Phaser.Game(config);
