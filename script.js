// --- Configuration ---
const config = {
    rows: 16,
    pegSize: 10,
    pegSpacingX: 30, // Total width per peg unit (peg + margin)
    rowSpacingY: 32, // Total height per row unit
    ballSize: 16,
    startBalance: 500.00,
    betCost: 2.00,
    // Number of balls to drop per play (default: single)
    ballsPerDrop: 1,
    // Multipliers mirroring the "High" risk pattern (high edges, low center)
    multipliers: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    colors: ['red', 'red', 'red', 'orange', 'orange', 'orange', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'orange', 'orange', 'orange', 'red', 'red', 'red']
};

// --- State ---
let currentState = {
    balance: config.startBalance,
    isPlaying: false,
    activeBalls: 0
};
// Stats tracking
currentState.totalWagered = 0;
currentState.totalWon = 0;
currentState.wins = 0;
currentState.losses = 0;

// --- DOM Elements ---
const balanceEl = document.getElementById('balance-amount');
const playBtn = document.getElementById('play-btn');
const pyramidContainer = document.getElementById('pyramid-container');
const multipliersContainer = document.getElementById('multipliers-container');

// --- Initialization ---
function initGame() {
    updateBalanceUI();
    createBoard();
    playBtn.addEventListener('click', handlePlayClick);
    updateStatsUI();
}

function updateBalanceUI() {
    balanceEl.textContent = `$${currentState.balance.toFixed(2)}`;
    // Enable/disable Play button based on available balance only
    if (playBtn) playBtn.disabled = currentState.balance < config.betCost;
}

function formatCurrency(v) {
    return `$${v.toFixed(2)}`;
}

function updateStatsUI() {
    const wageredEl = document.getElementById('stats-wagered');
    const profitEl = document.getElementById('stats-profit');
    const winsEl = document.getElementById('stats-wins');
    const lossesEl = document.getElementById('stats-losses');

    if (wageredEl) wageredEl.textContent = formatCurrency(currentState.totalWagered);
    const profit = currentState.totalWon - currentState.totalWagered;
    if (profitEl) {
        profitEl.textContent = formatCurrency(profit);
        profitEl.classList.remove('stat-profit-positive', 'stat-profit-negative');
        if (profit > 0) profitEl.classList.add('stat-profit-positive');
        else if (profit < 0) profitEl.classList.add('stat-profit-negative');
    }
    if (winsEl) winsEl.textContent = `${currentState.wins}`;
    if (lossesEl) lossesEl.textContent = `${currentState.losses}`;
}

function createBoard() {
    // 1. Generate Pegs Pyramid
    for (let row = 0; row < config.rows; row++) {
        const rowEl = document.createElement('div');
        rowEl.classList.add('peg-row');
        // Number of pegs increases by 1 each row (starting from 3 for better visuals at top)
        const pegsInRow = row + 3; 
        for (let i = 0; i < pegsInRow; i++) {
            const peg = document.createElement('div');
            peg.classList.add('peg', 'glass');
            rowEl.appendChild(peg);
        }
        pyramidContainer.appendChild(rowEl);
    }

    // 2. Generate Multiplier Slots at bottom
    config.multipliers.forEach((val, index) => {
        const slot = document.createElement('div');
        slot.classList.add('slot', `slot-${config.colors[index]}`);
        slot.textContent = `${val}x`;
        slot.id = `slot-${index}`;
        multipliersContainer.appendChild(slot);
    });
}


// --- Game Logic & Animation ---

function handlePlayClick() {
    const balls = Math.max(1, config.ballsPerDrop || 1);
    const totalCost = config.betCost * balls;
    if (currentState.balance < totalCost) return;

    // Deduct total cost for this click's balls
    currentState.balance -= totalCost;
    updateBalanceUI();
    // Track total wagered
    currentState.totalWagered += totalCost;
    updateStatsUI();

    // Track active balls so user may keep spawning while others fall
    currentState.activeBalls += balls;

    // Spawn balls without awaiting so clicks remain responsive
    for (let i = 0; i < balls; i++) {
        const stagger = i * 60; // 60ms between spawns
        dropBall(stagger).then(() => {
            currentState.activeBalls = Math.max(0, currentState.activeBalls - 1);
            // when last ball finishes, ensure UI state is consistent
            if (currentState.activeBalls === 0) {
                // nothing special to do for now
            }
        });
    }
}

function dropBall(startDelay = 0) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const ball = document.createElement('div');
            ball.classList.add('ball');
            pyramidContainer.appendChild(ball);

            // Calculate path beforehand (simplified physics: 50/50 L/R at each peg)
            let path = [];
            let currentSlotIndex = 0; // Starts at the "center" of the path options

            for (let i = 0; i < config.rows; i++) {
                // 0 = Left, 1 = Right
                const direction = Math.random() > 0.5 ? 1 : 0; 
                path.push(direction);
                currentSlotIndex += direction;
            }
             // currentSlotIndex now ranges from 0 to 16, matching our multiplier array indices

            let currentRow = 0;

            // Animation Interval
            const animationInterval = setInterval(() => {
                if (currentRow < config.rows) {
                    // Move ball down to next row
                    const nextStepIndex = path.slice(0, currentRow + 1).reduce((a,b) => a+b, 0);
                    
                    // Calculate visual positions relative to the container
                    // Center offset determines how far left/right from center line the ball is
                    const rowWidth = (currentRow + 3) * config.pegSpacingX;
                    const centerOffset = (nextStepIndex - (currentRow/2)) * config.pegSpacingX;
                    
                    const topPos = (currentRow + 1) * config.rowSpacingY;
                    // Slight random horizontal jitter for realism
                    const jitter = (Math.random() - 0.5) * 4; 

                    ball.style.top = `${topPos}px`;
                    // Adjust translateX to center ball relative to pyramid center
                    ball.style.transform = `translateX(calc(-50% + ${centerOffset + jitter}px))`;

                    currentRow++;
                } else {
                    // Reached Bottom
                    clearInterval(animationInterval);
                    finishDrop(ball, currentSlotIndex, resolve);
                }
            }, 250); // Speed of the drop between rows
        }, startDelay);
    });
}

function finishDrop(ball, finalIndex, resolveCallback) {
    // 1. Snap ball to final slot position slightly below the last row
    const finalTop = (config.rows * config.rowSpacingY) + 20;
    // Calculate precise final horizontal position based on the slot index
    // This formula aligns the ball's final position with the multiplier slots
    const totalSlots = config.multipliers.length;
    const centerIndex = (totalSlots - 1) / 2;
    const finalOffset = (finalIndex - centerIndex) * (600 / totalSlots); // 600 is max-width of container

    ball.style.top = `${finalTop}px`;
    ball.style.transform = `translateX(calc(-50% + ${finalOffset}px))`;
    
    // 2. Calculate Winnings
    const multiplier = config.multipliers[finalIndex];
    const winnings = config.betCost * multiplier;
    currentState.balance += winnings;
    // Update stats
    currentState.totalWon += winnings;
    if (multiplier > 1) currentState.wins += 1;
    else currentState.losses += 1;
    updateStatsUI();
    
    // 3. Visual Feedback
    const winningSlot = document.getElementById(`slot-${finalIndex}`);
    winningSlot.classList.add('active-win');

    setTimeout(() => {
        updateBalanceUI();
        ball.remove();
        winningSlot.classList.remove('active-win');
        resolveCallback(); // Finish the game loop
    }, 1000);
}

// Start the game
initGame();
