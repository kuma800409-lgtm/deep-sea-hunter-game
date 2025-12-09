// Deep Sea Hunter V2.0 - Multiplayer Client
// Phaser 3 + Socket.IO

// Game state
const GameState = {
    socket: null,
    playerId: null,
    roomId: null,
    seat: null,
    isHost: false,
    gameStarted: false,
    players: {},
    fish: {},
    bullets: {},
    bulletLevel: 1,
    autoMode: false,
    autoModeEndTime: 0,
    viewRotation: 0  // Rotation in degrees based on seat position
};

// Seat to rotation mapping - each player sees themselves at bottom
const ROTATION_MAP = {
    'bottom': 0,      // No rotation needed
    'left': 90,       // 90° clockwise
    'top': 180,       // 180°
    'right': 270      // 270° clockwise (or -90°)
};

// Seat order for relative position calculations (clockwise)
const SEAT_ORDER = ['bottom', 'left', 'top', 'right'];

// Get relative seat position from current player's perspective
// Returns where playerSeat appears from the perspective of mySeat
function getRelativeSeat(playerSeat, mySeat) {
    if (!playerSeat || !mySeat) return playerSeat;
    
    const playerIndex = SEAT_ORDER.indexOf(playerSeat);
    const myIndex = SEAT_ORDER.indexOf(mySeat);
    
    if (playerIndex === -1 || myIndex === -1) return playerSeat;
    
    // Calculate relative position (how many steps from my seat to player's seat)
    const diff = (playerIndex - myIndex + SEAT_ORDER.length) % SEAT_ORDER.length;
    
    // Map diff to relative position: 0=bottom (me), 1=left, 2=top, 3=right
    return SEAT_ORDER[diff];
}

// Phaser configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 800,  // Square canvas for proper rotation
    parent: 'game-canvas',
    backgroundColor: '#001a33',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let game;
let scene;

// Cannon positions for each seat (adjusted for 800x800 square canvas)
const CANNON_POSITIONS = {
    bottom: { x: 400, y: 770, angle: -90 },
    top: { x: 400, y: 30, angle: 90 },
    left: { x: 30, y: 400, angle: 0 },
    right: { x: 770, y: 400, angle: 180 }
};

// Fish type colors
const FISH_COLORS = {
    small: { body: 0x00e5ff, glow: 0x27c8ff },
    medium: { body: 0xff7043, glow: 0xff6b35 },
    large: { body: 0x9c27b0, glow: 0xff3da8 },
    boss: { body: 0xc62828, glow: 0xff3da8 },
    special: { body: 0xffc107, glow: 0xffc857 }
};

// Fish sizes
const FISH_SIZES = {
    small: 45,
    medium: 70,
    large: 110,
    boss: 160,
    special: 80
};

function preload() {
    scene = this;
    // Create textures procedurally
}

function create() {
    scene = this;
    
    // Create background layers (parallax)
    createBackground();
    
    // Create groups
    this.fishGroup = this.add.group();
    this.bulletGroup = this.add.group();
    this.cannonGroup = this.add.group();
    this.effectsGroup = this.add.group();
    
    // Create particle textures
    createParticleTextures();
    
    // Input handling
    this.input.on('pointerdown', handleClick);
    this.input.on('pointermove', handlePointerMove);
    
    // Initialize socket connection
    initSocket();
    
    // Setup UI event listeners
    setupUIListeners();
}

function update(time, delta) {
    if (!GameState.gameStarted) return;
    
    // Update fish animations
    updateFishAnimations(delta);
    
    // Update bullet positions
    updateBullets(delta);
    
    // Update background parallax
    updateParallax(delta);
    
    // Update auto-mode timer display
    if (GameState.autoMode) {
        const remaining = Math.max(0, GameState.autoModeEndTime - Date.now());
        const autoBtn = document.getElementById('auto-btn');
        if (remaining > 0) {
            autoBtn.textContent = `AUTO (${Math.ceil(remaining / 1000)}s)`;
        } else {
            GameState.autoMode = false;
            autoBtn.textContent = 'AUTO (100)';
            autoBtn.classList.remove('active');
        }
    }
}

// ============== BACKGROUND (TOP-DOWN WATER VIEW) ==============

let backgroundLayers = [];

function createBackground() {
    // Layer 1: Deep ocean gradient (top-down view - darker blue)
    const gradient1 = scene.add.graphics();
    gradient1.fillGradientStyle(0x001a33, 0x002244, 0x001a33, 0x002244, 1);
    gradient1.fillRect(0, 0, 800, 800);
    gradient1.setDepth(-100);
    
    // Layer 2: Water surface patterns (top-down ripples)
    createWaterSurface();
    
    // Layer 3: Underwater shadows/depth patches
    const depthPatches = scene.add.graphics();
    depthPatches.setDepth(-90);
    depthPatches.fillStyle(0x000d1a, 0.3);
    // Random dark patches suggesting depth
    for (let i = 0; i < 6; i++) {
        const x = 100 + Math.random() * 600;
        const y = 100 + Math.random() * 600;
        depthPatches.fillEllipse(x, y, 80 + Math.random() * 60, 50 + Math.random() * 40);
    }
    backgroundLayers.push({ graphics: depthPatches, speed: 0.1 });
    
    // Layer 4: Caustic light overlay (top-down light patterns)
    createCausticLight();
    
    // Layer 5: Floating debris/particles
    createBubbles();
    
    // Layer 6: Water ripple animations
    createWaterRipples();
}

function createWaterSurface() {
    // Top-down water surface with subtle wave patterns
    scene.waterSurface = scene.add.graphics();
    scene.waterSurface.setDepth(-95);
    scene.waterSurface.setBlendMode(Phaser.BlendModes.ADD);
    scene.waterTime = 0;
}

function createWaterRipples() {
    // Animated ripple circles that expand and fade
    scene.ripples = [];
    scene.rippleTimer = 0;
}

function spawnRipple(x, y, color = 0x00ffff, maxRadius = 40) {
    const ripple = scene.add.graphics();
    ripple.setDepth(-80);
    ripple.x = x;
    ripple.y = y;
    ripple.radius = 5;
    ripple.maxRadius = maxRadius;
    ripple.alpha = 0.5;
    ripple.color = color;
    scene.ripples.push(ripple);
}

function updateWaterSurface() {
    if (!scene.waterSurface) return;
    
    scene.waterTime += 0.02;
    scene.waterSurface.clear();
    
    // Draw animated wave patterns (top-down view)
    for (let i = 0; i < 15; i++) {
        const x = (i * 60 + scene.waterTime * 20) % 900 - 50;
        const y = 400 + Math.sin(scene.waterTime + i * 0.5) * 150;
        const alpha = 0.03 + Math.sin(scene.waterTime * 1.5 + i) * 0.02;
        
        scene.waterSurface.fillStyle(0x00aaff, alpha);
        scene.waterSurface.fillEllipse(x, y, 100, 40);
    }
}

function updateRipples(delta) {
    if (!scene.ripples) return;
    
    // Spawn random ambient ripples
    scene.rippleTimer += delta;
    if (scene.rippleTimer > 2000) {
        scene.rippleTimer = 0;
        spawnRipple(100 + Math.random() * 600, 100 + Math.random() * 600, 0x00ffff, 30);
    }
    
    // Update existing ripples
    for (let i = scene.ripples.length - 1; i >= 0; i--) {
        const ripple = scene.ripples[i];
        ripple.radius += delta * 0.05;
        ripple.alpha -= delta * 0.001;
        
        ripple.clear();
        ripple.lineStyle(2, ripple.color, ripple.alpha);
        ripple.strokeCircle(0, 0, ripple.radius);
        
        if (ripple.radius > ripple.maxRadius || ripple.alpha <= 0) {
            ripple.destroy();
            scene.ripples.splice(i, 1);
        }
    }
}

function createCausticLight() {
    scene.causticGraphics = scene.add.graphics();
    scene.causticGraphics.setDepth(-60);
    scene.causticGraphics.setBlendMode(Phaser.BlendModes.ADD);
    scene.causticTime = 0;
}

function updateCaustics() {
    if (!scene.causticGraphics) return;
    
    scene.causticTime += 0.02;
    scene.causticGraphics.clear();
    
    // Draw animated caustic patterns
    for (let i = 0; i < 20; i++) {
        const x = (i * 50 + scene.causticTime * 30) % 900 - 50;
        const y = 400 + Math.sin(scene.causticTime + i) * 50;
        const alpha = 0.05 + Math.sin(scene.causticTime * 2 + i) * 0.03;
        
        scene.causticGraphics.fillStyle(0x00ffff, alpha);
        scene.causticGraphics.fillEllipse(x, y, 60, 30);
    }
}

function createBubbles() {
    scene.bubbles = [];
    for (let i = 0; i < 30; i++) {
        const bubble = scene.add.circle(
            Math.random() * 800,
            Math.random() * 800,
            2 + Math.random() * 4,
            0xffffff,
            0.3
        );
        bubble.setDepth(-50);
        bubble.speedY = 20 + Math.random() * 30;
        bubble.wobble = Math.random() * Math.PI * 2;
        scene.bubbles.push(bubble);
    }
}

function createLightRays() {
    // Top-down view: light spots on water surface instead of rays
    const lightSpots = scene.add.graphics();
    lightSpots.setDepth(-85);
    lightSpots.setBlendMode(Phaser.BlendModes.ADD);
    
    // Draw scattered light spots (sun reflection on water)
    for (let i = 0; i < 8; i++) {
        const x = 50 + i * 100;
        const y = 50 + (i % 3) * 200;
        lightSpots.fillStyle(0xffffff, 0.05);
        lightSpots.fillEllipse(x, y, 60, 40);
        lightSpots.fillStyle(0x00ffff, 0.03);
        lightSpots.fillEllipse(x + 20, y + 30, 80, 50);
    }
    
    // Animate light spots
    scene.tweens.add({
        targets: lightSpots,
        alpha: { from: 0.4, to: 0.8 },
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

function updateParallax(delta) {
    // Update floating particles (bubbles from below in top-down view)
    if (scene.bubbles) {
        scene.bubbles.forEach(bubble => {
            // In top-down view, particles drift slowly in random directions
            bubble.x += Math.sin(bubble.wobble) * 0.3;
            bubble.y += Math.cos(bubble.wobble * 0.7) * 0.2;
            bubble.wobble += 0.03;
            
            // Wrap around screen
            if (bubble.x < -10) bubble.x = 810;
            if (bubble.x > 810) bubble.x = -10;
            if (bubble.y < -10) bubble.y = 610;
            if (bubble.y > 610) bubble.y = -10;
        });
    }
    
    // Update water surface patterns
    updateWaterSurface();
    
    // Update water ripples
    updateRipples(delta);
    
    // Update caustics
    updateCaustics();
}

// ============== PARTICLE TEXTURES ==============

function createParticleTextures() {
    // Bullet particle
    const bulletTexture = scene.add.graphics();
    bulletTexture.fillStyle(0x00ffff);
    bulletTexture.fillCircle(4, 4, 4);
    bulletTexture.generateTexture('bulletParticle', 8, 8);
    bulletTexture.destroy();
    
    // Capture particle
    const captureTexture = scene.add.graphics();
    captureTexture.fillStyle(0xffd700);
    captureTexture.fillCircle(6, 6, 6);
    captureTexture.generateTexture('captureParticle', 12, 12);
    captureTexture.destroy();
    
    // Spark particle
    const sparkTexture = scene.add.graphics();
    sparkTexture.fillStyle(0xffffff);
    sparkTexture.fillCircle(3, 3, 3);
    sparkTexture.generateTexture('sparkParticle', 6, 6);
    sparkTexture.destroy();
}

// ============== SOCKET CONNECTION ==============

function initSocket() {
    // Connect to server - use configured URL or same origin
    const serverUrl = window.SERVER_URL || window.location.origin;
    GameState.socket = io(serverUrl);
    
    const socket = GameState.socket;
    
    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
    });
    
    // Room events
    socket.on('joined_room', (data) => {
        console.log('Joined room:', data);
        GameState.playerId = data.playerId;
        GameState.roomId = data.roomId;
        GameState.seat = data.seat;
        GameState.players = data.players;
        
        // Set view rotation based on seat position
        GameState.viewRotation = ROTATION_MAP[data.seat] || 0;
        console.log('Seat:', data.seat, 'View rotation:', GameState.viewRotation);
        
        // Check if host
        for (const [id, player] of Object.entries(data.players)) {
            if (player.isHost && id === GameState.playerId) {
                GameState.isHost = true;
            }
        }
        
        updateLobbyUI();
    });
    
    socket.on('player_joined', (data) => {
        console.log('Player joined:', data);
        GameState.players = data.players;
        updateLobbyUI();
    });
    
    socket.on('player_left', (data) => {
        console.log('Player left:', data);
        GameState.players = data.players;
        
        // Remove player's cannon and HUD
        if (GameState.gameStarted) {
            removePlayerVisuals(data.playerId);
        }
        
        updateLobbyUI();
    });
    
    socket.on('player_ready', (data) => {
        GameState.players = data.players;
        updateLobbyUI();
    });
    
    socket.on('new_host', (data) => {
        GameState.isHost = (data.hostId === GameState.playerId);
        updateLobbyUI();
    });
    
    // Game events
    socket.on('game_start', (data) => {
        console.log('Game started:', data);
        GameState.gameStarted = true;
        GameState.players = data.players;
        
        // Hide lobby, show game UI
        document.getElementById('lobby-overlay').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
        
        // Apply camera rotation based on player's seat
        applyViewRotation();
        
        // Create cannons for all players
        createAllCannons();
        
        // Create HUD for all players
        createAllHUDs();
    });
    
    // Fish events
    socket.on('fish_spawn', (data) => {
        spawnFish(data);
    });
    
    socket.on('fish_escaped', (data) => {
        removeFish(data.fishId);
    });
    
    socket.on('fish_captured', (data) => {
        handleFishCaptured(data);
    });
    
    // Bullet events
    socket.on('player_shot', (data) => {
        createBullet(data);
        updatePlayerCoins(data.playerId, data.newCoins);
    });
    
    socket.on('bullet_miss', (data) => {
        removeBullet(data.bulletId);
    });
    
    // Sync events
    socket.on('game_sync', (data) => {
        syncGameState(data);
    });
    
    // Auto-mode events
    socket.on('auto_mode_enabled', (data) => {
        GameState.autoMode = true;
        GameState.autoModeEndTime = Date.now() + data.duration;
        document.getElementById('auto-btn').classList.add('active');
        updatePlayerCoins(GameState.playerId, data.newCoins);
    });
    
    socket.on('auto_mode_disabled', () => {
        GameState.autoMode = false;
        document.getElementById('auto-btn').classList.remove('active');
        document.getElementById('auto-btn').textContent = 'AUTO (100)';
    });
    
    socket.on('player_auto_mode', (data) => {
        // Visual indicator for other players in auto mode
        const cannon = scene.cannons ? scene.cannons[data.playerId] : null;
        if (cannon) {
            if (data.enabled) {
                cannon.setTint(0xff00ff);
            } else {
                cannon.clearTint();
            }
        }
    });
    
    // Bonus events
    socket.on('bonus_triggered', (data) => {
        showBonusAnnouncement(data.bonusType, data.playerId);
    });
    
    socket.on('chain_lightning', (data) => {
        showChainLightning(data);
        updatePlayerCoins(data.playerId, data.newCoins);
    });
    
    socket.on('full_screen_clear', (data) => {
        showFullScreenClear(data);
        updatePlayerCoins(data.playerId, data.newCoins);
    });
    
    socket.on('bonus_ended', (data) => {
        // Bonus ended notification
    });
    
    // Error handling
    socket.on('error', (data) => {
        console.error('Server error:', data.message);
        showErrorMessage(data.message);
    });
    
    socket.on('bullet_level_changed', (data) => {
        GameState.bulletLevel = data.level;
        updateBulletLevelUI();
    });
}

function updateConnectionStatus(connected) {
    const status = document.getElementById('connection-status');
    if (connected) {
        status.textContent = 'CONNECTED';
        status.className = 'connected';
    } else {
        status.textContent = 'DISCONNECTED';
        status.className = 'disconnected';
    }
}

// ============== VIEW ROTATION ==============

function applyViewRotation() {
    if (!scene || !scene.cameras || !scene.cameras.main) return;
    
    // Apply camera rotation based on player's seat
    const rotationRad = Phaser.Math.DegToRad(GameState.viewRotation);
    scene.cameras.main.setRotation(rotationRad);
    
    console.log('Applied view rotation:', GameState.viewRotation, 'degrees');
}

// Transform screen coordinates to world coordinates (accounting for camera rotation)
function screenToWorld(screenX, screenY) {
    if (!scene || !scene.cameras || !scene.cameras.main) {
        return { x: screenX, y: screenY };
    }
    
    const camera = scene.cameras.main;
    const worldPoint = camera.getWorldPoint(screenX, screenY);
    return { x: worldPoint.x, y: worldPoint.y };
}

// Get the rotated cannon position for the current player (always appears at bottom of their view)
function getRotatedCannonPosition(seat) {
    // In world coordinates, cannons are at fixed positions
    // But visually, each player sees their cannon at the bottom
    return CANNON_POSITIONS[seat];
}

// ============== LOBBY UI ==============

function setupUIListeners() {
    // Join button
    document.getElementById('join-btn').addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value || 'Player';
        const roomCode = document.getElementById('room-code').value || null;
        
        GameState.socket.emit('join_room', {
            playerName: playerName,
            roomId: roomCode
        });
    });
    
    // Ready button
    document.getElementById('ready-btn').addEventListener('click', () => {
        GameState.socket.emit('ready');
    });
    
    // Start button (host only)
    document.getElementById('start-btn').addEventListener('click', () => {
        GameState.socket.emit('start_game');
    });
    
    // Bullet level buttons
    document.querySelectorAll('.control-btn[data-level]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (GameState.autoMode) return; // Can't change level in auto mode
            
            const level = parseInt(btn.dataset.level);
            GameState.bulletLevel = level;
            GameState.socket.emit('change_bullet', { level: level });
            
            // Update UI
            document.querySelectorAll('.control-btn[data-level]').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
        });
    });
    
    // Auto mode button
    document.getElementById('auto-btn').addEventListener('click', () => {
        if (GameState.autoMode) {
            GameState.socket.emit('disable_auto');
        } else {
            GameState.socket.emit('enable_auto');
        }
    });
}

function updateLobbyUI() {
    const playersContainer = document.getElementById('players-container');
    const playersList = document.getElementById('players-list');
    const lobbyButtons = document.getElementById('lobby-buttons');
    const startBtn = document.getElementById('start-btn');
    const roomInfo = document.getElementById('room-info');
    const joinBtn = document.getElementById('join-btn');
    
    if (GameState.roomId) {
        // Show players list
        playersList.style.display = 'block';
        lobbyButtons.style.display = 'block';
        joinBtn.style.display = 'none';
        
        // Update room info
        roomInfo.textContent = `Room: ${GameState.roomId} | Your seat: ${GameState.seat}`;
        
        // Show start button for host
        startBtn.style.display = GameState.isHost ? 'inline-block' : 'none';
        
        // Render players
        playersContainer.innerHTML = '';
        for (const [id, player] of Object.entries(GameState.players)) {
            const div = document.createElement('div');
            div.className = 'player-item' + (player.ready ? ' ready' : '');
            div.innerHTML = `
                <span>${player.name} ${player.isHost ? '(Host)' : ''} ${id === GameState.playerId ? '(You)' : ''}</span>
                <span class="player-seat">${player.seat.toUpperCase()}</span>
                <span class="player-status">${player.ready ? 'READY' : 'WAITING'}</span>
            `;
            playersContainer.appendChild(div);
        }
    }
}

function updateBulletLevelUI() {
    document.querySelectorAll('.control-btn[data-level]').forEach(btn => {
        const level = parseInt(btn.dataset.level);
        if (level === GameState.bulletLevel) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ============== CANNONS ==============

function createAllCannons() {
    scene.cannons = {};
    
    for (const [playerId, player] of Object.entries(GameState.players)) {
        createCannon(playerId, player.seat);
    }
}

function createCannon(playerId, seat) {
    const pos = CANNON_POSITIONS[seat];
    const isMe = playerId === GameState.playerId;
    
    // Create cannon container
    const cannon = scene.add.container(pos.x, pos.y);
    
    // Base platform
    const base = scene.add.graphics();
    base.fillStyle(0x333333);
    base.fillEllipse(0, 0, 60, 30);
    base.fillStyle(0x444444);
    base.fillEllipse(0, -5, 50, 20);
    cannon.add(base);
    
    // LED strip
    const ledStrip = scene.add.graphics();
    ledStrip.lineStyle(3, isMe ? 0x00ffff : 0xff00ff);
    ledStrip.strokeEllipse(0, 0, 55, 25);
    cannon.add(ledStrip);
    
    // Turret
    const turret = scene.add.graphics();
    turret.fillStyle(0x666666);
    turret.fillRoundedRect(-15, -40, 30, 45, 5);
    turret.fillStyle(0x888888);
    turret.fillRoundedRect(-10, -35, 20, 35, 3);
    cannon.add(turret);
    
    // Energy core
    const core = scene.add.circle(0, -20, 8, isMe ? 0x00ffff : 0xff00ff);
    cannon.add(core);
    
    // Barrel
    const barrel = scene.add.graphics();
    barrel.fillStyle(0x555555);
    barrel.fillRect(-8, -60, 16, 25);
    barrel.fillStyle(0x00ffff, 0.5);
    barrel.fillRect(-4, -58, 8, 20);
    cannon.add(barrel);
    
    // Set rotation based on seat
    cannon.setAngle(pos.angle + 90);
    cannon.setDepth(100);
    
    // Store reference
    scene.cannons[playerId] = cannon;
    
    // Animate LED
    scene.tweens.add({
        targets: ledStrip,
        alpha: { from: 0.5, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1
    });
    
    // Animate core
    scene.tweens.add({
        targets: core,
        scale: { from: 0.8, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

// ============== HUD ==============

function createAllHUDs() {
    const hudContainer = document.getElementById('hud');
    hudContainer.innerHTML = '';
    
    for (const [playerId, player] of Object.entries(GameState.players)) {
        // Get relative seat position from current player's perspective
        const relativeSeat = getRelativeSeat(player.seat, GameState.seat);
        
        const hud = document.createElement('div');
        hud.className = `player-hud ${relativeSeat}`;
        hud.id = `hud-${playerId}`;
        hud.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="player-coins" id="coins-${playerId}">${player.coins}</div>
        `;
        hudContainer.appendChild(hud);
    }
}

function updatePlayerCoins(playerId, coins) {
    const coinsEl = document.getElementById(`coins-${playerId}`);
    if (coinsEl) {
        coinsEl.textContent = coins;
    }
    
    // Update local state
    if (GameState.players[playerId]) {
        GameState.players[playerId].coins = coins;
    }
}

function removePlayerVisuals(playerId) {
    // Remove cannon
    if (scene.cannons && scene.cannons[playerId]) {
        scene.cannons[playerId].destroy();
        delete scene.cannons[playerId];
    }
    
    // Remove HUD
    const hud = document.getElementById(`hud-${playerId}`);
    if (hud) {
        hud.remove();
    }
}

// ============== FISH ==============

function spawnFish(data) {
    const { fishId, fishType, position, target, speed, multiplier, size, duration, direction } = data;
    
    // Create fish container
    const fish = scene.add.container(position.x, position.y);
    fish.fishId = fishId;
    fish.fishType = fishType;
    fish.multiplier = multiplier;
    fish.targetX = target.x;
    fish.targetY = target.y;
    fish.speed = speed;
    fish.direction = direction;
    
    const colors = FISH_COLORS[fishType];
    const fishSize = FISH_SIZES[fishType];
    
    // Shadow (top-down view - fish shadow below)
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillEllipse(8, 8, fishSize * 0.5, fishSize * 0.35);
    fish.add(shadow);
    fish.shadow = shadow;
    
    // Glow effect (top-down aura)
    const glow = scene.add.graphics();
    glow.fillStyle(colors.glow, 0.15);
    glow.fillEllipse(0, 0, fishSize * 0.7, fishSize * 0.5);
    fish.add(glow);
    fish.glow = glow;
    
    // Body (top-down view)
    const body = scene.add.graphics();
    drawFishBodyTopDown(body, fishType, colors, fishSize);
    fish.add(body);
    fish.body = body;
    
    // Fins (top-down view - side fins)
    const fins = scene.add.graphics();
    drawFishFinsTopDown(fins, fishType, colors, fishSize);
    fish.add(fins);
    fish.fins = fins;
    
    // Tail (top-down view)
    const tail = scene.add.graphics();
    drawFishTailTopDown(tail, fishType, colors, fishSize);
    fish.add(tail);
    fish.tail = tail;
    
    // Eyes (top-down view - two dots near head)
    const eyes = scene.add.graphics();
    drawFishEyesTopDown(eyes, fishType, fishSize);
    fish.add(eyes);
    
    // Multiplier text
    const multText = scene.add.text(0, -fishSize * 0.45, `${multiplier}x`, {
        fontSize: fishType === 'boss' ? '16px' : '12px',
        fontFamily: 'Orbitron',
        color: getMultiplierColor(multiplier),
        stroke: '#000',
        strokeThickness: 3
    });
    multText.setOrigin(0.5);
    fish.add(multText);
    
    // Calculate rotation based on movement direction
    const moveAngle = Math.atan2(target.y - position.y, target.x - position.x);
    fish.setRotation(moveAngle);
    fish.setDepth(50);
    
    // Store fish
    GameState.fish[fishId] = fish;
    scene.fishGroup.add(fish);
    
    // Movement tween
    scene.tweens.add({
        targets: fish,
        x: target.x,
        y: target.y,
        duration: duration,
        ease: 'Linear'
    });
    
    // Animations
    startFishAnimationsTopDown(fish, fishType);
    
    // Boss entrance effect
    if (fishType === 'boss') {
        showBossEntrance(fish);
    }
}

// TOP-DOWN FISH RENDERING FUNCTIONS

function drawFishBodyTopDown(g, type, colors, size) {
    g.clear();
    
    if (type === 'boss') {
        // Boss: Large torpedo shape with dorsal ridge
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.5, size * 0.25);
        // Dorsal highlight
        g.fillStyle(colors.glow, 0.6);
        g.fillEllipse(0, 0, size * 0.4, size * 0.12);
        // Crown/ridge on back
        g.fillStyle(0xffd700);
        for (let i = 0; i < 5; i++) {
            const x = size * 0.15 - i * size * 0.08;
            g.fillCircle(x, 0, size * 0.03);
        }
    } else if (type === 'special') {
        // Special: Round golden fish with sparkle ring
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.35, size * 0.28);
        // Inner glow
        g.fillStyle(0xffe082, 0.7);
        g.fillEllipse(0, 0, size * 0.25, size * 0.18);
        // Sparkle ring
        g.lineStyle(2, 0xffffff, 0.5);
        g.strokeCircle(0, 0, size * 0.4);
    } else if (type === 'large') {
        // Large: Shark-like torpedo shape
        g.fillStyle(colors.body);
        g.beginPath();
        g.moveTo(size * 0.35, 0);
        g.lineTo(size * 0.15, -size * 0.12);
        g.lineTo(-size * 0.25, -size * 0.08);
        g.lineTo(-size * 0.35, 0);
        g.lineTo(-size * 0.25, size * 0.08);
        g.lineTo(size * 0.15, size * 0.12);
        g.closePath();
        g.fill();
        // Dorsal stripe
        g.fillStyle(colors.glow, 0.5);
        g.fillEllipse(0, 0, size * 0.25, size * 0.05);
    } else if (type === 'medium') {
        // Medium: Oval tropical fish
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.3, size * 0.18);
        // Stripe pattern
        g.fillStyle(colors.glow, 0.4);
        g.fillRect(-size * 0.05, -size * 0.15, size * 0.03, size * 0.3);
        g.fillRect(size * 0.08, -size * 0.12, size * 0.03, size * 0.24);
    } else {
        // Small: Simple round fish
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.25, size * 0.18);
        // Highlight
        g.fillStyle(colors.glow, 0.5);
        g.fillEllipse(size * 0.03, -size * 0.02, size * 0.12, size * 0.08);
    }
}

function drawFishFinsTopDown(g, type, colors, size) {
    g.clear();
    g.fillStyle(colors.glow, 0.7);
    
    const finSize = type === 'boss' ? 0.15 : type === 'large' ? 0.12 : 0.08;
    
    // Left fin (top in top-down view)
    g.beginPath();
    g.moveTo(0, -size * 0.1);
    g.lineTo(-size * 0.1, -size * (0.1 + finSize));
    g.lineTo(size * 0.05, -size * 0.12);
    g.closePath();
    g.fill();
    
    // Right fin (bottom in top-down view)
    g.beginPath();
    g.moveTo(0, size * 0.1);
    g.lineTo(-size * 0.1, size * (0.1 + finSize));
    g.lineTo(size * 0.05, size * 0.12);
    g.closePath();
    g.fill();
}

function drawFishTailTopDown(g, type, colors, size) {
    g.clear();
    g.fillStyle(colors.glow, 0.8);
    
    const tailSize = type === 'boss' ? 0.2 : type === 'large' ? 0.15 : 0.1;
    
    // V-shaped tail fan
    g.beginPath();
    g.moveTo(-size * 0.25, 0);
    g.lineTo(-size * (0.25 + tailSize), -size * tailSize);
    g.lineTo(-size * (0.2 + tailSize * 0.3), 0);
    g.lineTo(-size * (0.25 + tailSize), size * tailSize);
    g.closePath();
    g.fill();
}

function drawFishEyesTopDown(g, type, size) {
    g.clear();
    const eyeX = size * 0.15;
    const eyeOffsetY = size * 0.06;
    const eyeSize = type === 'boss' ? size * 0.035 : size * 0.025;
    
    // Two eyes symmetrically placed (top-down view)
    // Left eye
    g.fillStyle(0x000000);
    g.fillCircle(eyeX, -eyeOffsetY, eyeSize);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(eyeX + eyeSize * 0.3, -eyeOffsetY - eyeSize * 0.2, eyeSize * 0.3);
    
    // Right eye
    g.fillStyle(0x000000);
    g.fillCircle(eyeX, eyeOffsetY, eyeSize);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(eyeX + eyeSize * 0.3, eyeOffsetY - eyeSize * 0.2, eyeSize * 0.3);
}

function getMultiplierColor(mult) {
    if (mult >= 200) return '#ffd700';
    if (mult >= 50) return '#ff3da8';
    if (mult >= 15) return '#ff7043';
    return '#00ffff';
}

function startFishAnimationsTopDown(fish, type) {
    // Tail wiggle (top-down swimming motion)
    scene.tweens.add({
        targets: fish.tail,
        scaleX: { from: 0.8, to: 1.2 },
        duration: type === 'boss' ? 400 : 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    
    // Fin flutter
    if (fish.fins) {
        scene.tweens.add({
            targets: fish.fins,
            scaleY: { from: 0.9, to: 1.1 },
            duration: type === 'boss' ? 500 : 250,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    // Glow pulse
    if (fish.glow) {
        scene.tweens.add({
            targets: fish.glow,
            alpha: { from: 0.3, to: 0.6 },
            scale: { from: 1, to: 1.15 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    // Shadow pulse (subtle depth effect)
    if (fish.shadow) {
        scene.tweens.add({
            targets: fish.shadow,
            alpha: { from: 0.15, to: 0.25 },
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    // Breathing scale effect
    scene.tweens.add({
        targets: fish,
        scaleX: { from: 0.98, to: 1.02 },
        scaleY: { from: 0.98, to: 1.02 },
        duration: type === 'boss' ? 1500 : 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

function showBossEntrance(fish) {
    // Screen shake
    scene.cameras.main.shake(300, 0.01);
    
    // Announcement
    const text = scene.add.text(400, 400, 'BOSS APPEARED!', {
        fontSize: '32px',
        fontFamily: 'Orbitron',
        color: '#ff3da8',
        stroke: '#000',
        strokeThickness: 4
    });
    text.setOrigin(0.5);
    text.setDepth(200);
    
    scene.tweens.add({
        targets: text,
        alpha: 0,
        scale: 2,
        duration: 1500,
        onComplete: () => text.destroy()
    });
}

function removeFish(fishId) {
    const fish = GameState.fish[fishId];
    if (fish) {
        fish.destroy();
        delete GameState.fish[fishId];
    }
}

function handleFishCaptured(data) {
    const fish = GameState.fish[data.fishId];
    if (fish) {
        // Capture effect
        showCaptureEffect(fish.x, fish.y, data.reward);
        
        // Remove fish
        removeFish(data.fishId);
    }
    
    // Update coins
    updatePlayerCoins(data.playerId, data.newCoins);
    
    // Remove bullet
    if (data.bulletId) {
        removeBullet(data.bulletId);
    }
}

function showCaptureEffect(x, y, reward, playerId = null) {
    // Water ripple at capture point
    spawnRipple(x, y, 0xffd700, 50);
    
    // Particle burst (cyan/white particles)
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const color = i % 2 === 0 ? 0x00ffff : 0xffffff;
        const particle = scene.add.circle(x, y, 4, color);
        particle.setDepth(150);
        
        scene.tweens.add({
            targets: particle,
            x: x + Math.cos(angle) * 70,
            y: y + Math.sin(angle) * 70,
            alpha: 0,
            scale: 0.3,
            duration: 500,
            onComplete: () => particle.destroy()
        });
    }
    
    // Sparkles flying to player cannon
    const targetPlayerId = playerId || GameState.playerId;
    const cannonPos = getCannonPosition(targetPlayerId);
    if (cannonPos) {
        for (let i = 0; i < 6; i++) {
            const sparkle = scene.add.circle(x, y, 3, 0xffd700);
            sparkle.setDepth(155);
            
            // Staggered flight to cannon
            scene.tweens.add({
                targets: sparkle,
                x: cannonPos.x + (Math.random() - 0.5) * 20,
                y: cannonPos.y + (Math.random() - 0.5) * 20,
                scale: { from: 1, to: 0.5 },
                duration: 400 + i * 50,
                delay: i * 30,
                ease: 'Quad.easeIn',
                onComplete: () => sparkle.destroy()
            });
        }
    }
    
    // Reward text (score pop-up with animation)
    const fontSize = reward >= 100 ? '28px' : reward >= 50 ? '24px' : '20px';
    const textColor = reward >= 100 ? '#ffd700' : reward >= 50 ? '#ff8800' : '#00ffff';
    
    const text = scene.add.text(x, y, `+${reward}`, {
        fontSize: fontSize,
        fontFamily: 'Orbitron',
        color: textColor,
        stroke: '#000',
        strokeThickness: 4
    });
    text.setOrigin(0.5);
    text.setDepth(160);
    
    // Scale up then fade out while rising
    scene.tweens.add({
        targets: text,
        scale: { from: 0.5, to: 1.2 },
        duration: 200,
        ease: 'Back.easeOut'
    });
    
    scene.tweens.add({
        targets: text,
        y: y - 60,
        alpha: 0,
        duration: 1200,
        delay: 200,
        onComplete: () => text.destroy()
    });
    
    // Flash effect on fish (glow pulse)
    const glow = scene.add.circle(x, y, 30, 0xffffff, 0.6);
    glow.setDepth(145);
    scene.tweens.add({
        targets: glow,
        scale: 2,
        alpha: 0,
        duration: 200,
        onComplete: () => glow.destroy()
    });
}

function getCannonPosition(playerId) {
    if (!GameState.players[playerId]) return null;
    const seat = GameState.players[playerId].seat;
    return CANNON_POSITIONS[seat];
}

function showHitEffect(x, y) {
    // Hit effect when bullet hits fish (even if not captured)
    // Water ripple
    spawnRipple(x, y, 0x00ffff, 35);
    
    // Small particle burst
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const particle = scene.add.circle(x, y, 3, 0x00ffff);
        particle.setDepth(145);
        
        scene.tweens.add({
            targets: particle,
            x: x + Math.cos(angle) * 30,
            y: y + Math.sin(angle) * 30,
            alpha: 0,
            scale: 0,
            duration: 250,
            onComplete: () => particle.destroy()
        });
    }
    
    // Flash
    const flash = scene.add.circle(x, y, 15, 0xffffff, 0.5);
    flash.setDepth(144);
    scene.tweens.add({
        targets: flash,
        scale: 2,
        alpha: 0,
        duration: 150,
        onComplete: () => flash.destroy()
    });
}

function updateFishAnimations(delta) {
    // Fish animations are handled by tweens
}

// ============== BULLETS ==============

// Bullet colors by level
const BULLET_COLORS = {
    1: { core: 0x00aaff, glow: 0x0088ff, trail: 0x00ccff },    // Light blue
    2: { core: 0x00ff88, glow: 0x00cc66, trail: 0x00ffaa },    // Green
    3: { core: 0xffff00, glow: 0xcccc00, trail: 0xffff66 },    // Yellow
    5: { core: 0xff8800, glow: 0xcc6600, trail: 0xffaa33 },    // Orange
    10: { core: 0xff00ff, glow: 0xcc00cc, trail: 0xff66ff }    // Red/Purple
};

function getBulletColors(level) {
    if (level >= 10) return BULLET_COLORS[10];
    if (level >= 5) return BULLET_COLORS[5];
    if (level >= 3) return BULLET_COLORS[3];
    if (level >= 2) return BULLET_COLORS[2];
    return BULLET_COLORS[1];
}

function createBullet(data) {
    const { playerId, bulletId, fromPosition, targetX, targetY, bulletLevel } = data;
    
    const angle = Math.atan2(targetY - fromPosition.y, targetX - fromPosition.x);
    const speed = 600;
    const colors = getBulletColors(bulletLevel);
    
    // Create bullet
    const bullet = scene.add.container(fromPosition.x, fromPosition.y);
    bullet.bulletId = bulletId;
    bullet.bulletLevel = bulletLevel;
    bullet.bulletColors = colors;
    bullet.velocityX = Math.cos(angle) * speed;
    bullet.velocityY = Math.sin(angle) * speed;
    bullet.trailTimer = 0;
    
    // Bullet graphics based on level
    const g = scene.add.graphics();
    const size = 8 + bulletLevel * 2;
    
    // Outer glow
    g.fillStyle(colors.glow, 0.3);
    g.fillCircle(0, 0, size * 1.5);
    
    // Core
    g.fillStyle(colors.core);
    if (bulletLevel >= 10) {
        // Rocket shape for level 10
        g.beginPath();
        g.moveTo(0, -size);
        g.lineTo(size * 0.5, size * 0.3);
        g.lineTo(-size * 0.5, size * 0.3);
        g.closePath();
        g.fill();
        // Inner glow
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(0, -size * 0.3, size * 0.3);
    } else if (bulletLevel >= 5) {
        // Plasma ball for level 5+
        g.fillEllipse(0, 0, size, size * 1.3);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(0, -size * 0.2, size * 0.4);
    } else {
        // Energy bolt for lower levels
        g.fillEllipse(0, 0, size * 0.8, size * 1.2);
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(0, -size * 0.15, size * 0.3);
    }
    
    bullet.add(g);
    bullet.setAngle(Phaser.Math.RadToDeg(angle) + 90);
    bullet.setDepth(80);
    
    // Store bullet
    GameState.bullets[bulletId] = bullet;
    scene.bulletGroup.add(bullet);
    
    // Muzzle flash at cannon (color matches bullet)
    const flash = scene.add.circle(fromPosition.x, fromPosition.y, 15, colors.core, 0.8);
    flash.setDepth(90);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 100,
        onComplete: () => flash.destroy()
    });
    
    // Water ripple at spawn point
    spawnRipple(fromPosition.x, fromPosition.y, colors.trail, 25);
}

function spawnBulletTrail(bullet) {
    const colors = bullet.bulletColors;
    const size = 3 + bullet.bulletLevel * 0.5;
    
    const trail = scene.add.circle(bullet.x, bullet.y, size, colors.trail, 0.6);
    trail.setDepth(75);
    
    scene.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        onComplete: () => trail.destroy()
    });
}

function removeBullet(bulletId) {
    const bullet = GameState.bullets[bulletId];
    if (bullet) {
        bullet.destroy();
        delete GameState.bullets[bulletId];
    }
}

function updateBullets(delta) {
    const dt = delta / 1000;
    
    for (const [bulletId, bullet] of Object.entries(GameState.bullets)) {
        bullet.x += bullet.velocityX * dt;
        bullet.y += bullet.velocityY * dt;
        
        // Spawn trail particles
        bullet.trailTimer += delta;
        if (bullet.trailTimer > 30) { // Every 30ms
            bullet.trailTimer = 0;
            spawnBulletTrail(bullet);
        }
        
        // Remove if out of bounds
        if (bullet.x < -50 || bullet.x > 850 || bullet.y < -50 || bullet.y > 650) {
            removeBullet(bulletId);
        }
    }
}

// ============== INPUT HANDLING ==============

function handleClick(pointer) {
    if (!GameState.gameStarted) return;
    if (GameState.autoMode) return; // Can't manually shoot in auto mode
    
    // Transform screen coordinates to world coordinates (accounting for camera rotation)
    const worldPoint = screenToWorld(pointer.x, pointer.y);
    
    GameState.socket.emit('shoot', {
        targetX: worldPoint.x,
        targetY: worldPoint.y,
        bulletLevel: GameState.bulletLevel
    });
}

function handlePointerMove(pointer) {
    if (!GameState.gameStarted) return;
    
    // Rotate player's cannon to face pointer (in world coordinates)
    const cannon = scene.cannons ? scene.cannons[GameState.playerId] : null;
    if (cannon) {
        const pos = CANNON_POSITIONS[GameState.seat];
        // Transform pointer to world coordinates
        const worldPoint = screenToWorld(pointer.x, pointer.y);
        const angle = Math.atan2(worldPoint.y - pos.y, worldPoint.x - pos.x);
        cannon.setAngle(Phaser.Math.RadToDeg(angle) + 90);
    }
}

// ============== SYNC ==============

function syncGameState(data) {
    // Sync fish positions
    for (const [fishId, fishData] of Object.entries(data.fish)) {
        const fish = GameState.fish[fishId];
        if (fish) {
            // Smooth interpolation
            scene.tweens.add({
                targets: fish,
                x: fishData.x,
                y: fishData.y,
                duration: 100,
                ease: 'Linear'
            });
        }
    }
    
    // Sync player coins
    for (const [playerId, coins] of Object.entries(data.playerCoins)) {
        updatePlayerCoins(playerId, coins);
    }
}

// ============== BONUS EFFECTS ==============

function showBonusAnnouncement(bonusType, playerId) {
    const bonusNames = {
        lockAndFreeze: 'LOCK & FREEZE',
        chainLightning: 'CHAIN LIGHTNING',
        fullScreenClear: 'FULL SCREEN CLEAR'
    };
    
    const text = scene.add.text(400, 400, bonusNames[bonusType] || bonusType, {
        fontSize: '36px',
        fontFamily: 'Orbitron',
        color: '#ffd700',
        stroke: '#000',
        strokeThickness: 4
    });
    text.setOrigin(0.5);
    text.setDepth(200);
    
    scene.tweens.add({
        targets: text,
        scale: { from: 0.5, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: 2000,
        onComplete: () => text.destroy()
    });
    
    // Screen effect based on bonus type
    if (bonusType === 'lockAndFreeze') {
        const overlay = scene.add.rectangle(400, 400, 800, 800, 0x00ffff, 0.2);
        overlay.setDepth(190);
        scene.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 5000,
            onComplete: () => overlay.destroy()
        });
    }
}

function showChainLightning(data) {
    // Draw lightning arcs to each captured fish
    const g = scene.add.graphics();
    g.setDepth(180);
    
    g.lineStyle(3, 0x00ffff, 1);
    
    for (const captured of data.capturedFish) {
        const fish = GameState.fish[captured.fishId];
        if (fish) {
            // Draw jagged lightning line
            drawLightningArc(g, data.sourcePosition.x, data.sourcePosition.y, fish.x, fish.y);
            
            // Show reward
            showCaptureEffect(fish.x, fish.y, captured.reward);
            
            // Remove fish
            removeFish(captured.fishId);
        }
    }
    
    // Fade out lightning
    scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: 500,
        onComplete: () => g.destroy()
    });
}

function drawLightningArc(g, x1, y1, x2, y2) {
    const segments = 8;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    
    g.beginPath();
    g.moveTo(x1, y1);
    
    for (let i = 1; i < segments; i++) {
        const x = x1 + dx * i + (Math.random() - 0.5) * 30;
        const y = y1 + dy * i + (Math.random() - 0.5) * 30;
        g.lineTo(x, y);
    }
    
    g.lineTo(x2, y2);
    g.stroke();
}

function showFullScreenClear(data) {
    // Radial shockwave
    const shockwave = scene.add.circle(400, 400, 10, 0xffd700, 0.5);
    shockwave.setDepth(180);
    
    scene.tweens.add({
        targets: shockwave,
        scale: 50,
        alpha: 0,
        duration: 1000,
        onComplete: () => shockwave.destroy()
    });
    
    // Capture all fish with effects
    for (const captured of data.capturedFish) {
        const fish = GameState.fish[captured.fishId];
        if (fish) {
            showCaptureEffect(fish.x, fish.y, captured.reward);
            removeFish(captured.fishId);
        }
    }
    
    // Screen flash
    const flash = scene.add.rectangle(400, 400, 800, 800, 0xffd700, 0.4);
    flash.setDepth(170);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy()
    });
}

// ============== ERROR HANDLING ==============

function showErrorMessage(message) {
    const text = scene.add.text(400, 100, message, {
        fontSize: '16px',
        fontFamily: 'Orbitron',
        color: '#ff0000',
        stroke: '#000',
        strokeThickness: 2
    });
    text.setOrigin(0.5);
    text.setDepth(250);
    
    scene.tweens.add({
        targets: text,
        alpha: 0,
        y: 80,
        duration: 2000,
        onComplete: () => text.destroy()
    });
}

// ============== INITIALIZE ==============

// Start Phaser game
game = new Phaser.Game(config);
