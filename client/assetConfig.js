// Asset Configuration for Deep Sea Hunter V2.0
// Supports CDN-hosted assets with fallback to procedural generation

// Base URL for assets - can be overridden by setting window.ASSET_CDN_URL
const ASSET_BASE_URL = window.ASSET_CDN_URL || '/assets';

// Fish Species Configuration
// Each species belongs to a category (small/medium/large/giant/boss)
// The category determines core game mechanics (captureProb, multiplierRange)
// The species determines visual appearance
const FISH_SPECIES = [
    // Small Fish (Fast, Low Value) - Category: small
    { id: 'shrimp', category: 'small', spawnWeight: 25, color: 0xff9999, size: 0.7, name: 'Shrimp' },
    { id: 'clownfish', category: 'small', spawnWeight: 20, color: 0xff6600, size: 0.8, name: 'Clownfish' },
    { id: 'seahorse', category: 'small', spawnWeight: 18, color: 0x66ffcc, size: 0.85, name: 'Seahorse' },
    { id: 'starfish', category: 'small', spawnWeight: 15, color: 0xff6699, size: 0.9, name: 'Starfish' },
    
    // Medium Fish (Medium Speed/Value) - Category: medium
    { id: 'crab', category: 'medium', spawnWeight: 15, color: 0xff4444, size: 0.85, name: 'Crab' },
    { id: 'jellyfish', category: 'medium', spawnWeight: 12, color: 0xcc99ff, size: 0.9, name: 'Jellyfish' },
    { id: 'angelfish', category: 'medium', spawnWeight: 10, color: 0xffcc00, size: 0.95, name: 'Angelfish' },
    { id: 'pufferfish', category: 'medium', spawnWeight: 8, color: 0xffff66, size: 1.0, name: 'Pufferfish' },
    { id: 'octopus', category: 'medium', spawnWeight: 7, color: 0x9966cc, size: 1.1, name: 'Octopus' },
    
    // Large Fish (Slow, High Value) - Category: large
    { id: 'turtle', category: 'large', spawnWeight: 6, color: 0x66cc66, size: 1.0, name: 'Sea Turtle' },
    { id: 'swordfish', category: 'large', spawnWeight: 5, color: 0x6699cc, size: 1.1, name: 'Swordfish' },
    { id: 'dolphin', category: 'large', spawnWeight: 4, color: 0x6699ff, size: 1.15, name: 'Dolphin' },
    { id: 'stingray', category: 'large', spawnWeight: 3, color: 0x999999, size: 1.2, name: 'Stingray' },
    { id: 'shark', category: 'large', spawnWeight: 3, color: 0x666699, size: 1.3, name: 'Shark' },
    
    // Giant Fish (Very Slow, Very High Value) - Category: giant (maps to boss mechanics)
    { id: 'whale', category: 'giant', spawnWeight: 2, color: 0x3366cc, size: 1.8, name: 'Whale' },
    { id: 'mantaray', category: 'giant', spawnWeight: 2, color: 0x336699, size: 1.6, name: 'Manta Ray' },
    { id: 'hammerhead', category: 'giant', spawnWeight: 1, color: 0x555577, size: 1.7, name: 'Hammerhead' },
    { id: 'giantSquid', category: 'giant', spawnWeight: 1, color: 0x993366, size: 1.9, name: 'Giant Squid' },
    
    // Boss Fish (Special) - Category: boss
    { id: 'seaDragon', category: 'boss', spawnWeight: 0.5, color: 0xff3366, size: 2.0, name: 'Sea Dragon', isBoss: true },
    { id: 'kraken', category: 'boss', spawnWeight: 0.3, color: 0x660066, size: 2.5, name: 'Kraken', isBoss: true },
    
    // Special Fish (Triggers bonuses) - Category: special
    { id: 'goldenFish', category: 'special', spawnWeight: 5, color: 0xffd700, size: 1.0, name: 'Golden Fish', isSpecial: true }
];

// Category to server fish type mapping
// Maps our expanded categories to the server's existing FISH_TYPES
const CATEGORY_TO_SERVER_TYPE = {
    'small': 'small',
    'medium': 'medium',
    'large': 'large',
    'giant': 'boss',    // Giant fish use boss mechanics
    'boss': 'boss',
    'special': 'special'
};

// Get species by category
function getSpeciesByCategory(category) {
    return FISH_SPECIES.filter(s => s.category === category);
}

// Get species by ID
function getSpeciesById(speciesId) {
    return FISH_SPECIES.find(s => s.id === speciesId);
}

// Select random species from category using spawn weights
function selectSpeciesFromCategory(category) {
    const species = getSpeciesByCategory(category);
    if (species.length === 0) return null;
    
    const totalWeight = species.reduce((sum, s) => sum + s.spawnWeight, 0);
    let random = Math.random() * totalWeight;
    
    for (const s of species) {
        random -= s.spawnWeight;
        if (random <= 0) {
            return s;
        }
    }
    
    return species[0];
}

// Asset paths for CDN (when real assets are available)
const AssetPaths = {
    fish: {},
    effects: {
        explosion: `${ASSET_BASE_URL}/effects/explosion.png`,
        bubble: `${ASSET_BASE_URL}/effects/bubble.png`,
        ripple: `${ASSET_BASE_URL}/effects/ripple.png`
    }
};

// Populate fish asset paths
FISH_SPECIES.forEach(species => {
    AssetPaths.fish[species.id] = `${ASSET_BASE_URL}/fish/${species.id}.png`;
});

// Export to window for non-module usage
window.FISH_SPECIES = FISH_SPECIES;
window.CATEGORY_TO_SERVER_TYPE = CATEGORY_TO_SERVER_TYPE;
window.getSpeciesByCategory = getSpeciesByCategory;
window.getSpeciesById = getSpeciesById;
window.selectSpeciesFromCategory = selectSpeciesFromCategory;
window.AssetPaths = AssetPaths;
window.ASSET_BASE_URL = ASSET_BASE_URL;
