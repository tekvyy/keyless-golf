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
let score = 0;
let gameState = 'ready'; // ready, charging, simulating, scored
let lastTime = 0;
let powerBarAnimation = 0; // For power bar pulsing animation

// Initialize the game
window.onload = function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Place marker at random position
    resetMarker();
    
    // Event listeners
    canvas.addEventListener('mousedown', startCharging);
    canvas.addEventListener('mouseup', releaseStick);
    document.getElementById('resetButton').addEventListener('click', resetGame);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
};

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    update(deltaTime);
    render();
    
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    const powerDisplay = document.getElementById('powerDisplay');
    
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
            powerDisplay.textContent = `Power: ${power}%`;
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
    
    // Draw score
    document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
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

function calculateScore() {
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
    } else {
        // Calculate score based on proximity (closer = higher score)
        const rawScore = Math.max(0, 100 - Math.floor((distance / maxDistance) * 100));
        
        // Extra points for very close hits
        if (distance < 20) {
            score += rawScore * 2;
            showMessage("Perfect shot! Double points!");
        } else if (distance < 50) {
            score += rawScore;
            showMessage("Great shot!");
        } else {
            score += Math.floor(rawScore / 2);
            showMessage("Nice try!");
        }
    }
}

function showMessage(message) {
    // Display a floating message
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 25, 200, 50);
    
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width/2, canvas.height/2 + 5);
    
    // Auto-reset after a delay
    setTimeout(resetForNextShot, 2000);
}

function resetForNextShot() {
    gameState = 'ready';
    resetMarker();
    ball.x = 100;
    ball.y = GROUND_Y;
    ball.color = 'white'; // Reset ball color
    power = 0;
    isEliminated = false;
    document.getElementById('powerDisplay').textContent = 'Power: 0%';
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
    particles = [];
    document.getElementById('powerDisplay').textContent = 'Power: 0%';
}