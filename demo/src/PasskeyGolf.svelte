<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { account, server, native, fundPubkey } from './lib/common';
    import base64url from "base64url";
    import { Buffer } from "buffer";

    export let walletConnected = false;
    export let contractId = '';
    export let score = 0;
    export let gameMode: 'single' | 'multi' = 'single';
    export let onShotComplete: ((event: CustomEvent) => void) | undefined = undefined;
    
    // Game constants
    const GRAVITY = 0.2;
    const POWER_MULTIPLIER = 0.15;
    const MAX_POWER = 100;
    const STICK_LENGTH = 50;
    const GROUND_Y = 500;
    const MARKER_SIZE = 15;
    
    // Game variables
    let canvas, ctx;
    let ball = { x: 100, y: GROUND_Y, radius: 10, color: 'white' };
    let stick = { x: ball.x, y: ball.y, angle: -Math.PI/4, length: STICK_LENGTH, width: 5, color: 'brown' };
    let marker = { x: 0, y: GROUND_Y, size: MARKER_SIZE, color: 'red' };
    let trajectory = [];
    let particles = [];
    let isEliminated = false;
    
    // Stick Figure
    let stickFigure = {
        x: 70,
        y: GROUND_Y,
        width: 5,
        color: 'black',
        headRadius: 8,
        legLength: 20,
        armLength: 15,
        kickLeg: {
            angle: 0,
            targetAngle: Math.PI/2,
            speed: 0.1
        },
        isKicking: false,
        kickProgress: 0
    };
    
    let isCharging = false;
    let power = 0;
    let gameState = 'ready'; // ready, charging, simulating, scored
    let lastTime = 0;
    let powerBarAnimation = 0; // For power bar pulsing animation
    let animationFrame;
    let messageTimeout;

    // Passkey integration variables
    let keyId;
    let adminSigner;
    let balance = 0;

    let bonusShotAvailable = false;
    let showingMessage = false;
    let message = '';
    
    onMount(async () => {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        
        // Place marker at random position
        resetMarker();
        
        // Event listeners
        canvas.addEventListener('mousedown', startCharging);
        canvas.addEventListener('mouseup', releaseStick);
        document.getElementById('resetButton').addEventListener('click', resetGame);
        
        // Start game loop
        animationFrame = requestAnimationFrame(gameLoop);
        
        // If we have a wallet connected, check its balance
        if (walletConnected && contractId) {
            await getWalletData();
            keyId = localStorage.getItem("sp:keyId");
        }
    });
    
    onDestroy(() => {
        // Clean up
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        if (messageTimeout) {
            clearTimeout(messageTimeout);
        }
        
        // Remove event listeners
        if (canvas) {
            canvas.removeEventListener('mousedown', startCharging);
            canvas.removeEventListener('mouseup', releaseStick);
        }
    });
    
    function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        
        update(deltaTime);
        render();
        
        animationFrame = requestAnimationFrame(gameLoop);
    }
    
    function update(deltaTime) {
        // Update power bar animation (pulsing effect)
        powerBarAnimation += 0.05;
        
        // Update particles
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // Gravity for particles
            p.life -= 1;
            p.alpha = p.life / p.initialLife;
        });
        
        switch(gameState) {
            case 'ready':
                // Stick follows ball
                stick.x = ball.x;
                stick.y = ball.y;
                
                // Reset stick figure kick position
                stickFigure.kickLeg.angle = 0;
                stickFigure.isKicking = false;
                stickFigure.kickProgress = 0;
                break;
                
            case 'charging':
                // Increase power while charging
                power = Math.min(power + 1, MAX_POWER);
                break;
                
            case 'simulating':
                // Animate stick figure kicking if the kick hasn't completed
                if (!stickFigure.isKicking) {
                    // Start kicking animation
                    stickFigure.isKicking = true;
                    stickFigure.kickProgress = 0;
                    // Create hit particles 
                    createHitParticles(ball.x, ball.y, 10);
                }
                
                // Progress the kick animation
                if (stickFigure.kickProgress < 1) {
                    stickFigure.kickProgress += 0.1;
                    // Animate kick leg using easing function
                    const easedProgress = easeOutBack(stickFigure.kickProgress);
                    if (stickFigure.kickProgress < 0.5) {
                        // Wind up
                        stickFigure.kickLeg.angle = -easedProgress * Math.PI/3;
                    } else {
                        // Kick
                        stickFigure.kickLeg.angle = -(1 - easedProgress) * Math.PI/3 + easedProgress * Math.PI/2;
                    }
                }
                
                // Update ball position based on trajectory
                if (trajectory.length > 0) {
                    const nextPosition = trajectory.shift();
                    ball.x = nextPosition.x;
                    ball.y = nextPosition.y;
                    
                    // Check if ball stopped
                    if (trajectory.length === 0) {
                        gameState = 'scored';
                        calculateScore();
                    }
                }
                break;
        }
    }
    
    function easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    
    function render() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw ground
        ctx.fillStyle = '#3d8c40';
        ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
        
        // Draw large power bar at bottom of screen
        drawPowerBar();
        
        // Draw danger zone after marker
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(marker.x + 50, GROUND_Y - 50, canvas.width - marker.x - 50, 50);
        
        // Draw "DANGER" text
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('DANGER ZONE!', marker.x + 150, GROUND_Y - 25);
        
        // Draw marker
        ctx.fillStyle = marker.color;
        ctx.beginPath();
        ctx.moveTo(marker.x, marker.y);
        ctx.lineTo(marker.x - marker.size/2, marker.y + marker.size);
        ctx.lineTo(marker.x + marker.size/2, marker.y + marker.size);
        ctx.closePath();
        ctx.fill();
        
        // Draw ball
        ctx.fillStyle = ball.color;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw elimination effects
        if (isEliminated && gameState === 'scored') {
            // Draw flames around the ball
            const flickerAmount = Math.sin(Date.now() / 100) * 0.2 + 0.8;
            const radius = ball.radius * 1.5 * flickerAmount;
            
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const x = ball.x + Math.cos(angle) * radius;
                const y = ball.y + Math.sin(angle) * radius - 5;
                
                ctx.lineTo(x, y);
                
                const midAngle = angle + Math.PI / 8;
                const midRadius = radius * 1.5;
                const midX = ball.x + Math.cos(midAngle) * midRadius;
                const midY = ball.y + Math.sin(midAngle) * midRadius - 5;
                
                ctx.lineTo(midX, midY);
            }
            ctx.closePath();
            
            const gradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, radius * 2);
            gradient.addColorStop(0, 'rgba(255, 255, 0, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 120, 0, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        // Draw stick
        if (gameState === 'ready' || gameState === 'charging') {
            ctx.save();
            ctx.translate(stick.x, stick.y);
            ctx.rotate(stick.angle);
            ctx.fillStyle = stick.color;
            ctx.fillRect(0, 0, stick.length, stick.width);
            ctx.restore();
        }
        
        // Draw stick figure
        drawStickFigure();
        
        // Draw particles
        drawParticles();
        
        // Draw Passkey integration info
        if (walletConnected) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(10, 10, 250, 70);
            
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Wallet: ${contractId.substring(0, 8)}...`, 20, 30);
            ctx.fillText(`Balance: ${parseFloat((Number(balance) / 10_000_000).toFixed(7))} XLM`, 20, 50);
            
            if (bonusShotAvailable) {
                ctx.fillStyle = '#ffcc00';
                ctx.fillText(`⭐ Bonus Shot Available! ⭐`, 20, 70);
            }
        }
        
        // Draw score
        document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
        
        // Draw message box if needed
        if (showingMessage) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(canvas.width/2 - 150, canvas.height/2 - 40, 300, 80);
            
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(message, canvas.width/2, canvas.height/2);
            
            if (bonusShotAvailable) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '14px Arial';
                ctx.fillText('Press "B" to use your bonus shot!', canvas.width/2, canvas.height/2 + 25);
            }
        }
    }
    
    function drawPowerBar() {
        const barWidth = canvas.width - 40;
        const barHeight = 15;
        const barX = 20;
        const barY = canvas.height - 25;
        
        // Background of bar
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        if (gameState === 'charging') {
            // Filled portion with gradient effect
            const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
            gradient.addColorStop(0, '#0f0');
            gradient.addColorStop(0.5, '#ff0');
            gradient.addColorStop(1, '#f00');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(barX, barY, barWidth * (power / MAX_POWER), barHeight);
            
            // Pulsing highlight effect on current power level
            const pulseSize = 3 + Math.sin(powerBarAnimation) * 2;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(barX + barWidth * (power / MAX_POWER), barY + barHeight/2, pulseSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw power level text
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Power: ${power}%`, barX + barWidth/2, barY + barHeight - 3);
    }
    
    function drawStickFigure() {
        ctx.save();
        ctx.translate(stickFigure.x, stickFigure.y - stickFigure.legLength);
        
        // Draw head
        ctx.fillStyle = stickFigure.color;
        ctx.beginPath();
        ctx.arc(0, -stickFigure.headRadius, stickFigure.headRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw body
        ctx.lineWidth = stickFigure.width;
        ctx.strokeStyle = stickFigure.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, stickFigure.legLength);
        ctx.stroke();
        
        // Draw arms
        ctx.beginPath();
        ctx.moveTo(0, stickFigure.legLength * 0.3);
        ctx.lineTo(-stickFigure.armLength, stickFigure.legLength * 0.1);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, stickFigure.legLength * 0.3);
        ctx.lineTo(stickFigure.armLength, stickFigure.legLength * 0.1);
        ctx.stroke();
        
        // Draw left leg (static)
        ctx.beginPath();
        ctx.moveTo(0, stickFigure.legLength);
        ctx.lineTo(-stickFigure.legLength * 0.7, stickFigure.legLength * 1.8);
        ctx.stroke();
        
        // Draw right leg (kicking leg)
        ctx.save();
        ctx.translate(0, stickFigure.legLength);
        ctx.rotate(stickFigure.kickLeg.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(stickFigure.legLength, stickFigure.legLength * 0.8);
        ctx.stroke();
        ctx.restore();
        
        ctx.restore();
    }
    
    function createHitParticles(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            const size = 2 + Math.random() * 4;
            const life = 20 + Math.random() * 30;
            
            particles.push({
                x: x,
                y: y,
                size: size,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: `hsl(${Math.random() * 40 + 10}, 100%, 60%)`,
                life: life,
                initialLife: life,
                alpha: 1
            });
        }
    }
    
    function drawParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
    
    function startCharging() {
        if (gameState === 'ready') {
            gameState = 'charging';
            power = 0;
        }
    }
    
    function releaseStick() {
        if (gameState === 'charging') {
            gameState = 'simulating';
            calculateTrajectory();
        }
    }
    
    function calculateTrajectory() {
        trajectory = [];
        
        // Initial velocity components
        const velocity = power * POWER_MULTIPLIER;
        const vx = Math.cos(stick.angle) * velocity;
        const vy = Math.sin(stick.angle) * velocity;
        
        // Simulate trajectory
        let simX = ball.x;
        let simY = ball.y;
        let simVx = vx;
        let simVy = vy;
        
        while (simY <= GROUND_Y) {
            simX += simVx;
            simY += simVy;
            simVy += GRAVITY;
            
            // Bounce off walls
            if (simX < ball.radius || simX > canvas.width - ball.radius) {
                simVx *= -0.8;
            }
            
            // Add point to trajectory
            trajectory.push({x: simX, y: Math.min(simY, GROUND_Y)});
            
            // Stop if ball is rolling on ground
            if (simY >= GROUND_Y && Math.abs(simVy) < 0.5) {
                break;
            }
        }
    }
    
    async function calculateScore() {
        const distance = Math.abs(ball.x - marker.x);
        const maxDistance = canvas.width / 2;
        
        // Check if ball went past the marker
        if (ball.x > marker.x + 50) {
            // Player is eliminated for going too far
            isEliminated = true;
            score = Math.max(0, score - 50); // Penalty for going too far
            ball.color = 'red'; // Change ball color to show elimination
            showMessage("ELIMINATED! You went too far! -50 points");
            createHitParticles(ball.x, ball.y, 30); // Larger explosion effect
            
            // Make the particles more dramatic for elimination
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 5;
                const size = 3 + Math.random() * 5;
                const life = 30 + Math.random() * 60;
                
                particles.push({
                    x: ball.x,
                    y: ball.y,
                    size: size,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 3, // More upward explosion
                    color: `hsl(${0 + Math.random() * 20}, 100%, 50%)`, // Red-orange flames
                    life: life,
                    initialLife: life,
                    alpha: 1
                });
            }
            
            // If wallet is connected, burn some tokens as penalty
            if (walletConnected && contractId && Number(balance) >= 1_000_000) {
                await sendPenaltyTransaction();
            }
        } else {
            // Calculate score based on proximity (closer = higher score)
            const rawScore = Math.max(0, 100 - Math.floor((distance / maxDistance) * 100));
            
            let pointsEarned = 0;
            
            // Extra points for very close hits
            if (distance < 20) {
                pointsEarned = rawScore * 2;
                score += pointsEarned;
                showMessage(`Perfect shot! +${pointsEarned} points!`);
                
                // If wallet is connected, give a bonus shot
                if (walletConnected && contractId) {
                    bonusShotAvailable = true;
                }
            } else if (distance < 50) {
                pointsEarned = rawScore;
                score += pointsEarned;
                showMessage(`Great shot! +${pointsEarned} points!`);
            } else {
                pointsEarned = Math.floor(rawScore / 2);
                score += pointsEarned;
                showMessage(`Nice try! +${pointsEarned} points!`);
            }
            
            // If wallet is connected, send a small reward for good shots
            if (walletConnected && contractId && pointsEarned > 50 && Number(balance) >= 5_000_000) {
                await sendRewardTransaction();
            }
        }
    }
    
    function showMessage(msg) {
        message = msg;
        showingMessage = true;
        
        // Clear any existing timeout
        if (messageTimeout) {
            clearTimeout(messageTimeout);
        }
        
        // Auto-reset after a delay
        messageTimeout = setTimeout(() => {
            showingMessage = false;
            resetForNextShot();
        }, 3000);
    }
    
    function resetForNextShot() {
        gameState = 'ready';
        resetMarker();
        ball.x = 100;
        ball.y = GROUND_Y;
        ball.color = 'white'; // Reset ball color
        power = 0;
        isEliminated = false;
    }
    
    function resetMarker() {
        // Place marker at random position
        marker.x = 400 + Math.random() * 300;
    }
    
    function resetGame() {
        gameState = 'ready';
        resetMarker();
        ball.x = 100;
        ball.y = GROUND_Y;
        ball.color = 'white'; // Reset ball color
        power = 0;
        score = 0;
        isEliminated = false;
        bonusShotAvailable = false;
        particles = [];
    }
    
    // Passkey integration functions
    
    async function getWalletData() {
        try {
            if (contractId) {
                // Get wallet balance
                const { result } = await native.balance({ id: contractId });
                balance = result.toString();
                
                // Get wallet signers to find admin signer
                const signers = await server.getSigners(contractId);
                const adminKeys = signers.filter(({ limits }) => limits === "AAAAEAAAAAEAAAABAAAAAQ==");
                if (adminKeys.length > 0) {
                    adminSigner = adminKeys[0].key;
                }
            }
        } catch (err) {
            console.error("Error fetching wallet data:", err);
        }
    }
    
    async function sendRewardTransaction() {
        try {
            // Small XLM reward for good shots (0.1 XLM)
            const reward = BigInt(1_000_000);
            
            // If we have enough balance, send a small reward to player's address
            if (Number(balance) >= Number(reward) * 2) {
                const at = await native.transfer({
                    to: fundPubkey, // Transfer to fund address for demo purposes
                    from: contractId,
                    amount: reward
                });
                
                await account.sign(at, { keyId });
                await server.send(at.built);
                
                // Update balance after transaction
                await getWalletData();
                
                showMessage("Bonus points! Sent reward transaction!");
            }
        } catch (err) {
            console.error("Error sending reward:", err);
        }
    }
    
    async function sendPenaltyTransaction() {
        try {
            // Small XLM penalty for elimination (0.1 XLM)
            const penalty = BigInt(1_000_000);
            
            // If we have enough balance, burn a small amount
            if (Number(balance) >= Number(penalty) * 2) {
                const at = await native.transfer({
                    to: fundPubkey, // Transfer to fund address for demo purposes
                    from: contractId,
                    amount: penalty
                });
                
                await account.sign(at, { keyId });
                await server.send(at.built);
                
                // Update balance after transaction
                await getWalletData();
                
                showMessage("Penalty! Lost 0.1 XLM for going too far!");
            }
        } catch (err) {
            console.error("Error sending penalty:", err);
        }
    }
    
    function useBonusShot() {
        if (bonusShotAvailable && gameState === 'ready') {
            bonusShotAvailable = false;
            
            // Give a special advantage (e.g., a more forgiving angle)
            stick.angle = -Math.PI/6; // Less steep angle for better shots
            
            showMessage("Bonus shot activated! Better angle!");
        }
    }
    
    // Listen for 'B' key to use bonus shot
    function handleKeyDown(event) {
        if (event.key === 'b' || event.key === 'B') {
            useBonusShot();
        }
    }
    
    // Add keyboard event listener
    onMount(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    });
</script>

<div class="game-wrapper">
    <div class="canvas-container">
        <canvas id="gameCanvas" width="800" height="550"></canvas>
        <div id="scoreDisplay">Score: {score}</div>
        <div id="gameControls">
            <button id="resetButton">Reset Game</button>
            <span id="powerDisplay">Power: {power}%</span>
            {#if bonusShotAvailable}
                <button on:click={useBonusShot} class="bonus-button">Use Bonus Shot (B)</button>
            {/if}
        </div>
    </div>
    
    {#if walletConnected}
        <div class="passkey-info">
            <h3>Connected Passkey Wallet</h3>
            <p>Address: {contractId}</p>
            <p>Balance: {parseFloat((Number(balance) / 10_000_000).toFixed(7))} XLM</p>
            <p>Earn XLM with perfect shots!</p>
        </div>
    {:else}
        <div class="passkey-info">
            <h3>Passkey Features Disabled</h3>
            <p>Connect your wallet to enable special features:</p>
            <ul>
                <li>Bonus shots for perfect hits</li>
                <li>XLM rewards for good shots</li>
                <li>Penalties for going too far</li>
            </ul>
        </div>
    {/if}
</div>

<style>
    .game-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }
    
    .canvas-container {
        position: relative;
        width: 800px;
        height: 600px;
        overflow: hidden;
    }
    
    canvas {
        background-color: #a8e6cf;
        border: 2px solid #333;
    }
    
    #scoreDisplay {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        background-color: rgba(255, 255, 255, 0.7);
        border-radius: 5px;
        font-weight: bold;
    }
    
    #gameControls {
        margin-top: 10px;
        text-align: center;
    }
    
    button {
        padding: 8px 16px;
        margin: 0 5px;
        cursor: pointer;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
    }
    
    button:hover {
        background-color: #45a049;
    }
    
    .bonus-button {
        background-color: #ffc107;
        color: #333;
        font-weight: bold;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .passkey-info {
        margin-top: 20px;
        padding: 15px;
        background-color: #f5f5f5;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        width: 100%;
        text-align: center;
    }
    
    .passkey-info h3 {
        margin-top: 0;
        color: #333;
    }
    
    .passkey-info ul {
        text-align: left;
        padding-left: 30px;
    }
</style>