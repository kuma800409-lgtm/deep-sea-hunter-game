// Deep Sea Hunter V2.0 - Automated Multiplayer Test Script
// Simulates gameplay to verify RTP and server stability

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ITERATIONS = parseInt(process.env.ITERATIONS) || 100;
const SHOTS_PER_SESSION = parseInt(process.env.SHOTS_PER_SESSION) || 50;

const results = {
    totalIterations: 0,
    completedIterations: 0,
    totalShots: 0,
    totalCaptures: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    errors: [],
    fishTypeCaptures: {
        small: 0,
        medium: 0,
        large: 0,
        boss: 0,
        special: 0
    },
    bonusTriggered: {
        lockAndFreeze: 0,
        chainLightning: 0,
        fullScreenClear: 0
    },
    startTime: null,
    endTime: null
};

async function runSingleSession(sessionId) {
    return new Promise((resolve, reject) => {
        const socket = io(SERVER_URL, {
            transports: ['websocket'],
            timeout: 10000
        });
        
        let sessionCoinsEarned = 0;
        let sessionCoinsSpent = 0;
        let sessionShots = 0;
        let sessionCaptures = 0;
        let shotsFired = 0;
        let gameStarted = false;
        let sessionTimeout;
        
        // Timeout for entire session
        sessionTimeout = setTimeout(() => {
            if (!gameStarted) {
                results.errors.push(`Session ${sessionId}: Game never started`);
            }
            socket.disconnect();
            resolve({
                coinsEarned: sessionCoinsEarned,
                coinsSpent: sessionCoinsSpent,
                shots: sessionShots,
                captures: sessionCaptures
            });
        }, 60000); // 60 second timeout per session
        
        socket.on('connect', () => {
            socket.emit('join_room', {
                playerName: `TestBot${sessionId}`,
                roomId: null
            });
        });
        
        socket.on('connect_error', (error) => {
            results.errors.push(`Session ${sessionId}: Connection error - ${error.message}`);
            clearTimeout(sessionTimeout);
            socket.disconnect();
            resolve({
                coinsEarned: 0,
                coinsSpent: 0,
                shots: 0,
                captures: 0
            });
        });
        
        socket.on('joined_room', (data) => {
            // Start game immediately (we're the host)
            setTimeout(() => {
                socket.emit('start_game');
            }, 500);
        });
        
        socket.on('game_start', (data) => {
            gameStarted = true;
            
            // Fire shots at random intervals
            const fireShot = () => {
                if (shotsFired >= SHOTS_PER_SESSION) {
                    // Session complete
                    clearTimeout(sessionTimeout);
                    socket.disconnect();
                    resolve({
                        coinsEarned: sessionCoinsEarned,
                        coinsSpent: sessionCoinsSpent,
                        shots: sessionShots,
                        captures: sessionCaptures
                    });
                    return;
                }
                
                // Random target position
                const targetX = 50 + Math.random() * 700;
                const targetY = 50 + Math.random() * 500;
                
                socket.emit('shoot', {
                    targetX: targetX,
                    targetY: targetY,
                    bulletLevel: 1
                });
                
                shotsFired++;
                sessionShots++;
                sessionCoinsSpent += 10; // 1x bullet cost
                
                // Fire next shot after random delay (simulating human play)
                setTimeout(fireShot, 200 + Math.random() * 300);
            };
            
            // Start firing after a short delay
            setTimeout(fireShot, 1000);
        });
        
        socket.on('fish_captured', (data) => {
            sessionCaptures++;
            sessionCoinsEarned += data.reward;
            
            // Track fish type
            if (data.fishType && results.fishTypeCaptures[data.fishType] !== undefined) {
                results.fishTypeCaptures[data.fishType]++;
            }
        });
        
        socket.on('bonus_triggered', (data) => {
            if (data.bonusType === 'lockAndFreeze') {
                results.bonusTriggered.lockAndFreeze++;
            } else if (data.bonusType === 'chainLightning') {
                results.bonusTriggered.chainLightning++;
            } else if (data.bonusType === 'fullScreenClear') {
                results.bonusTriggered.fullScreenClear++;
            }
        });
        
        socket.on('chain_lightning', (data) => {
            sessionCoinsEarned += data.totalReward || 0;
        });
        
        socket.on('full_screen_clear', (data) => {
            sessionCoinsEarned += data.totalReward || 0;
        });
        
        socket.on('error', (data) => {
            results.errors.push(`Session ${sessionId}: ${data.message}`);
        });
        
        socket.on('disconnect', () => {
            clearTimeout(sessionTimeout);
        });
    });
}

async function runAutomatedTests() {
    console.log('='.repeat(60));
    console.log('DEEP SEA HUNTER V2.0 - AUTOMATED TEST');
    console.log('='.repeat(60));
    console.log(`Server URL: ${SERVER_URL}`);
    console.log(`Iterations: ${ITERATIONS}`);
    console.log(`Shots per session: ${SHOTS_PER_SESSION}`);
    console.log('='.repeat(60));
    console.log('');
    
    results.startTime = Date.now();
    results.totalIterations = ITERATIONS;
    
    // Run sessions sequentially to avoid overwhelming the server
    for (let i = 0; i < ITERATIONS; i++) {
        process.stdout.write(`\rRunning session ${i + 1}/${ITERATIONS}...`);
        
        try {
            const sessionResult = await runSingleSession(i + 1);
            
            results.totalShots += sessionResult.shots;
            results.totalCaptures += sessionResult.captures;
            results.coinsEarned += sessionResult.coinsEarned;
            results.coinsSpent += sessionResult.coinsSpent;
            results.completedIterations++;
        } catch (error) {
            results.errors.push(`Session ${i + 1}: ${error.message}`);
        }
        
        // Small delay between sessions
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    results.endTime = Date.now();
    
    // Calculate RTP
    const rtp = results.coinsSpent > 0 
        ? (results.coinsEarned / results.coinsSpent * 100).toFixed(2) 
        : 0;
    
    const duration = ((results.endTime - results.startTime) / 1000).toFixed(1);
    const captureRate = results.totalShots > 0 
        ? (results.totalCaptures / results.totalShots * 100).toFixed(2) 
        : 0;
    
    console.log('\n');
    console.log('='.repeat(60));
    console.log('AUTOMATED TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Iterations: ${results.totalIterations}`);
    console.log(`Completed Iterations: ${results.completedIterations}`);
    console.log(`Total Duration: ${duration} seconds`);
    console.log('-'.repeat(60));
    console.log(`Total Shots Fired: ${results.totalShots}`);
    console.log(`Total Fish Captured: ${results.totalCaptures}`);
    console.log(`Capture Rate: ${captureRate}%`);
    console.log('-'.repeat(60));
    console.log(`Coins Spent: ${results.coinsSpent}`);
    console.log(`Coins Earned: ${results.coinsEarned}`);
    console.log(`Net Profit/Loss: ${results.coinsEarned - results.coinsSpent}`);
    console.log(`RTP: ${rtp}%`);
    console.log('-'.repeat(60));
    console.log('Fish Type Captures:');
    console.log(`  Small: ${results.fishTypeCaptures.small}`);
    console.log(`  Medium: ${results.fishTypeCaptures.medium}`);
    console.log(`  Large: ${results.fishTypeCaptures.large}`);
    console.log(`  Boss: ${results.fishTypeCaptures.boss}`);
    console.log(`  Special: ${results.fishTypeCaptures.special}`);
    console.log('-'.repeat(60));
    console.log('Bonus Features Triggered:');
    console.log(`  Lock & Freeze: ${results.bonusTriggered.lockAndFreeze}`);
    console.log(`  Chain Lightning: ${results.bonusTriggered.chainLightning}`);
    console.log(`  Full Screen Clear: ${results.bonusTriggered.fullScreenClear}`);
    console.log('-'.repeat(60));
    console.log(`Errors: ${results.errors.length}`);
    if (results.errors.length > 0 && results.errors.length <= 10) {
        results.errors.forEach(err => console.log(`  - ${err}`));
    } else if (results.errors.length > 10) {
        results.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
        console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
    console.log('='.repeat(60));
    
    // RTP Analysis
    console.log('');
    console.log('RTP ANALYSIS:');
    if (rtp >= 95 && rtp <= 96) {
        console.log(`  Status: PASS - RTP ${rtp}% is within target range (95-96%)`);
    } else if (rtp >= 90 && rtp <= 100) {
        console.log(`  Status: ACCEPTABLE - RTP ${rtp}% is close to target range`);
    } else {
        console.log(`  Status: WARNING - RTP ${rtp}% is outside expected range`);
    }
    console.log('');
    
    return results;
}

// Run the tests
runAutomatedTests()
    .then(() => {
        console.log('Test completed.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
