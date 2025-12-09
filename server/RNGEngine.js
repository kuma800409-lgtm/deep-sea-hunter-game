// Authoritative RNG Engine for server-side capture probability
// This ensures all capture decisions are made on the server

class RNGEngine {
    constructor() {
        // Bullet level bonuses (higher level = slightly better capture rate)
        this.bulletLevelBonus = {
            1: 1.0,
            2: 1.02,
            3: 1.04,
            5: 1.06,
            10: 1.10
        };
        
        // Bonus feature probabilities
        this.bonusProbabilities = {
            lockAndFreeze: 0.33,
            chainLightning: 0.33,
            fullScreenClear: 0.34
        };
    }
    
    // Roll for fish capture
    rollCapture(fish, bulletLevel) {
        const baseProb = fish.captureProb;
        const levelBonus = this.bulletLevelBonus[bulletLevel] || 1.0;
        const finalProb = Math.min(baseProb * levelBonus, 0.95); // Cap at 95%
        
        const roll = Math.random();
        return roll < finalProb;
    }
    
    // Roll for bonus type when special fish is captured
    rollBonusType() {
        const roll = Math.random();
        let cumulative = 0;
        
        for (const [type, prob] of Object.entries(this.bonusProbabilities)) {
            cumulative += prob;
            if (roll < cumulative) {
                return type;
            }
        }
        
        return 'lockAndFreeze'; // Default fallback
    }
    
    // Get random number in range
    randomInRange(min, max) {
        return min + Math.random() * (max - min);
    }
    
    // Get random integer in range (inclusive)
    randomIntInRange(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    }
    
    // Weighted random selection
    weightedRandom(options) {
        // options = [{value: any, weight: number}, ...]
        const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const option of options) {
            random -= option.weight;
            if (random <= 0) {
                return option.value;
            }
        }
        
        return options[0].value;
    }
}

module.exports = RNGEngine;
