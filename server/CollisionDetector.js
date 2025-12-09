class CollisionDetector {
    constructor(room) {
        this.room = room;
    }
    
    checkBulletFishCollision(bullet) {
        const fishManager = this.room.fishManager;
        const allFish = fishManager.getAllFish();
        
        for (const fish of allFish) {
            if (this.circleCollision(bullet, fish)) {
                return fish;
            }
        }
        
        return null;
    }
    
    circleCollision(bullet, fish) {
        const bulletRadius = 10 + (bullet.bulletLevel || 1) * 2;
        const fishRadius = fish.hitRadius || 30;
        
        const dx = bullet.x - fish.x;
        const dy = bullet.y - fish.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < (bulletRadius + fishRadius);
    }
    
    pointInCircle(x, y, circleX, circleY, radius) {
        const dx = x - circleX;
        const dy = y - circleY;
        return (dx * dx + dy * dy) <= (radius * radius);
    }
    
    getFishInRadius(x, y, radius) {
        const fishManager = this.room.fishManager;
        const allFish = fishManager.getAllFish();
        const result = [];
        
        for (const fish of allFish) {
            const dx = x - fish.x;
            const dy = y - fish.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= radius) {
                result.push(fish);
            }
        }
        
        return result;
    }
}

module.exports = CollisionDetector;
