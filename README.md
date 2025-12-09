# Deep Sea Hunter V2.0 - Multiplayer Online Fishing Arcade Game

A fully multiplayer online fishing arcade game with WebSocket backend, real-time synchronization across 4 players per room, auto-fire AI mode, and professional arcade visual polish.

## Features

### Multiplayer Architecture
- **Node.js + Socket.IO** backend with authoritative server pattern
- **Room-based multiplayer** supporting up to 4 players per room
- **Real-time synchronization** - all clients see identical game state
- **4-direction cannons** - players positioned at Bottom, Top, Left, Right

### Game Mechanics
- **RNG-based capture system** - probability-based fish capture (not health points)
- **5 fish types**: Small (2-8x), Medium (15-30x), Large (50-150x), Boss (200-500x), Special (50x)
- **Bullet levels**: 1x, 2x, 3x, 5x, 10x with cost scaling
- **Target RTP**: 95.0-96.0%

### Auto-Fire AI Mode
- **Cost**: 100 coins for 60 seconds
- **Efficiency Penalties**:
  - 30% slower fire rate (2s vs 1.4s)
  - 15% accuracy penalty (aim offset ±30px)
  - Random target selection (no strategic priority)
  - Locked to 1x bullets only

### Bonus Features
1. **Lock & Freeze** - Screen freezes, auto-targets highest-value fish with 100% capture
2. **Chain Lightning** - Captures all fish with multiplier < 15x in chain radius
3. **Full Screen Clear** - Captures ALL fish on screen at 80% value

### Visual Polish
- **Parallax background** with 6 layers (gradient, silhouettes, rocks, coral, caustics, bubbles)
- **Procedural fish graphics** with glow effects and rim lighting
- **Arcade cabinet aesthetic** with LED effects and neon colors
- **Orbitron font** for arcade-style text

## Project Structure

```
deep-sea-hunter-v2/
├── server/
│   ├── server.js          # Main Express + Socket.IO server
│   ├── GameRoom.js        # Room management and game logic
│   ├── FishManager.js     # Fish spawning and movement
│   ├── CollisionDetector.js # Server-side hit detection
│   └── RNGEngine.js       # Authoritative RNG for captures
├── client/
│   ├── index.html         # Main HTML with lobby UI
│   └── game.js            # Phaser 3 client
└── package.json
```

## Installation

```bash
# Clone the repository
git clone https://github.com/kuma800409-lgtm/deep-sea-hunter-game.git
cd deep-sea-hunter-game

# Install dependencies
npm install

# Start the server
npm start
```

## Running Locally

```bash
# Start the server (default port 3000)
npm start

# Or specify a custom port
PORT=8080 npm start
```

Open http://localhost:3000 in your browser to play.

## WebSocket Events

### Client to Server
| Event | Data | Description |
|-------|------|-------------|
| `join_room` | `{playerName, roomId?}` | Join a room (auto-match if no roomId) |
| `ready` | - | Mark player as ready |
| `start_game` | - | Host starts the game |
| `shoot` | `{targetX, targetY, bulletLevel}` | Fire a bullet |
| `change_bullet` | `{level}` | Change bullet level |
| `enable_auto` | - | Enable auto-fire mode (costs 100 coins) |
| `disable_auto` | - | Disable auto-fire mode |

### Server to Client
| Event | Data | Description |
|-------|------|-------------|
| `joined_room` | `{roomId, playerId, seat, players}` | Confirmation of room join |
| `player_joined` | `{player, players}` | Another player joined |
| `game_start` | `{players}` | Game has started |
| `fish_spawn` | `{fishId, fishType, position, target, ...}` | New fish spawned |
| `player_shot` | `{playerId, bulletId, from, target, ...}` | Player fired a bullet |
| `fish_captured` | `{fishId, playerId, reward}` | Fish was captured |
| `player_coins` | `{playerId, coins}` | Player coin update |
| `bonus_triggered` | `{type, playerId, ...}` | Bonus feature activated |

## Deployment

### Server Deployment (Heroku, Render, etc.)

1. Create a new app on your hosting platform
2. Set the `PORT` environment variable (usually auto-set)
3. Deploy the code
4. The server will serve both the API and static client files

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |

## Testing

### Local Testing with Multiple Clients
1. Start the server: `npm start`
2. Open multiple browser tabs to http://localhost:3000
3. Join the same room using the room code
4. Test shooting, fish capture, and synchronization

### Multiplayer Stability Test
- Run 4 clients continuously
- Verify zero disconnects
- Verify all clients show identical fish positions

## Technical Details

### Server Architecture
- **Authoritative server pattern**: Server is the ONLY source of truth for:
  - Fish spawning positions, types, and movement paths
  - RNG-based capture probability calculations
  - Reward/coin calculations
  - Game state synchronization

### Hit Detection
- Server-side collision detection with tuned hitboxes per fish type
- 100ms hit cooldown to prevent double-hit registration
- Velocity validation (minimum 50px/s) before registering hits

### Fish Types
| Type | Multiplier | Capture Prob | Size | Hit Radius |
|------|------------|--------------|------|------------|
| Small | 2-8x | 70% | 45px | 30px |
| Medium | 15-30x | 40% | 70px | 45px |
| Large | 50-150x | 20% | 110px | 60px |
| Boss | 200-500x | 5% | 160px | 80px |
| Special | 50x | 30% | 80px | 50px |

### Cannon Positions
| Seat | Position | Angle |
|------|----------|-------|
| Bottom | (400, 570) | -90° |
| Top | (400, 30) | 90° |
| Left | (30, 300) | 0° |
| Right | (770, 300) | 180° |

## License

MIT License

## Credits

Built with:
- [Phaser 3](https://phaser.io/) - Game framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [Express](https://expressjs.com/) - HTTP server
