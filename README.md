# Deep Sea Hunter - Fishing Arcade Game

A top-down fishing arcade game built with Phaser 3. Click to fire bullets and capture fish using RNG-based probability mechanics. Features 5 fish types, 3 bonus features, and bullet level scaling.

## How to Run Locally

1. **Simple HTTP Server** (Python):
   ```bash
   cd deep-sea-hunter
   python3 -m http.server 8080
   ```
   Then open `http://localhost:8080` in your browser.

2. **Node.js HTTP Server**:
   ```bash
   npx http-server -p 8080
   ```
   Then open `http://localhost:8080` in your browser.

3. **Direct File** (may have CORS issues):
   Open `index.html` directly in a modern browser.

## Game Controls

- **Click/Tap**: Fire bullet toward cursor position
- **Bullet Level Buttons (1-10)**: Change bullet power and cost
- **Cannon**: Automatically aims toward cursor

## Gameplay Mechanics

### Core Loop
1. Click to fire bullets (costs coins based on bullet level)
2. Bullets that hit fish trigger an RNG capture check
3. If captured: earn `bullet_cost x fish_multiplier` coins
4. If missed: lose the bullet cost

### Fish Types

| Fish Type | Multiplier | Capture Rate | Spawn Weight | Description |
|-----------|------------|--------------|--------------|-------------|
| Small Fish | 2-5x | 25.5% | 50% | Most common, reliable income |
| Medium Fish | 6-12x | 10.25% | 25% | Mid-tier targets |
| Large Fish | 15-35x | 3.7% | 15% | High-value, challenging |
| Boss Fish | 50-100x | 1.35% | 5% | Very rare, huge rewards |
| Special Fish | 20x (fixed) | 4.4% | 5% | Triggers bonus features |

### Bullet Levels

| Level | Cost | Capture Bonus |
|-------|------|---------------|
| 1x | 10 coins | Base rate |
| 2x | 20 coins | +1% |
| 3x | 30 coins | +2% |
| 5x | 50 coins | +4% |
| 10x | 100 coins | +8% |

### Bonus Features

When a Special Fish is captured, one of three bonuses triggers randomly:

1. **Lock & Freeze** (33% chance)
   - Screen freezes for 3 seconds
   - 5 free auto-targeting shots at small/medium fish
   - 50% capture rate during bonus

2. **Chain Lightning** (33% chance)
   - Lightning chains through 2-4 small fish
   - Automatically captures connected fish
   - Visual electric arc effect

3. **Screen Clear** (34% chance)
   - Captures 3-6 fish on screen
   - Awards 50% of total captured value
   - Spectacular flash effect

## RTP (Return To Player) Analysis

### Target RTP: 95-96%

### Simulation Results (10,000 rounds, 50 shots each)

```
Total Shots Fired:     500,000
Total Coins Spent:     15,726,390
Total Coins Won:       14,971,325
Net Result:            -755,065

RTP (Return To Player): 95.20%
Overall Capture Rate:   17.41%
Bonuses Triggered:      864
```

### Capture Statistics by Fish Type

| Fish Type | Attempts | Captures | Actual Rate | Expected Rate |
|-----------|----------|----------|-------------|---------------|
| Small Fish | 253,803 | 67,552 | 26.6% | 25.5% |
| Medium Fish | 141,329 | 15,354 | 10.9% | 10.25% |
| Large Fish | 69,967 | 2,880 | 4.1% | 3.7% |
| Boss Fish | 16,270 | 303 | 1.9% | 1.35% |
| Special Fish | 18,631 | 956 | 5.1% | 4.4% |

### RTP Breakdown

- **Base Game RTP**: ~85%
- **Bonus Features RTP**: ~10%
- **Total RTP**: 95.20%

## Final Probability Table

```javascript
const PROBABILITY_TABLE = {
    baseBulletCost: 10,
    
    fishTypes: {
        small: {
            multiplierRange: [2, 5],
            baseCaptureProb: 0.255,
            spawnWeight: 50
        },
        medium: {
            multiplierRange: [6, 12],
            baseCaptureProb: 0.1025,
            spawnWeight: 25
        },
        large: {
            multiplierRange: [15, 35],
            baseCaptureProb: 0.037,
            spawnWeight: 15
        },
        boss: {
            multiplierRange: [50, 100],
            baseCaptureProb: 0.0135,
            spawnWeight: 5
        },
        special: {
            multiplierRange: [20, 20],
            baseCaptureProb: 0.044,
            spawnWeight: 5
        }
    },
    
    bulletLevelBonus: {
        1: 1.0,
        2: 1.01,
        3: 1.02,
        5: 1.04,
        10: 1.08
    }
};
```

## Running the RTP Simulation

```bash
node rtp-simulation.js
```

This runs a Monte Carlo simulation of 10,000 game rounds (500,000 total shots) to verify the RTP falls within the 95-96% target range.

## Project Structure

```
deep-sea-hunter/
├── index.html          # Main HTML file with UI
├── game.js             # Phaser 3 game logic
├── rtp-simulation.js   # RTP verification script
└── README.md           # This file
```

## Technical Details

- **Framework**: Phaser 3.70.0
- **Language**: Pure JavaScript (ES6+)
- **Graphics**: Procedurally generated using Phaser Graphics API
- **Responsive**: Scales to fit any screen size
- **Mobile**: Touch-friendly controls

## Deploying to GitHub Pages

1. Create a new GitHub repository
2. Push all files to the repository
3. Go to Settings > Pages
4. Select "Deploy from a branch" and choose `main`
5. Your game will be available at `https://username.github.io/repo-name/`

## Design Decisions

1. **Procedural Graphics**: Fish are drawn using Phaser's Graphics API rather than external sprites, ensuring the game works without any asset dependencies.

2. **RTP Balancing**: The original GDD specified high capture rates (60-80% for small fish) with high multipliers (2-8x), which would result in ~1000%+ RTP. The probabilities were mathematically adjusted to achieve the target 95-96% RTP while maintaining engaging gameplay.

3. **Conservative Bonuses**: Bonus features were tuned to contribute ~10% to overall RTP, preventing them from dominating the game economy.

4. **Bullet Level Scaling**: Higher bullet levels provide only marginal capture rate increases (+1-8%) to maintain RTP balance while giving players meaningful choices.

## License

This game was created as a demonstration project. Feel free to use and modify for educational purposes.
