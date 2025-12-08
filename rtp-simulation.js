/**
 * Deep Sea Hunter - RTP (Return To Player) Simulation
 * 
 * This script simulates 10,000+ game rounds to calculate and verify
 * that the game's RTP falls within the target range of 95-96%.
 * 
 * Run with: node rtp-simulation.js
 */

// ============================================
// PROBABILITY TABLE (must match game.js)
// ============================================

const PROBABILITY_TABLE = {
    baseBulletCost: 10,
    
    // RTP-BALANCED: Capture probabilities calculated for 95-96% RTP
    // Formula: capture_prob = target_RTP / average_multiplier
    // Base game contributes ~85% RTP, bonuses add ~10% for total ~95%
    fishTypes: {
        small: {
            name: 'Small Fish',
            multiplierRange: [2, 5],      // Avg: 3.5x
            baseCaptureProb: 0.255,       // 25.5% capture (final tuned for 95-96% RTP)
            spawnWeight: 50,
        },
        medium: {
            name: 'Medium Fish',
            multiplierRange: [6, 12],     // Avg: 9x
            baseCaptureProb: 0.1025,      // 10.25% capture (final tuned for 95-96% RTP)
            spawnWeight: 25,
        },
        large: {
            name: 'Large Fish',
            multiplierRange: [15, 35],    // Avg: 25x
            baseCaptureProb: 0.037,       // 3.7% capture (final tuned for 95-96% RTP)
            spawnWeight: 15,
        },
        boss: {
            name: 'Boss Fish',
            multiplierRange: [50, 100],   // Avg: 75x
            baseCaptureProb: 0.0135,      // 1.35% capture (final tuned for 95-96% RTP)
            spawnWeight: 5,
        },
        special: {
            name: 'Special Fish',
            multiplierRange: [20, 20],    // Fixed 20x
            baseCaptureProb: 0.044,       // 4.4% capture (final tuned for 95-96% RTP)
            spawnWeight: 5,
            isSpecial: true
        }
    },
    
    // Bullet level multipliers for capture probability (max +8%)
    bulletLevelBonus: {
        1: 1.0,
        2: 1.01,
        3: 1.02,
        5: 1.04,
        10: 1.08
    },
    
    bonusFeatures: {
        lockAndFreeze: { probability: 0.33 },
        chainLightning: { probability: 0.33 },
        fullScreenClear: { probability: 0.34 }
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function selectFishType() {
    const types = Object.keys(PROBABILITY_TABLE.fishTypes);
    const weights = types.map(t => PROBABILITY_TABLE.fishTypes[t].spawnWeight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < types.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return types[i];
        }
    }
    return types[0];
}

function calculateCaptureChance(fishType, bulletLevel) {
    const fish = PROBABILITY_TABLE.fishTypes[fishType];
    const baseProb = fish.baseCaptureProb;
    const levelBonus = PROBABILITY_TABLE.bulletLevelBonus[bulletLevel] || 1.0;
    return Math.min(baseProb * levelBonus, 0.95);
}

function selectBonusFeature() {
    const features = PROBABILITY_TABLE.bonusFeatures;
    const random = Math.random();
    
    if (random < features.lockAndFreeze.probability) {
        return 'lockAndFreeze';
    } else if (random < features.lockAndFreeze.probability + features.chainLightning.probability) {
        return 'chainLightning';
    } else {
        return 'fullScreenClear';
    }
}

// ============================================
// SIMULATION ENGINE
// ============================================

class RTPSimulator {
    constructor() {
        this.totalSpent = 0;
        this.totalWon = 0;
        this.shotsFired = 0;
        this.fishCaptured = 0;
        this.bonusTriggered = 0;
        this.capturesByType = {};
        this.attemptsByType = {};
        
        // Initialize counters
        Object.keys(PROBABILITY_TABLE.fishTypes).forEach(type => {
            this.capturesByType[type] = 0;
            this.attemptsByType[type] = 0;
        });
    }
    
    /**
     * Simulate a single shot at a fish
     */
    simulateShot(bulletLevel = 1) {
        const bulletCost = PROBABILITY_TABLE.baseBulletCost * bulletLevel;
        this.totalSpent += bulletCost;
        this.shotsFired++;
        
        // Select a random fish type (simulating what fish the player targets)
        const fishType = this.selectTargetFish(bulletLevel);
        const fishConfig = PROBABILITY_TABLE.fishTypes[fishType];
        
        this.attemptsByType[fishType]++;
        
        // Generate fish multiplier
        const multiplier = getRandomInRange(
            fishConfig.multiplierRange[0],
            fishConfig.multiplierRange[1]
        );
        
        // Calculate capture chance
        const captureChance = calculateCaptureChance(fishType, bulletLevel);
        
        // RNG check
        const captured = Math.random() < captureChance;
        
        if (captured) {
            const reward = bulletCost * multiplier;
            this.totalWon += reward;
            this.fishCaptured++;
            this.capturesByType[fishType]++;
            
            // Check for special fish bonus
            if (fishConfig.isSpecial) {
                this.simulateBonus(bulletLevel);
            }
            
            return { captured: true, reward, fishType, multiplier };
        }
        
        return { captured: false, reward: 0, fishType, multiplier };
    }
    
    /**
     * Simulate player targeting behavior
     * Players tend to target based on value/risk assessment
     */
    selectTargetFish(bulletLevel) {
        // Higher bullet levels tend to target higher value fish
        const targetingWeights = {
            1: { small: 60, medium: 25, large: 10, boss: 2, special: 3 },
            2: { small: 55, medium: 28, large: 12, boss: 2, special: 3 },
            3: { small: 50, medium: 30, large: 14, boss: 3, special: 3 },
            5: { small: 40, medium: 32, large: 18, boss: 5, special: 5 },
            10: { small: 30, medium: 30, large: 25, boss: 8, special: 7 }
        };
        
        const weights = targetingWeights[bulletLevel] || targetingWeights[1];
        const types = Object.keys(weights);
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        
        let random = Math.random() * totalWeight;
        for (const type of types) {
            random -= weights[type];
            if (random <= 0) {
                return type;
            }
        }
        return 'small';
    }
    
    /**
     * Simulate bonus feature
     */
    simulateBonus(bulletLevel) {
        this.bonusTriggered++;
        const bonusType = selectBonusFeature();
        
        switch (bonusType) {
            case 'lockAndFreeze':
                this.simulateLockAndFreeze();
                break;
            case 'chainLightning':
                this.simulateChainLightning();
                break;
            case 'fullScreenClear':
                this.simulateFullScreenClear();
                break;
        }
    }
    
    /**
     * Lock & Freeze: 5 free shots with 50% capture rate on small/medium fish
     * Conservative bonus to maintain RTP balance
     */
    simulateLockAndFreeze() {
        const freeShots = 5;
        
        for (let i = 0; i < freeShots; i++) {
            // Target small/medium fish (more realistic)
            const fishTypes = ['small', 'small', 'medium'];
            const fishType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
            const fishConfig = PROBABILITY_TABLE.fishTypes[fishType];
            
            // 50% capture rate during Lock & Freeze (not 100%)
            if (Math.random() < 0.5) {
                const multiplier = getRandomInRange(
                    fishConfig.multiplierRange[0],
                    fishConfig.multiplierRange[1]
                );
                
                const reward = PROBABILITY_TABLE.baseBulletCost * multiplier;
                this.totalWon += reward;
                this.fishCaptured++;
                this.capturesByType[fishType]++;
            }
        }
    }
    
    /**
     * Chain Lightning: Captures 2-4 small fish
     * Conservative bonus to maintain RTP balance
     */
    simulateChainLightning() {
        // Capture 2-4 small fish
        const fishCount = getRandomInRange(2, 4);
        
        for (let i = 0; i < fishCount; i++) {
            const fishConfig = PROBABILITY_TABLE.fishTypes.small;
            const multiplier = getRandomInRange(
                fishConfig.multiplierRange[0],
                fishConfig.multiplierRange[1]
            );
            
            const reward = PROBABILITY_TABLE.baseBulletCost * multiplier;
            this.totalWon += reward;
            this.fishCaptured++;
            this.capturesByType.small++;
        }
    }
    
    /**
     * Full Screen Clear: 50% of 3-6 fish value on screen
     * Conservative bonus to maintain RTP balance
     */
    simulateFullScreenClear() {
        // Capture 3-6 fish at 50% value
        const fishCount = getRandomInRange(3, 6);
        let totalValue = 0;
        
        for (let i = 0; i < fishCount; i++) {
            const fishType = selectFishType();
            const fishConfig = PROBABILITY_TABLE.fishTypes[fishType];
            const multiplier = getRandomInRange(
                fishConfig.multiplierRange[0],
                fishConfig.multiplierRange[1]
            );
            
            totalValue += PROBABILITY_TABLE.baseBulletCost * multiplier;
            this.capturesByType[fishType]++;
        }
        
        const reward = Math.floor(totalValue * 0.5);
        this.totalWon += reward;
        this.fishCaptured += fishCount;
    }
    
    /**
     * Run full simulation
     */
    runSimulation(rounds = 10000, shotsPerRound = 50) {
        console.log('='.repeat(60));
        console.log('DEEP SEA HUNTER - RTP SIMULATION');
        console.log('='.repeat(60));
        console.log(`Simulating ${rounds.toLocaleString()} rounds with ${shotsPerRound} shots each...`);
        console.log('');
        
        // Simulate player behavior with varying bullet levels
        const bulletLevelDistribution = {
            1: 0.30,  // 30% of shots at level 1
            2: 0.25,  // 25% at level 2
            3: 0.20,  // 20% at level 3
            5: 0.15,  // 15% at level 5
            10: 0.10  // 10% at level 10
        };
        
        for (let round = 0; round < rounds; round++) {
            for (let shot = 0; shot < shotsPerRound; shot++) {
                // Select bullet level based on distribution
                const bulletLevel = this.selectBulletLevel(bulletLevelDistribution);
                this.simulateShot(bulletLevel);
            }
        }
        
        this.printResults();
    }
    
    selectBulletLevel(distribution) {
        const random = Math.random();
        let cumulative = 0;
        
        for (const [level, prob] of Object.entries(distribution)) {
            cumulative += prob;
            if (random < cumulative) {
                return parseInt(level);
            }
        }
        return 1;
    }
    
    printResults() {
        const rtp = (this.totalWon / this.totalSpent) * 100;
        const captureRate = (this.fishCaptured / this.shotsFired) * 100;
        
        console.log('SIMULATION RESULTS');
        console.log('-'.repeat(60));
        console.log(`Total Shots Fired:     ${this.shotsFired.toLocaleString()}`);
        console.log(`Total Coins Spent:     ${this.totalSpent.toLocaleString()}`);
        console.log(`Total Coins Won:       ${this.totalWon.toLocaleString()}`);
        console.log(`Net Result:            ${(this.totalWon - this.totalSpent).toLocaleString()}`);
        console.log('');
        console.log(`RTP (Return To Player): ${rtp.toFixed(2)}%`);
        console.log(`Overall Capture Rate:   ${captureRate.toFixed(2)}%`);
        console.log(`Bonuses Triggered:      ${this.bonusTriggered.toLocaleString()}`);
        console.log('');
        
        console.log('CAPTURE STATISTICS BY FISH TYPE');
        console.log('-'.repeat(60));
        
        Object.keys(PROBABILITY_TABLE.fishTypes).forEach(type => {
            const config = PROBABILITY_TABLE.fishTypes[type];
            const attempts = this.attemptsByType[type];
            const captures = this.capturesByType[type];
            const actualRate = attempts > 0 ? (captures / attempts * 100) : 0;
            
            console.log(`${config.name.padEnd(15)} | Attempts: ${attempts.toString().padStart(8)} | ` +
                       `Captures: ${captures.toString().padStart(8)} | ` +
                       `Rate: ${actualRate.toFixed(1)}% (expected: ${(config.baseCaptureProb * 100).toFixed(1)}%)`);
        });
        
        console.log('');
        console.log('RTP ANALYSIS');
        console.log('-'.repeat(60));
        
        if (rtp >= 95 && rtp <= 96) {
            console.log(`[PASS] RTP of ${rtp.toFixed(2)}% is within target range (95-96%)`);
        } else if (rtp < 95) {
            console.log(`[ADJUST] RTP of ${rtp.toFixed(2)}% is BELOW target. Consider:`);
            console.log('  - Increasing capture probabilities');
            console.log('  - Increasing bonus trigger rates');
            console.log('  - Increasing bonus rewards');
        } else {
            console.log(`[ADJUST] RTP of ${rtp.toFixed(2)}% is ABOVE target. Consider:`);
            console.log('  - Decreasing capture probabilities');
            console.log('  - Decreasing bonus trigger rates');
            console.log('  - Decreasing bonus rewards');
        }
        
        console.log('');
        console.log('='.repeat(60));
        
        return rtp;
    }
}

// ============================================
// RTP OPTIMIZER
// ============================================

class RTPOptimizer {
    constructor(targetRTP = 95.5, tolerance = 0.5) {
        this.targetRTP = targetRTP;
        this.tolerance = tolerance;
    }
    
    /**
     * Automatically adjust probabilities to hit target RTP
     */
    optimize(maxIterations = 10) {
        console.log('');
        console.log('='.repeat(60));
        console.log('RTP OPTIMIZATION');
        console.log('='.repeat(60));
        console.log(`Target RTP: ${this.targetRTP}% (+/- ${this.tolerance}%)`);
        console.log('');
        
        let iteration = 0;
        let currentRTP = 0;
        
        while (iteration < maxIterations) {
            iteration++;
            console.log(`\n--- Optimization Iteration ${iteration} ---\n`);
            
            // Run simulation
            const simulator = new RTPSimulator();
            simulator.runSimulation(5000, 50); // Faster iterations for optimization
            currentRTP = (simulator.totalWon / simulator.totalSpent) * 100;
            
            // Check if within target range
            if (Math.abs(currentRTP - this.targetRTP) <= this.tolerance) {
                console.log(`\n[SUCCESS] Achieved target RTP after ${iteration} iterations!`);
                break;
            }
            
            // Adjust probabilities
            this.adjustProbabilities(currentRTP);
        }
        
        // Final verification with larger sample
        console.log('\n--- Final Verification (10,000 rounds) ---\n');
        const finalSimulator = new RTPSimulator();
        finalSimulator.runSimulation(10000, 50);
        
        return PROBABILITY_TABLE;
    }
    
    adjustProbabilities(currentRTP) {
        const diff = this.targetRTP - currentRTP;
        const adjustmentFactor = diff / 100; // Small adjustments
        
        console.log(`Adjusting probabilities by factor: ${(adjustmentFactor * 100).toFixed(3)}%`);
        
        // Adjust capture probabilities
        Object.keys(PROBABILITY_TABLE.fishTypes).forEach(type => {
            const fish = PROBABILITY_TABLE.fishTypes[type];
            const oldProb = fish.baseCaptureProb;
            
            // Adjust probability (capped between 0.01 and 0.95)
            fish.baseCaptureProb = Math.max(0.01, Math.min(0.95, 
                oldProb * (1 + adjustmentFactor)
            ));
            
            console.log(`  ${fish.name}: ${(oldProb * 100).toFixed(1)}% -> ${(fish.baseCaptureProb * 100).toFixed(1)}%`);
        });
    }
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         DEEP SEA HUNTER - RTP SIMULATION TOOL              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Run initial simulation
    const simulator = new RTPSimulator();
    const rtp = simulator.runSimulation(10000, 50);
    
    // If RTP is outside target range, run optimizer
    if (rtp < 95 || rtp > 96) {
        console.log('\nRTP outside target range. Running optimizer...\n');
        const optimizer = new RTPOptimizer(95.5, 0.5);
        const optimizedTable = optimizer.optimize(5);
        
        console.log('\n');
        console.log('FINAL OPTIMIZED PROBABILITY TABLE');
        console.log('='.repeat(60));
        console.log(JSON.stringify(optimizedTable.fishTypes, null, 2));
    }
    
    console.log('\n');
    console.log('Simulation complete. Copy the optimized probabilities to game.js if needed.');
    console.log('\n');
}

// Run if executed directly
if (typeof window === 'undefined') {
    main();
}

module.exports = { RTPSimulator, RTPOptimizer, PROBABILITY_TABLE };
