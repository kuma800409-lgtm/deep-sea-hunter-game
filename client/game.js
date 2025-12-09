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
    autoModeEndTime: 0
};

// Phaser configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
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

// Cannon positions for each seat
const CANNON_POSITIONS = {
    bottom: { x: 400, y: 570, angle: -90 },
    top: { x: 400, y: 30, angle: 90 },
    left: { x: 30, y: 300, angle: 0 },
    right: { x: 770, y: 300, angle: 180 }
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

// ============== BACKGROUND ==============

let backgroundLayers = [];

function createBackground() {
    // Layer 1: Deep gradient (farthest)
    const gradient1 = scene.add.graphics();
    gradient1.fillGradientStyle(0x001a33, 0x001a33, 0x000d1a, 0x000d1a, 1);
    gradient1.fillRect(0, 0, 800, 600);
    gradient1.setDepth(-100);
    
    // Layer 2: Distant coral silhouettes
    const silhouettes = scene.add.graphics();
    silhouettes.fillStyle(0x002244, 0.5);
    for (let i = 0; i < 8; i++) {
        const x = i * 120 - 50;
        const h = 50 + Math.random() * 80;
        silhouettes.fillTriangle(x, 600, x + 40, 600 - h, x + 80, 600);
    }
    silhouettes.setDepth(-90);
    silhouettes.scrollFactorX = 0.1;
    backgroundLayers.push({ graphics: silhouettes, speed: 0.1 });
    
    // Layer 3: Mid rocks and sunken ship
    const midLayer = scene.add.graphics();
    midLayer.fillStyle(0x003355, 0.6);
    // Rocks
    midLayer.fillEllipse(100, 550, 120, 60);
    midLayer.fillEllipse(650, 530, 100, 50);
    // Sunken ship silhouette
    midLayer.fillStyle(0x002244, 0.7);
    midLayer.beginPath();
    midLayer.moveTo(300, 580);
    midLayer.lineTo(320, 520);
    midLayer.lineTo(380, 500);
    midLayer.lineTo(420, 510);
    midLayer.lineTo(450, 580);
    midLayer.closePath();
    midLayer.fill();
    midLayer.setDepth(-80);
    midLayer.scrollFactorX = 0.3;
    backgroundLayers.push({ graphics: midLayer, speed: 0.3 });
    
    // Layer 4: Coral reef at bottom
    createCoralReef();
    
    // Layer 5: Caustic light overlay
    createCausticLight();
    
    // Layer 6: Foreground bubbles
    createBubbles();
    
    // Light rays from above
    createLightRays();
}

function createCoralReef() {
    const coral = scene.add.graphics();
    coral.setDepth(-70);
    
    // Draw various coral types
    const coralColors = [0xff6b9d, 0xff9f43, 0xa55eea, 0x00d2d3, 0xfeca57];
    
    for (let i = 0; i < 12; i++) {
        const x = 30 + i * 70;
        const color = coralColors[i % coralColors.length];
        const type = i % 3;
        
        coral.fillStyle(color, 0.8);
        
        if (type === 0) {
            // Branching coral
            for (let j = 0; j < 5; j++) {
                const bx = x + (j - 2) * 8;
                const h = 30 + Math.random() * 40;
                coral.fillRect(bx, 600 - h, 4, h);
                coral.fillCircle(bx + 2, 600 - h, 6);
            }
        } else if (type === 1) {
            // Fan coral
            coral.beginPath();
            coral.moveTo(x, 600);
            coral.lineTo(x - 25, 560);
            coral.lineTo(x, 540);
            coral.lineTo(x + 25, 560);
            coral.closePath();
            coral.fill();
        } else {
            // Tube coral
            for (let j = 0; j < 3; j++) {
                const tx = x + (j - 1) * 12;
                coral.fillRoundedRect(tx - 5, 560, 10, 40, 5);
            }
        }
    }
    
    backgroundLayers.push({ graphics: coral, speed: 0.6 });
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
            Math.random() * 600,
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
    const rays = scene.add.graphics();
    rays.setDepth(-85);
    rays.setBlendMode(Phaser.BlendModes.ADD);
    
    for (let i = 0; i < 5; i++) {
        const x = 100 + i * 180;
        rays.fillStyle(0x00ffff, 0.03);
        rays.beginPath();
        rays.moveTo(x - 30, 0);
        rays.lineTo(x + 30, 0);
        rays.lineTo(x + 80, 600);
        rays.lineTo(x - 80, 600);
        rays.closePath();
        rays.fill();
    }
    
    // Animate rays
    scene.tweens.add({
        targets: rays,
        alpha: { from: 0.5, to: 1 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

function updateParallax(delta) {
    // Update bubbles
    if (scene.bubbles) {
        scene.bubbles.forEach(bubble => {
            bubble.y -= bubble.speedY * delta / 1000;
            bubble.x += Math.sin(bubble.wobble) * 0.5;
            bubble.wobble += 0.05;
            
            if (bubble.y < -10) {
                bubble.y = 610;
                bubble.x = Math.random() * 800;
            }
        });
    }
    
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
    // Connect to server
    const serverUrl = window.location.origin;
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
        const hud = document.createElement('div');
        hud.className = `player-hud ${player.seat}`;
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
    
    // Glow effect
    const glow = scene.add.graphics();
    glow.fillStyle(colors.glow, 0.2);
    glow.fillEllipse(0, 0, fishSize * 1.3, fishSize * 0.8);
    fish.add(glow);
    fish.glow = glow;
    
    // Body
    const body = scene.add.graphics();
    drawFishBody(body, fishType, colors, fishSize);
    fish.add(body);
    fish.body = body;
    
    // Tail
    const tail = scene.add.graphics();
    drawFishTail(tail, fishType, colors, fishSize);
    fish.add(tail);
    fish.tail = tail;
    
    // Eye
    const eye = scene.add.graphics();
    drawFishEye(eye, fishType, fishSize);
    fish.add(eye);
    
    // Multiplier text
    const multText = scene.add.text(0, -fishSize * 0.6, `${multiplier}x`, {
        fontSize: fishType === 'boss' ? '16px' : '12px',
        fontFamily: 'Orbitron',
        color: getMultiplierColor(multiplier),
        stroke: '#000',
        strokeThickness: 3
    });
    multText.setOrigin(0.5);
    fish.add(multText);
    
    // Set direction
    fish.setScale(direction, 1);
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
    startFishAnimations(fish, fishType);
    
    // Boss entrance effect
    if (fishType === 'boss') {
        showBossEntrance(fish);
    }
}

function drawFishBody(g, type, colors, size) {
    g.clear();
    
    // Outer glow
    g.fillStyle(colors.glow, 0.15);
    g.fillEllipse(0, 0, size * 0.55, size * 0.4);
    
    if (type === 'boss') {
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.7, size * 0.4);
        g.fillStyle(colors.glow, 0.5);
        g.fillEllipse(0, -size * 0.05, size * 0.6, size * 0.3);
        // Crown
        g.fillStyle(0xffd700);
        g.beginPath();
        g.moveTo(size * 0.15, -size * 0.18);
        g.lineTo(size * 0.18, -size * 0.3);
        g.lineTo(size * 0.25, -size * 0.2);
        g.lineTo(size * 0.28, -size * 0.32);
        g.lineTo(size * 0.35, -size * 0.18);
        g.closePath();
        g.fill();
    } else if (type === 'special') {
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.45, size * 0.3);
        g.fillStyle(0xffe082, 0.6);
        g.fillEllipse(0, -size * 0.04, size * 0.35, size * 0.2);
    } else if (type === 'large') {
        g.fillStyle(colors.body);
        g.beginPath();
        g.moveTo(size * 0.3, 0);
        g.lineTo(size * 0.2, -size * 0.15);
        g.lineTo(-size * 0.15, -size * 0.12);
        g.lineTo(-size * 0.3, 0);
        g.lineTo(-size * 0.15, size * 0.12);
        g.lineTo(size * 0.2, size * 0.12);
        g.closePath();
        g.fill();
    } else if (type === 'medium') {
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.3, size * 0.18);
        g.fillStyle(colors.glow, 0.5);
        g.fillEllipse(0, -size * 0.03, size * 0.24, size * 0.12);
    } else {
        g.fillStyle(colors.body);
        g.fillEllipse(0, 0, size * 0.28, size * 0.18);
        g.fillStyle(colors.glow, 0.5);
        g.fillEllipse(0, -size * 0.03, size * 0.2, size * 0.1);
    }
}

function drawFishTail(g, type, colors, size) {
    g.clear();
    g.fillStyle(colors.glow, 0.8);
    
    const tailSize = type === 'boss' ? 0.35 : type === 'large' ? 0.25 : 0.15;
    
    g.beginPath();
    g.moveTo(-size * 0.25, 0);
    g.lineTo(-size * (0.25 + tailSize), -size * tailSize * 0.8);
    g.lineTo(-size * (0.2 + tailSize * 0.5), 0);
    g.lineTo(-size * (0.25 + tailSize), size * tailSize * 0.8);
    g.closePath();
    g.fill();
}

function drawFishEye(g, type, size) {
    g.clear();
    const eyeX = size * 0.12;
    const eyeY = -size * 0.02;
    const eyeSize = type === 'boss' ? size * 0.06 : size * 0.04;
    
    g.fillStyle(0xffffff);
    g.fillCircle(eyeX, eyeY, eyeSize);
    g.fillStyle(0x000000);
    g.fillCircle(eyeX + eyeSize * 0.2, eyeY, eyeSize * 0.6);
    g.fillStyle(0xffffff);
    g.fillCircle(eyeX + eyeSize * 0.3, eyeY - eyeSize * 0.2, eyeSize * 0.2);
}

function getMultiplierColor(mult) {
    if (mult >= 200) return '#ffd700';
    if (mult >= 50) return '#ff3da8';
    if (mult >= 15) return '#ff7043';
    return '#00ffff';
}

function startFishAnimations(fish, type) {
    // Body wiggle
    scene.tweens.add({
        targets: fish.body,
        x: { from: -2, to: 2 },
        duration: type === 'boss' ? 800 : 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    
    // Tail sway
    scene.tweens.add({
        targets: fish.tail,
        angle: { from: -15, to: 15 },
        duration: type === 'boss' ? 600 : 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    
    // Glow pulse
    if (fish.glow) {
        scene.tweens.add({
            targets: fish.glow,
            alpha: { from: 0.5, to: 1 },
            scale: { from: 1, to: 1.1 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
}

function showBossEntrance(fish) {
    // Screen shake
    scene.cameras.main.shake(300, 0.01);
    
    // Announcement
    const text = scene.add.text(400, 300, 'BOSS APPEARED!', {
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

function showCaptureEffect(x, y, reward) {
    // Particle burst
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const particle = scene.add.circle(x, y, 4, 0xffd700);
        particle.setDepth(150);
        
        scene.tweens.add({
            targets: particle,
            x: x + Math.cos(angle) * 60,
            y: y + Math.sin(angle) * 60,
            alpha: 0,
            scale: 0,
            duration: 400,
            onComplete: () => particle.destroy()
        });
    }
    
    // Reward text
    const text = scene.add.text(x, y, `+${reward}`, {
        fontSize: '20px',
        fontFamily: 'Orbitron',
        color: '#ffd700',
        stroke: '#000',
        strokeThickness: 3
    });
    text.setOrigin(0.5);
    text.setDepth(160);
    
    scene.tweens.add({
        targets: text,
        y: y - 50,
        alpha: 0,
        duration: 1000,
        onComplete: () => text.destroy()
    });
    
    // Screen flash
    const flash = scene.add.rectangle(400, 300, 800, 600, 0xffffff, 0.2);
    flash.setDepth(140);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 100,
        onComplete: () => flash.destroy()
    });
}

function updateFishAnimations(delta) {
    // Fish animations are handled by tweens
}

// ============== BULLETS ==============

function createBullet(data) {
    const { playerId, bulletId, fromPosition, targetX, targetY, bulletLevel } = data;
    
    const angle = Math.atan2(targetY - fromPosition.y, targetX - fromPosition.x);
    const speed = 600;
    
    // Create bullet
    const bullet = scene.add.container(fromPosition.x, fromPosition.y);
    bullet.bulletId = bulletId;
    bullet.velocityX = Math.cos(angle) * speed;
    bullet.velocityY = Math.sin(angle) * speed;
    
    // Bullet graphics based on level
    const g = scene.add.graphics();
    const size = 8 + bulletLevel * 2;
    
    if (bulletLevel >= 10) {
        // Golden rocket
        g.fillStyle(0xffd700, 0.3);
        g.fillCircle(0, 0, size * 2);
        g.fillStyle(0xffc107);
        g.beginPath();
        g.moveTo(0, -size);
        g.lineTo(size * 0.5, size * 0.3);
        g.lineTo(-size * 0.5, size * 0.3);
        g.closePath();
        g.fill();
    } else if (bulletLevel >= 5) {
        // Cyan plasma
        g.fillStyle(0x00ffff, 0.2);
        g.fillCircle(0, 0, size * 1.5);
        g.fillStyle(0x00e5ff);
        g.fillEllipse(0, 0, size, size * 1.5);
    } else {
        // Blue energy bolt
        g.fillStyle(0x0088ff, 0.3);
        g.fillCircle(0, 0, size * 1.2);
        g.fillStyle(0x00aaff);
        g.fillEllipse(0, 0, size * 0.8, size * 1.2);
    }
    
    bullet.add(g);
    bullet.setAngle(Phaser.Math.RadToDeg(angle) + 90);
    bullet.setDepth(80);
    
    // Store bullet
    GameState.bullets[bulletId] = bullet;
    scene.bulletGroup.add(bullet);
    
    // Muzzle flash at cannon
    const flash = scene.add.circle(fromPosition.x, fromPosition.y, 15, 0x00e5ff, 0.8);
    flash.setDepth(90);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 100,
        onComplete: () => flash.destroy()
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
    
    GameState.socket.emit('shoot', {
        targetX: pointer.x,
        targetY: pointer.y,
        bulletLevel: GameState.bulletLevel
    });
}

function handlePointerMove(pointer) {
    if (!GameState.gameStarted) return;
    
    // Rotate player's cannon to face pointer
    const cannon = scene.cannons ? scene.cannons[GameState.playerId] : null;
    if (cannon) {
        const pos = CANNON_POSITIONS[GameState.seat];
        const angle = Math.atan2(pointer.y - pos.y, pointer.x - pos.x);
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
    
    const text = scene.add.text(400, 300, bonusNames[bonusType] || bonusType, {
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
        const overlay = scene.add.rectangle(400, 300, 800, 600, 0x00ffff, 0.2);
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
    const shockwave = scene.add.circle(400, 300, 10, 0xffd700, 0.5);
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
    const flash = scene.add.rectangle(400, 300, 800, 600, 0xffd700, 0.4);
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
