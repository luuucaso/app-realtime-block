// app.js

// 1. UI Elements Mapping
const sliders = {
    spawnInterval: document.getElementById('spawn-interval'),
    spawnX: document.getElementById('spawn-x'),
    restitution: document.getElementById('restitution'),
    colorTolerance: document.getElementById('color-tolerance'),
    goalTolerance: document.getElementById('goal-tolerance'),
    sMin: document.getElementById('s-min'),
    vMin: document.getElementById('v-min'),
    boxOpacity: document.getElementById('box-opacity')
};

const labels = {
    spawnInterval: document.getElementById('interval-val'),
    spawnX: document.getElementById('spawn-x-val'),
    restitution: document.getElementById('restitution-val'),
    colorTolerance: document.getElementById('color-tolerance-val'),
    goalTolerance: document.getElementById('goal-tolerance-val'),
    sMin: document.getElementById('s-min-val'),
    vMin: document.getElementById('v-min-val'),
    boxOpacity: document.getElementById('box-opacity-val')
};

const targetColorPicker = document.getElementById('target-color');
const goalColorPicker = document.getElementById('goal-color');
const scoreLeftMsg = document.getElementById('score-left');
const scoreRightMsg = document.getElementById('score-right');
const timerMsg = document.getElementById('timer-msg');
const phaseMsg = document.getElementById('phase-msg');
const resultOverlay = document.getElementById('result-overlay');
const resultText = document.getElementById('result-text');
let score1 = 0;
let score2 = 0;
let lastRenderedScores = { score1: 0, score2: 0 };
let gameAudioCtx = null;
const ballTrailMap = new Map();
const fxState = {
    particles: [],
    flashes: [],
    floatTexts: []
};
const fxLimits = {
    maxParticles: 180,
    maxFlashes: 20,
    maxFloatTexts: 10,
    maxTrailPointsPerBall: 8,
    trailMinSpeed: 240
};
const gameConfig = {
    matchDurationSec: 90,
    phase2WarningRemainingSec: 65,
    phase2TriggerRemainingSec: 60,
    negativeBallProbability: 0.5
};
const gameState = {
    matchRunning: false,
    matchEnded: false,
    phase2Active: false,
    phase2BreakActive: false,
phase2BreakStarted: false,
    matchStartMs: 0,
    matchEndMs: 0,
    remainingSec: gameConfig.matchDurationSec
};


function ensureAudioContext() {
    if (!gameAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        gameAudioCtx = new AudioCtx();
    }
    if (gameAudioCtx.state === 'suspended') {
        gameAudioCtx.resume().catch(() => {});
    }
    return gameAudioCtx;
}

function playScoreSound(playerNumber) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(playerNumber === 1 ? 640 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(playerNumber === 1 ? 900 : 760, now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
}

function playNegativeScoreSound() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

function updateTimerDisplay() {
    if (timerMsg) timerMsg.textContent = `${Math.max(0, gameState.remainingSec)}`;
}

function showResultOverlay(message) {
    if (!resultOverlay || !resultText) return;
    resultText.textContent = message;
    resultOverlay.classList.add('show');
}

function hideResultOverlay() {
    if (!resultOverlay) return;
    resultOverlay.classList.remove('show');
}

function showPhase2Warning() {
    gameState.phase2WarningShown = true;

    if (phaseMsg) {
        phaseMsg.textContent = "⚠️ FASE 2 EN 5 SEGUNDOS";
        phaseMsg.classList.add("active");
    }

    if (timerMsg && typeof timerMsg.animate === "function") {
        timerMsg.animate(
            [
                { transform: "scale(1)", filter: "brightness(1)" },
                { transform: "scale(1.25)", filter: "brightness(1.8)" },
                { transform: "scale(1)", filter: "brightness(1)" }
            ],
            {
                duration: 600,
                easing: "ease-out"
            }
        );
    }
}
function startPhase2Break() {
    gameState.phase2BreakActive = true;
    gameState.phase2BreakStarted = true;
    gameState.matchRunning = false;

    // Congelar pelotas actuales
    balls.forEach((ball) => {
        Matter.Body.setVelocity(ball, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(ball, 0);
        Matter.Body.setStatic(ball, true);
    });

    resultText.textContent = "DESCANSO\nFASE 2 EN 5";
    resultText.style.whiteSpace = "pre-line";
    resultText.style.color = "#ffcc00";
    resultText.style.borderColor = "#ffcc00";
    resultText.style.boxShadow = "0 0 50px rgba(255, 204, 0, 0.8)";
    resultText.style.textShadow = "0 0 25px rgba(255, 204, 0, 1)";
    resultOverlay.classList.add("show");

    let countdown = 5;

    const breakInterval = setInterval(() => {
        countdown--;

        resultText.textContent = `DESCANSO\nFASE 2 EN ${countdown}`;

        if (countdown <= 0) {
            clearInterval(breakInterval);
            endPhase2Break();
        }

    }, 1000);
}

function endPhase2Break() {
    gameState.phase2BreakActive = false;
    gameState.matchRunning = true;

    // Reactivar pelotas
    balls.forEach((ball) => {
        Matter.Body.setStatic(ball, false);
    });

    hideResultOverlay();

    // Ajustar el fin del partido para no perder esos 5 segundos
    gameState.matchEndMs = Date.now() + gameState.remainingSec * 1000;

    activatePhase2Visuals();
}
function activatePhase2Visuals() {
    gameState.phase2Active = true;
    rainClouds.forEach((cloud) => {
        cloud.body.render.fillStyle = 'rgba(255, 84, 84, 0.9)';
        cloud.body.render.strokeStyle = 'rgba(255, 40, 40, 0.95)';
    });
    if (phaseMsg) {
        phaseMsg.textContent = 'FASE 2 - DIFICULTAD ALTA';
        phaseMsg.classList.add('active');
    }
    if (timerMsg && typeof timerMsg.animate === 'function') {
        timerMsg.animate(
            [
                { transform: 'scale(1)', filter: 'brightness(1)' },
                { transform: 'scale(1.2)', filter: 'brightness(1.7)' },
                { transform: 'scale(1)', filter: 'brightness(1)' }
            ],
            { duration: 500, easing: 'ease-out' }
        );
    }
}

function startMatch() {
    gameState.matchRunning = true;
    gameState.matchEnded = false;
    gameState.phase2Active = false;
    gameState.phase2BreakActive = false;
gameState.phase2BreakStarted = false;
    gameState.matchStartMs = Date.now();
    gameState.matchEndMs = gameState.matchStartMs + gameConfig.matchDurationSec * 1000;
    gameState.remainingSec = gameConfig.matchDurationSec;
    hideResultOverlay();
    if (phaseMsg) {
        phaseMsg.textContent = '';
        phaseMsg.classList.remove('active');
    }
    rainClouds.forEach((cloud) => {
        cloud.body.render.fillStyle = 'rgba(225, 230, 245, 0.85)';
        cloud.body.render.strokeStyle = 'rgba(200, 210, 230, 0.95)';
    });
    updateTimerDisplay();
}

function resetMatch() {
    // Detener partida
    gameState.matchRunning = false;
    gameState.matchEnded = false;
    gameState.phase2Active = false;
    gameState.phase2BreakActive = false;
gameState.phase2BreakStarted = false;
    gameState.remainingSec = gameConfig.matchDurationSec;

    // Reiniciar timer
    updateTimerDisplay();

    // Reiniciar overlay
    hideResultOverlay();

    // Reiniciar fase
    if (phaseMsg) {
        phaseMsg.textContent = "";
        phaseMsg.classList.remove("active");
    }

    // Reiniciar nubes
    rainClouds.forEach((cloud) => {
        cloud.body.render.fillStyle = "rgba(225, 230, 245, 0.85)";
        cloud.body.render.strokeStyle = "rgba(200, 210, 230, 0.95)";
    });

    // Borrar pelotas
    balls.forEach(ball => Composite.remove(world, ball));
    balls = [];
    ballTrailMap.clear();

    // Limpiar efectos
    fxState.particles = [];
    fxState.flashes = [];
    fxState.floatTexts = [];

    // Reiniciar puntajes
    score1 = 0;
    score2 = 0;
    updateScoreDisplay();
}

function endMatch() {
    gameState.matchRunning = false;
    gameState.matchEnded = true;

    if (score1 > score2) {

        resultText.textContent = "GANA ROJO";
        resultText.style.color = "#ff2b2b";
        resultText.style.borderColor = "#ff2b2b";
        resultText.style.boxShadow = "0 0 50px rgba(255,0,0,0.8)";
        resultText.style.textShadow = "0 0 25px rgba(255,0,0,1)";

    } else if (score2 > score1) {

        resultText.textContent = "GANA AZUL";
        resultText.style.color = "#3fa9ff";
        resultText.style.borderColor = "#3fa9ff";
        resultText.style.boxShadow = "0 0 50px rgba(0,120,255,0.8)";
        resultText.style.textShadow = "0 0 25px rgba(0,120,255,1)";

    } else {

        resultText.textContent = "EMPATE";
        resultText.style.color = "#ffffff";
        resultText.style.borderColor = "#ffffff";
        resultText.style.boxShadow = "0 0 50px rgba(255,255,255,0.5)";
        resultText.style.textShadow = "0 0 25px rgba(255,255,255,1)";

    }

    resultOverlay.classList.add("show");
    resultText.animate(
    [
        { transform: "scale(0.5)", opacity: 0 },
        { transform: "scale(1.15)", opacity: 1 },
        { transform: "scale(1)", opacity: 1 }
    ],
    {
        duration: 500,
        easing: "ease-out"
    }
);

    balls.forEach((ball) => {
        Matter.Body.setVelocity(ball, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(ball, 0);
        Matter.Body.setStatic(ball, true);
    });
}

function updateMatchClock(nowMs) {
    if (!gameState.matchRunning || gameState.matchEnded) return;
    const remainingMs = Math.max(0, gameState.matchEndMs - nowMs);
    const newRemainingSec = Math.ceil(remainingMs / 1000);
    if (newRemainingSec !== gameState.remainingSec) {
        gameState.remainingSec = newRemainingSec;
        updateTimerDisplay();
    }
    if (
    !gameState.phase2Active &&
    !gameState.phase2BreakStarted &&
    gameState.remainingSec <= gameConfig.phase2TriggerRemainingSec
) {
    startPhase2Break();
    return;
}
    if (remainingMs <= 0) {
        gameState.remainingSec = 0;
        updateTimerDisplay();
        endMatch();
    }
}

function addFloatingPlusOne(element, color) {
    if (!element) return;
    if (fxState.floatTexts.length >= fxLimits.maxFloatTexts) {
        fxState.floatTexts.shift();
    }
    const rect = element.getBoundingClientRect();
    fxState.floatTexts.push({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        vy: -80,
        text: '+1',
        color,
        life: 700,
        maxLife: 700
    });
}

function addFlash(x, y, color, radius = 34, lifeMs = 180) {
    if (fxState.flashes.length >= fxLimits.maxFlashes) {
        fxState.flashes.shift();
    }
    fxState.flashes.push({ x, y, color, radius, life: lifeMs, maxLife: lifeMs });
}

function addParticles(x, y, options = {}) {
    const count = options.count || 10;
    const color = options.color || 'rgba(120, 205, 255, 1)';
    const speedMin = options.speedMin || 40;
    const speedMax = options.speedMax || 220;
    const lifeMin = options.lifeMin || 160;
    const lifeMax = options.lifeMax || 480;
    const sizeMin = options.sizeMin || 2;
    const sizeMax = options.sizeMax || 4.5;
    const freeSlots = Math.max(0, fxLimits.maxParticles - fxState.particles.length);
    const finalCount = Math.min(count, freeSlots);
    for (let i = 0; i < finalCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const life = lifeMin + Math.random() * (lifeMax - lifeMin);
        fxState.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: sizeMin + Math.random() * (sizeMax - sizeMin),
            drag: 0.9 + Math.random() * 0.08,
            life,
            maxLife: life,
            color
        });
    }
}

function animateScoreCounter(element, accentColor) {
    if (!element || typeof element.animate !== 'function') return;
    element.animate(
        [
            { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', textShadow: '0 0 0 rgba(0,0,0,0)' },
            {
                transform: 'scale(1.3)',
                filter: 'brightness(1.55)',
                boxShadow: `0 0 34px ${accentColor}, inset 0 0 24px ${accentColor}`,
                textShadow: `0 0 24px ${accentColor}, 0 0 42px ${accentColor}`
            },
            {
                transform: 'scale(1.12)',
                filter: 'brightness(1.2)',
                boxShadow: `0 0 20px ${accentColor}, inset 0 0 12px ${accentColor}`,
                textShadow: `0 0 14px ${accentColor}`
            },
            { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', textShadow: '0 0 0 rgba(0,0,0,0)' }
        ],
        {
            duration: 460,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'none'
        }
    );
}

function updateScoreDisplay() {
    const deltaLeft = score1 - lastRenderedScores.score1;
    const deltaRight = score2 - lastRenderedScores.score2;

    if (scoreLeftMsg) scoreLeftMsg.textContent = `Jugador 1: ${score1}`;
    if (scoreRightMsg) scoreRightMsg.textContent = `Jugador 2: ${score2}`;

    if (deltaLeft > 0) {
        animateScoreCounter(scoreLeftMsg, 'rgba(255, 80, 80, 0.95)');
        addFloatingPlusOne(scoreLeftMsg, 'rgba(255, 120, 120, 1)');
        playScoreSound(1);
    } else if (deltaLeft < 0) {
        animateScoreCounter(scoreLeftMsg, 'rgba(255, 40, 40, 0.95)');
        addFloatingPlusOne(scoreLeftMsg, 'rgba(255, 80, 80, 1)');
        if (fxState.floatTexts.length > 0) {
            fxState.floatTexts[fxState.floatTexts.length - 1].text = '-1';
        }
        playNegativeScoreSound();
    }
    if (deltaRight > 0) {
        animateScoreCounter(scoreRightMsg, 'rgba(80, 170, 255, 0.95)');
        addFloatingPlusOne(scoreRightMsg, 'rgba(120, 205, 255, 1)');
        playScoreSound(2);
    } else if (deltaRight < 0) {
        animateScoreCounter(scoreRightMsg, 'rgba(70, 130, 255, 0.95)');
        addFloatingPlusOne(scoreRightMsg, 'rgba(120, 205, 255, 1)');
        if (fxState.floatTexts.length > 0) {
            fxState.floatTexts[fxState.floatTexts.length - 1].text = '-1';
        }
        playNegativeScoreSound();
    }

    lastRenderedScores.score1 = score1;
    lastRenderedScores.score2 = score2;
}

updateScoreDisplay();
updateTimerDisplay();


const cameraSelect = document.getElementById('camera-select');
const startBtn = document.getElementById('start-btn');
const toggleBgBtn = document.getElementById('toggle-bg-btn');
const clearBtn = document.getElementById('clear-balls');
const statusMsg = document.getElementById('status-msg');
const uiPanel = document.getElementById('ui-panel');
const videoBgContainer = document.getElementById('video-bg-container');

// Update labels on input
Object.keys(sliders).forEach(key => {
    sliders[key].addEventListener('input', (e) => {
        labels[key].textContent = e.target.value;
    });
});

window.addEventListener('keydown', (e) => {

    const key = e.key.toLowerCase();

    // Mostrar/Ocultar menú
    if (key === 'h') {
        uiPanel.style.display =
            uiPanel.style.display === 'none' ? 'block' : 'none';
    }

    // Resetear partida
    if (key === 'r') {
        resetMatch();
    }

    // Iniciar partida
    if (key === 't') {

        if (!gameState.matchRunning) {

            // por seguridad elimina las pelotas anteriores
            balls.forEach(ball => Composite.remove(world, ball));
            balls = [];
            ballTrailMap.clear();

            startMatch();
        }

    }

});

toggleBgBtn.addEventListener('click', () => {
    videoBgContainer.style.display = videoBgContainer.style.display === 'none' ? 'block' : 'none';
});

// Wait for OpenCV.js
let cvReady = false;
window.onOpenCvReady = function () {
    cvReady = true;
    statusMsg.textContent = "OpenCV Ready! Waiting to start...";
    console.log('OpenCV.js is ready.');
};

// 2. Matter.js Initialization
const { Engine, Render, Runner, World, Bodies, Composite, Events } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.positionIterations = 12;
engine.velocityIterations = 10;
engine.constraintIterations = 4;

const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent'
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    const dtMs = engine.timing.lastDelta || 16.6667;
    const dtSec = Math.max(0.001, dtMs / 1000);

    balls.forEach((ball) => {
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
        const p = ball.position;
        const hue = (ball.plugin && ball.plugin.hue) || 200;

        const trail = ballTrailMap.get(ball.id) || [];
        trail.push({ x: p.x, y: p.y, speed });
        if (trail.length > fxLimits.maxTrailPointsPerBall) trail.shift();
        ballTrailMap.set(ball.id, trail);

        // Soft neon glow
        const glowRadius = 18 + Math.min(speed * 0.03, 12);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        glow.addColorStop(0, `hsla(${hue}, 95%, 72%, 0.48)`);
        glow.addColorStop(1, `hsla(${hue}, 95%, 45%, 0)`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Depth shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(p.x + 4, p.y + 7, ball.circleRadius * 0.9, ball.circleRadius * 0.55, 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Trail for fast movement
        if (speed > fxLimits.trailMinSpeed && trail.length > 2) {
            ctx.save();
            ctx.lineCap = 'round';
            for (let i = 1; i < trail.length; i++) {
                const a = trail[i - 1];
                const b = trail[i];
                const t = i / trail.length;
                ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.08 + t * 0.2})`;
                ctx.lineWidth = 1 + t * 5;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    });

    fxState.flashes = fxState.flashes.filter((f) => {
        f.life -= dtMs;
        if (f.life <= 0) return false;
        const t = f.life / f.maxLife;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = f.color.replace(', 1)', `, ${0.25 + t * 0.75})`);
        ctx.lineWidth = 2 + (1 - t) * 5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * (1 + (1 - t) * 0.45), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return true;
    });

    fxState.particles = fxState.particles.filter((particle) => {
        particle.life -= dtMs;
        if (particle.life <= 0) return false;
        particle.vx *= particle.drag;
        particle.vy *= particle.drag;
        particle.vy += 220 * dtSec;
        particle.x += particle.vx * dtSec;
        particle.y += particle.vy * dtSec;
        const t = particle.life / particle.maxLife;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = particle.color.replace(', 1)', `, ${Math.max(0, t)})`);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (0.45 + t), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
    });

    fxState.floatTexts = fxState.floatTexts.filter((txt) => {
        txt.life -= dtMs;
        if (txt.life <= 0) return false;
        txt.y += txt.vy * dtSec;
        const t = txt.life / txt.maxLife;
        ctx.save();
        // screen-space draw
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = t;
        ctx.font = '700 38px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = txt.color;
        ctx.shadowColor = txt.color;
        ctx.shadowBlur = 18;
        ctx.fillText(txt.text, txt.x, txt.y);
        ctx.restore();
        return true;
    });
    // Dibujar nubes
rainClouds.forEach(cloud => {

    const p = cloud.body.position;

    const ctx = render.context;

    ctx.save();

    ctx.fillStyle = gameState.phase2Active
        ? "#ff5555"
        : "#f5f5f5";

    ctx.shadowColor = gameState.phase2Active
        ? "#ff0000"
        : "#ffffff";

    ctx.shadowBlur = 20;

    ctx.beginPath();

    ctx.arc(p.x - 50, p.y + 5, 28, 0, Math.PI * 2);
    ctx.arc(p.x - 25, p.y - 15, 35, 0, Math.PI * 2);
    ctx.arc(p.x + 10, p.y - 20, 40, 0, Math.PI * 2);
    ctx.arc(p.x + 45, p.y - 5, 32, 0, Math.PI * 2);
    ctx.arc(p.x + 65, p.y + 10, 24, 0, Math.PI * 2);

    ctx.fill();

    ctx.fillRect(
    p.x - 60,
    p.y - 5,
    120,
    35
);
    ctx.restore();

});
});

// 3. Environment boundaries (floor & walls)
let walls = [];
let midDivider = null;

function createBoundaries() {
    if (walls.length > 0) Composite.remove(world, walls);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const thickness = 100;

    // Left, Right (Removed Bottom wall so balls fall through)
    walls = [
        Bodies.rectangle(0 - thickness / 2, h / 2, thickness, h * 2, { isStatic: true }),
        Bodies.rectangle(w + thickness / 2, h / 2, thickness, h * 2, { isStatic: true })
    ];
    Composite.add(world, walls);
}
createBoundaries();

function createMidDivider() {
    if (midDivider) {
        Composite.remove(world, midDivider);
    }

    const dividerWidth = 20;
    const dividerHeight = window.innerHeight;
    midDivider = Bodies.rectangle(window.innerWidth / 2, window.innerHeight / 2, dividerWidth, dividerHeight, {
        isStatic: true,
        isSensor: false,
        label: 'mid-divider',
        render: {
            fillStyle: 'rgba(255, 255, 255, 0.85)',
            strokeStyle: 'rgba(0, 0, 0, 0.9)',
            lineWidth: 3
        }
    });

    Composite.add(world, midDivider);
}
createMidDivider();

// Handle window resize
window.addEventListener('resize', () => {
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    createBoundaries();
    createMidDivider();
    createRainClouds();
});

// 4. Webcam Setup & OpenCV Processing Loop
const video = document.getElementById('webcam');
const hiddenCanvas = document.getElementById('hidden-canvas');
const ctx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
const videoBgCanvas = document.getElementById('video-bg');
const bgCtx = videoBgCanvas.getContext('2d');

let webcamActive = false;
let procCols = 640;
let procRows = 480;

startBtn.addEventListener('click', async () => {
    if (webcamActive) return;
    if (!cvReady) {
        alert("Please wait for OpenCV to load.");
        return;
    }

    try {
        statusMsg.textContent = "Requesting webcam access...";
        let constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };

        if (cameraSelect.value) {
            constraints.video.deviceId = { exact: cameraSelect.value };
        } else {
            constraints.video.facingMode = 'user';
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e1) {
            console.warn("First camera request failed, trying fallback...", e1);
            // Fallback to any available video without specific constraints
            constraints = { video: cameraSelect.value ? { deviceId: { exact: cameraSelect.value } } : true };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        }

        video.srcObject = stream;
        video.play();

        // Populate camera selector if not already populated
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (cameraSelect.options.length <= 1) {
            cameraSelect.innerHTML = ''; // clear default
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${index + 1}`;
                if (stream.getVideoTracks()[0].label === device.label) {
                    option.selected = true; // highlight currently used
                }
                cameraSelect.appendChild(option);
            });
        }

        video.onloadedmetadata = () => {
            // Keep aspect ratio for processing
            let aspect = video.videoWidth / video.videoHeight;
            procRows = 400; // lower res for faster cv processing
            procCols = Math.floor(procRows * aspect);

            hiddenCanvas.width = procCols;
            hiddenCanvas.height = procRows;

            // Background canvas matches screen size
            videoBgCanvas.width = window.innerWidth;
            videoBgCanvas.height = window.innerHeight;

            if (!webcamActive) {
                webcamActive = true;
                statusMsg.textContent = "Webcam active. Reading pink regions...";
                startMatch();
                startProcessingLoop();
                startSpawner();
                startBtn.textContent = "Running Simulation";
                startBtn.style.opacity = 0.5;
            }
        };
    } catch (err) {
        statusMsg.textContent = "Error: " + err.message;
        console.error("Webcam error:", err);
    }
});

// Change camera handle
cameraSelect.addEventListener('change', () => {
    if (webcamActive) {
        // Stop current stream tracks
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        // simulate click to restart with new settings
        webcamActive = false;
        startBtn.textContent = 'Restarting...';
        startBtn.click();
    }
});

cameraSelect.addEventListener('focus', async () => {
    // Attempt to load device list before starting stream if not populated
    if (cameraSelect.options.length <= 1) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            cameraSelect.innerHTML = '';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
        } catch (e) {
            console.error("Could not enumerate devices ahead of time", e);
        }
    }
});

// Try to aggressively get device IDs on load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
            cameraSelect.innerHTML = '';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
        }
    } catch(e) {}
});



let webcamBodies = [];
let goalBodies = [];

const basketConfig = {
    minDetectArea: 500,
    defaultWidth: 220,
    widthClampMin: 140,
    widthClampMax: 320,
    aspectRatio: 0.6, // height = width * aspectRatio
    wallThickness: 28,
    // Minimal smoothing only to reduce jitter without lag.
    posSmoothing: 1.0,
    angleSmoothing: 1.0,
    // Base local X axis is basket base direction (parallel to long side).
    orientationOffsetDeg: 0,
    maxLinearSpeedPxPerSec: 760,
    maxAngularSpeedRadPerSec: 3.2,
    longSideHysteresisRatio: 1.08,
    lostTargetTimeoutMs: 350
};
const DEFAULT_COLLISION_MASK = 0xFFFFFFFF;
const basketControllers = [1, 2].map((playerId) => ({
    playerId,
    body: null,
    pose: { initialized: false, x: 0, y: 0, angle: 0, width: 0, height: 0 },
    target: { hasTarget: false, x: 0, y: 0, angle: 0 },
    lastSeenMs: 0,
    longSideState: { initialized: false, useWidthAxis: true }
}));

function normalizeAngleRad(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function smoothAngle(current, target, alpha) {
    const delta = normalizeAngleRad(target - current);
    return normalizeAngleRad(current + delta * alpha);
}

function pickNearestEquivalentAngle(baseAngle, referenceAngle) {
    const candidates = [baseAngle, baseAngle + Math.PI, baseAngle - Math.PI];
    let best = candidates[0];
    let bestDelta = Math.abs(normalizeAngleRad(candidates[0] - referenceAngle));
    for (let i = 1; i < candidates.length; i++) {
        const delta = Math.abs(normalizeAngleRad(candidates[i] - referenceAngle));
        if (delta < bestDelta) {
            best = candidates[i];
            bestDelta = delta;
        }
    }
    return normalizeAngleRad(best);
}

function moveTowards(current, target, maxDelta) {
    const delta = target - current;
    if (Math.abs(delta) <= maxDelta) return target;
    return current + Math.sign(delta) * maxDelta;
}

function moveTowardsPoint(current, target, maxDelta) {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxDelta || dist === 0) return { x: target.x, y: target.y };
    const scale = maxDelta / dist;
    return { x: current.x + dx * scale, y: current.y + dy * scale };
}

function getBasketTargetAngleRad(rotatedRect, referenceAngle, longSideState) {
    const w = rotatedRect.size.width;
    const h = rotatedRect.size.height;
    const ratio = Math.max(w, h) / Math.max(1e-6, Math.min(w, h));

    // Keep axis choice stable near square-ish detections to avoid 90deg flips.
    if (!longSideState.initialized) {
        longSideState.useWidthAxis = w >= h;
        longSideState.initialized = true;
    } else if (ratio > basketConfig.longSideHysteresisRatio) {
        longSideState.useWidthAxis = w >= h;
    }

    let longSideDeg = rotatedRect.angle;
    if (!longSideState.useWidthAxis) longSideDeg += 90;

    const baseRad = normalizeAngleRad(longSideDeg * (Math.PI / 180));
    const offsetRad = basketConfig.orientationOffsetDeg * (Math.PI / 180);
    const withOffset = normalizeAngleRad(baseRad + offsetRad);
    return pickNearestEquivalentAngle(withOffset, referenceAngle);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createTrackingBasket(innerWidth, innerHeight, alpha, playerId) {
    const t = basketConfig.wallThickness;
    const wallRender = {
        fillStyle: `rgba(255, 255, 255, ${alpha * 0.22})`,
        strokeStyle: `rgba(255, 255, 255, ${alpha})`,
        lineWidth: 3
    };

    const bottom = Bodies.rectangle(0, innerHeight / 2 - t / 2, innerWidth, t, {
        label: `tracking-basket-wall-bottom-p${playerId}`,
        render: wallRender
    });

    const left = Bodies.rectangle(-innerWidth / 2 + t / 2, 0, t, innerHeight, {
        label: `tracking-basket-wall-left-p${playerId}`,
        render: wallRender
    });

    const right = Bodies.rectangle(innerWidth / 2 - t / 2, 0, t, innerHeight, {
        label: `tracking-basket-wall-right-p${playerId}`,
        render: wallRender
    });

    const basket = Matter.Body.create({
        label: `tracking-basket-p${playerId}`,
        isStatic: true,
        friction: 0.05,
        restitution: 0.05,
        parts: [bottom, left, right]
    });

    Composite.add(world, basket);
    return basket;
}

function setBasketActive(controller, active) {
    if (!controller.body) return;
    controller.body.render.visible = active;
    controller.body.parts.slice(1).forEach((part) => {
        part.render.visible = active;
        part.collisionFilter.mask = active ? DEFAULT_COLLISION_MASK : 0;
    });
}

function updateBasketTarget(controller, cx, cy, angle, alpha, nowMs) {
    if (!controller.pose.initialized) {
        controller.pose.x = cx;
        controller.pose.y = cy;
        controller.pose.angle = angle;
        controller.pose.initialized = true;
        controller.target.x = cx;
        controller.target.y = cy;
        controller.target.angle = angle;
        controller.target.hasTarget = true;
    } else {
        controller.target.x += (cx - controller.target.x) * basketConfig.posSmoothing;
        controller.target.y += (cy - controller.target.y) * basketConfig.posSmoothing;
        controller.target.angle = smoothAngle(controller.target.angle, angle, basketConfig.angleSmoothing);
        controller.target.hasTarget = true;
    }

    if (!controller.body) {
        const initialWidth = clamp(basketConfig.defaultWidth, basketConfig.widthClampMin, basketConfig.widthClampMax);
        const initialHeight = initialWidth * basketConfig.aspectRatio;
        controller.pose.width = initialWidth;
        controller.pose.height = initialHeight;
        controller.body = createTrackingBasket(initialWidth, initialHeight, alpha, controller.playerId);
    }

    const fillStyle = `rgba(255, 255, 255, ${alpha * 0.22})`;
    const strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    controller.body.parts.slice(1).forEach((part) => {
        part.render.fillStyle = fillStyle;
        part.render.strokeStyle = strokeStyle;
    });
    controller.lastSeenMs = nowMs;
    setBasketActive(controller, true);
}

function driveBasketPhysics(controller, dtMs, nowMs) {
    if (!controller.body) return;
    if (controller.target.hasTarget && (nowMs - controller.lastSeenMs) > basketConfig.lostTargetTimeoutMs) {
        controller.target.hasTarget = false;
        setBasketActive(controller, false);
    }
    if (!controller.target.hasTarget) return;

    const dtSec = Math.max(0.001, dtMs / 1000);
    const maxPosStep = basketConfig.maxLinearSpeedPxPerSec * dtSec;
    let nextPos = moveTowardsPoint(controller.body.position, controller.target, maxPosStep);

    // Keep exactly one basket per side and never allow crossing mid divider.
    const basketHalfWidth = (controller.pose.width || basketConfig.defaultWidth) / 2;
    const dividerHalfWidth = 10; // createMidDivider uses width 20
    const sidePadding = basketConfig.wallThickness * 0.5 + 4;
    const leftMaxX = window.innerWidth / 2 - dividerHalfWidth - basketHalfWidth - sidePadding;
    const rightMinX = window.innerWidth / 2 + dividerHalfWidth + basketHalfWidth + sidePadding;
    if (controller.playerId === 1) {
        nextPos.x = clamp(nextPos.x, basketHalfWidth + sidePadding, leftMaxX);
    } else {
        nextPos.x = clamp(nextPos.x, rightMinX, window.innerWidth - basketHalfWidth - sidePadding);
    }

    const angleDelta = normalizeAngleRad(controller.target.angle - controller.body.angle);
    const maxAngleStep = basketConfig.maxAngularSpeedRadPerSec * dtSec;
    const nextAngleDelta = moveTowards(0, angleDelta, maxAngleStep);
    const nextAngle = normalizeAngleRad(controller.body.angle + nextAngleDelta);

    // updateVelocity=true avoids "teleport-like" updates and helps collision response
    Matter.Body.setPosition(controller.body, nextPos, true);
    Matter.Body.setAngle(controller.body, nextAngle, true);
}

function assignDetectionsToControllers(detections) {
    const assignments = new Array(basketControllers.length).fill(null);
    if (detections.length === 0) return assignments;

    // Player 1 controls only left side, Player 2 controls only right side.
    const dividerX = window.innerWidth / 2;
    const leftDetections = detections.filter((d) => d.cx < dividerX);
    const rightDetections = detections.filter((d) => d.cx >= dividerX);

    if (leftDetections.length > 0) {
        leftDetections.sort((a, b) => b.area - a.area);
        assignments[0] = leftDetections[0];
    }
    if (rightDetections.length > 0) {
        rightDetections.sort((a, b) => b.area - a.area);
        assignments[1] = rightDetections[0];
    }

    return assignments;
}

function hexToOpencvHsv(hex) {
    let r = parseInt(hex.substring(1,3), 16) / 255;
    let g = parseInt(hex.substring(3,5), 16) / 255;
    let b = parseInt(hex.substring(5,7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
        h = 0;
    } else {
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return {
        h: Math.round(h * 180),
        s: Math.round(s * 255),
        v: Math.round(v * 255)
    };
}

function createMaskFromColor(hsv, colorHex, tolerance, sMin, vMin) {
    const colorHsv = hexToOpencvHsv(colorHex);
    let hMin = (colorHsv.h - tolerance) % 180;
    if (hMin < 0) hMin += 180;
    let hMax = (colorHsv.h + tolerance) % 180;
    if (hMax < 0) hMax += 180;
    let resultMask = new cv.Mat();

    if (hMin <= hMax) {
        let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [hMin, sMin, vMin, 0]);
        let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [hMax, 255, 255, 0]);
        cv.inRange(hsv, low, high, resultMask);
        low.delete();
        high.delete();
    } else {
        let mask1 = new cv.Mat();
        let mask2 = new cv.Mat();
        let low1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [hMin, sMin, vMin, 0]);
        let high1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [179, 255, 255, 0]);
        cv.inRange(hsv, low1, high1, mask1);

        let low2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, sMin, vMin, 0]);
        let high2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [hMax, 255, 255, 0]);
        cv.inRange(hsv, low2, high2, mask2);

        cv.bitwise_or(mask1, mask2, resultMask);
        mask1.delete();
        mask2.delete();
        low1.delete();
        high1.delete();
        low2.delete();
        high2.delete();
    }

    return resultMask;
}

function startProcessingLoop() {
    // OpenCV Mats
    let src = new cv.Mat(procRows, procCols, cv.CV_8UC4);
    let hsv = new cv.Mat();
    let mask = new cv.Mat();
    let goalMask = new cv.Mat();
    let hierarchy = new cv.Mat();

    function processFrame() {
        if (!webcamActive) return;

        let destW = window.innerWidth;
        let destH = window.innerHeight;
        let destAsp = destW / destH;

        if (destAsp > 1) {
            procCols = 400;
            procRows = Math.floor(400 / destAsp);
        } else {
            procRows = 400;
            procCols = Math.floor(400 * destAsp);
        }

        if (hiddenCanvas.width !== procCols) hiddenCanvas.width = procCols;
        if (hiddenCanvas.height !== procRows) hiddenCanvas.height = procRows;

        if (src.cols !== procCols || src.rows !== procRows) {
            src.delete();
            src = new cv.Mat(procRows, procCols, cv.CV_8UC4);
        }

        let vW = video.videoWidth;
        let vH = video.videoHeight;
        
        function drawVideoCover(targetCtx, tW, tH) {
            targetCtx.save();
            targetCtx.translate(tW / 2, tH / 2);
            
            let flipNode = document.getElementById('cam-flip');
            let isFlipped = flipNode ? flipNode.checked : true;
            if (isFlipped) {
                targetCtx.scale(-1, 1); // Mirror
            }
            
            let drawW = tW; 
            let drawH = tH;
            let targetAsp = tW / tH;
            let srcAsp = vW / vH;
            let sWidth = vW;
            let sHeight = vH;
            
            if (vH > 0 && vW > 0) {
                if (srcAsp > targetAsp) {
                    sWidth = vH * targetAsp;
                } else {
                    sHeight = vW / targetAsp;
                }
            }
            
            let sX = (vW - sWidth) / 2;
            let sY = (vH - sHeight) / 2;

            targetCtx.drawImage(video, sX, sY, sWidth, sHeight, -drawW / 2, -drawH / 2, drawW, drawH);
            targetCtx.restore();
        }

        // Draw background natively
        videoBgCanvas.width = destW;
        videoBgCanvas.height = destH;
        drawVideoCover(bgCtx, destW, destH);

        // Draw to hidden canvas for OpenCV
        drawVideoCover(ctx, procCols, procRows);

        let imageData = ctx.getImageData(0, 0, procCols, procRows);
        src.data.set(imageData.data);

        // Convert to HSV
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

        // Get threshold values
        let targetHex = targetColorPicker ? targetColorPicker.value : "#ff1493";
        let goalHex = goalColorPicker ? goalColorPicker.value : "#ff0000";
        let tolerance = parseInt(sliders.colorTolerance.value);
        let goalTolerance = parseInt(sliders.goalTolerance.value);

        let sMin = parseInt(sliders.sMin.value);
        let vMin = parseInt(sliders.vMin.value);
        // Goal detection is more permissive to survive real-world shadows/reflections.
        let goalSMin = Math.max(20, sMin - 50);
        let goalVMin = Math.max(20, vMin - 50);

        let targetMask = createMaskFromColor(hsv, targetHex, tolerance, sMin, vMin);
        let newGoalMask = createMaskFromColor(hsv, goalHex, goalTolerance, goalSMin, goalVMin);
        mask.delete();
        goalMask.delete();
        mask = targetMask;
        goalMask = newGoalMask;

        // Clean up noise
        let M = cv.Mat.ones(5, 5, cv.CV_8U);
        cv.erode(mask, mask, M, new cv.Point(-1, -1), 1);
        cv.dilate(mask, mask, M, new cv.Point(-1, -1), 1);
        cv.erode(goalMask, goalMask, M, new cv.Point(-1, -1), 1);
        cv.dilate(goalMask, goalMask, M, new cv.Point(-1, -1), 1);
        M.delete();

        // Find collision contours
        let contours = new cv.MatVector();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        let goalContours = new cv.MatVector();
        cv.findContours(goalMask, goalContours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let scaleX = window.innerWidth / procCols;
        let scaleY = window.innerHeight / procRows;

        let alpha = parseInt(sliders.boxOpacity.value) / 100;
        
        let newGoalBodies = [];

        const candidates = [];
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            if (area > basketConfig.minDetectArea) {
                const rotatedRect = cv.minAreaRect(cnt);
                candidates.push({
                    area,
                    cx: rotatedRect.center.x * scaleX,
                    cy: rotatedRect.center.y * scaleY,
                    rotatedRect
                });
            }
            cnt.delete();
        }

        const detections = candidates
            .sort((a, b) => b.area - a.area)
            .slice(0, 2);

        const assignments = assignDetectionsToControllers(detections);
        const nowMs = Date.now();
        basketControllers.forEach((controller, idx) => {
            const det = assignments[idx];
            if (!det) return;
            const referenceAngle = controller.target.hasTarget
                ? controller.target.angle
                : (controller.body ? controller.body.angle : 0);
            const angle = getBasketTargetAngleRad(det.rotatedRect, referenceAngle, controller.longSideState);
            updateBasketTarget(controller, det.cx, det.cy, angle, alpha, nowMs);
        });

        webcamBodies = basketControllers
            .filter((controller) => controller.body && controller.body.render.visible)
            .map((controller) => controller.body);
        
        // Process goal contours and keep only two zones (left = zone 1, right = zone 2)
        let goalCandidates = [];
        for (let i = 0; i < goalContours.size(); ++i) {
            let cnt = goalContours.get(i);
            let area = cv.contourArea(cnt);
            if (area > 150) {
                let rotatedRect = cv.minAreaRect(cnt);
                goalCandidates.push({
                    area,
                    width: rotatedRect.size.width * scaleX,
                    height: rotatedRect.size.height * scaleY,
                    cx: rotatedRect.center.x * scaleX,
                    cy: rotatedRect.center.y * scaleY,
                    angle: rotatedRect.angle * (Math.PI / 180)
                });
            }
            cnt.delete();
        }

        const dividerX = window.innerWidth / 2;
        const leftGoal = goalCandidates
            .filter(goal => goal.cx < dividerX)
            .sort((a, b) => b.area - a.area)[0];
        const rightGoal = goalCandidates
            .filter(goal => goal.cx >= dividerX)
            .sort((a, b) => b.area - a.area)[0];

        const selectedGoals = [
            { goal: leftGoal, zoneNumber: 1 },  // left side
            { goal: rightGoal, zoneNumber: 2 }  // right side
        ];

        selectedGoals.forEach(({ goal, zoneNumber }) => {
            if (!goal) return;
            let goalBody = Bodies.rectangle(goal.cx, goal.cy, goal.width, goal.height, {
                isStatic: true,
                isSensor: true,
                angle: goal.angle,
                label: `goal-zone-${zoneNumber}`,
                render: {
                    fillStyle: zoneNumber === 1 ? 'rgba(255, 0, 0, 0.25)' : 'rgba(0, 128, 255, 0.25)',
                    strokeStyle: zoneNumber === 1 ? 'rgba(255, 0, 0, 0.85)' : 'rgba(0, 128, 255, 0.85)',
                    lineWidth: 3
                }
            });
            newGoalBodies.push(goalBody);
            Composite.add(world, goalBody);
        });

        // Goal zones are rebuilt frame-by-frame (keeps existing behavior).
        if (goalBodies.length > 0) {
            Composite.remove(world, goalBodies);
        }
        
        goalBodies = newGoalBodies;
        statusMsg.textContent = `Webcam active. Canastas: ${webcamBodies.length}/2 | Goal zones: ${goalBodies.length}`;

        contours.delete();
        goalContours.delete();

        // Delay next frame slightly to save CPU
        setTimeout(() => { requestAnimationFrame(processFrame); }, 1000 / 30);
    }

    // Start loop
    processFrame();
}

// 5. Ball Spawner
let balls = [];
let lastSpawnTime = 0;
let rainClouds = [];
let nextCloudSpawnIndex = 0;
const rainConfig = {
    cloudY: 130
};
const ballPhysicsConfig = {
    maxLinearSpeed: 620,
    maxAngularSpeed: 14
};

function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

function createCloudState(initialX, sideLabel) {
    const cloudWidth = 220;
    const cloudHeight = 70;
    const body = Bodies.rectangle(initialX, rainConfig.cloudY, cloudWidth, cloudHeight, {
    isStatic: true,
    isSensor: true,
    label: `rain-cloud-${sideLabel}`,
    render: {
        visible: false
    }
});

    const now = Date.now();
    return {
        body,
        phase: 'pause',
        phaseEndsAt: now + randomRange(300, 900),
        lastUpdateMs: now,
        direction: 1,
        speedPxPerSec: 0
    };
}

function pickNextRainCloudPhase(cloud, now) {
    const hardMode = gameState.phase2Active;
    if (cloud.phase === 'pause') {
        cloud.phase = 'move';
        cloud.direction = Math.random() < 0.5 ? -1 : 1;
        cloud.speedPxPerSec = hardMode ? randomRange(320, 560) : randomRange(180, 300);
        cloud.phaseEndsAt = now + (hardMode ? randomRange(1800, 3600) : randomRange(700, 1400));
    } else {
        if (hardMode) {
            // In phase 2 keep clouds moving almost continuously.
            cloud.phase = 'move';
            cloud.direction *= -1;
            cloud.speedPxPerSec = randomRange(500, 700);
            cloud.phaseEndsAt = now + randomRange(1500, 3200);
        } else {
            cloud.phase = 'pause';
            cloud.speedPxPerSec = 0;
            cloud.phaseEndsAt = now + randomRange(220, 560);
        }
    }
}

function createRainClouds() {
    if (rainClouds.length > 0) {
        Composite.remove(world, rainClouds.map(cloud => cloud.body));
    }

    const leftCloud = createCloudState(window.innerWidth * 0.28, 'left');
    const rightCloud = createCloudState(window.innerWidth * 0.72, 'right');
    rainClouds = [leftCloud, rightCloud];
    nextCloudSpawnIndex = 0;
    Composite.add(world, rainClouds.map(cloud => cloud.body));
}

function updateRainCloudMotion() {
    if (rainClouds.length === 0 || gameState.matchEnded) return;
    const hardMode = gameState.phase2Active;

    rainClouds.forEach((cloud, index) => {
        const now = Date.now();
        while (now >= cloud.phaseEndsAt) {
            pickNextRainCloudPhase(cloud, cloud.phaseEndsAt);
        }

        const dtSec = Math.max(0, (now - cloud.lastUpdateMs) / 1000);
        cloud.lastUpdateMs = now;

        if (cloud.phase !== 'move') return;

        const cloudHalfWidth = (cloud.body.bounds.max.x - cloud.body.bounds.min.x) / 2;
        const sidePadding = 20;
        const center = window.innerWidth * (index === 0 ? 0.25 : 0.75);
        const sideHalfRange = hardMode
            ? Math.max(140, window.innerWidth * 0.28)
            : Math.max(80, window.innerWidth * 0.18);
        const minX = Math.max(cloudHalfWidth + sidePadding, center - sideHalfRange);
        const maxX = Math.min(window.innerWidth - cloudHalfWidth - sidePadding, center + sideHalfRange);
        const travel = cloud.direction * cloud.speedPxPerSec * dtSec;
        const nextX = Math.max(minX, Math.min(maxX, cloud.body.position.x + travel));

        if ((nextX <= minX && cloud.direction < 0) || (nextX >= maxX && cloud.direction > 0)) {
            cloud.direction *= -1;
        }

        Matter.Body.setPosition(cloud.body, { x: nextX, y: cloud.body.position.y });
    });
}

createRainClouds();

function startSpawner() {
    Events.on(engine, 'beforeUpdate', () => {
        const dtMs = engine.timing.lastDelta || 16.6667;
        const nowMs = Date.now();
        updateMatchClock(nowMs);
        basketControllers.forEach((controller) => driveBasketPhysics(controller, dtMs, nowMs));
        updateRainCloudMotion();
        const now = nowMs;
        const interval = parseInt(sliders.spawnInterval.value);

        if (gameState.matchRunning && !gameState.matchEnded && (now - lastSpawnTime > interval)) {
            spawnBall();
            lastSpawnTime = now;
        }

        // Cleanup fallen balls
        balls = balls.filter(ball => {
            if (ball.position.y > window.innerHeight + 20) {
                Composite.remove(world, ball);
                return false;
            }
            return true;
        });

        // Hard safety clamp only for rare explosive speeds.
        balls.forEach((ball) => {
            const vx = ball.velocity.x;
            const vy = ball.velocity.y;
            const speed = Math.hypot(vx, vy);
            if (speed > ballPhysicsConfig.maxLinearSpeed && speed > 0) {
                const scale = ballPhysicsConfig.maxLinearSpeed / speed;
                Matter.Body.setVelocity(ball, { x: vx * scale, y: vy * scale });
            }

            const av = ball.angularVelocity;
            if (Math.abs(av) > ballPhysicsConfig.maxAngularSpeed) {
                Matter.Body.setAngularVelocity(ball, Math.sign(av) * ballPhysicsConfig.maxAngularSpeed);
            }
        });
    });
}

function spawnBall() {
    const xPct = parseInt(sliders.spawnX.value) / 100;
    const defaultXPos = window.innerWidth * xPct;
    const activeCloud = rainClouds.length > 0 ? rainClouds[nextCloudSpawnIndex % rainClouds.length] : null;
    if (rainClouds.length > 0) {
        nextCloudSpawnIndex += 1;
    }
    const cloudX = activeCloud ? activeCloud.body.position.x : defaultXPos;
    const rest = parseFloat(sliders.restitution.value);

    const radius = 15; // Constant radius
    const jitter = (Math.random() - 0.5) * 50;
    const spawnY = activeCloud ? activeCloud.body.position.y + 35 : -30;
    const isNegativeBall = gameState.phase2Active && Math.random() < gameConfig.negativeBallProbability;
    const hue = isNegativeBall
        ? (2 + Math.floor(Math.random() * 10))
        : (194 + Math.floor(Math.random() * 30));
    const lightness = isNegativeBall
        ? (50 + Math.floor(Math.random() * 12))
        : (50 + Math.floor(Math.random() * 14));

    const ball = Bodies.circle(cloudX + jitter, spawnY, radius, {
        restitution: Math.min(rest, 0.06),
        friction: 0.16,
        frictionStatic: 0.28,
        frictionAir: 0.02,
        frictionAngular: 0.03,
        density: 0.0028,
        slop: 0.002,
        label: 'ball',
        render: {
            fillStyle: `hsla(${hue}, 90%, ${lightness}%, 0.9)`,
            strokeStyle: `hsla(${hue}, 95%, 82%, 0.85)`,
            lineWidth: 1.5
        },
        plugin: {
            hue,
            kind: isNegativeBall ? 'negative' : 'positive'
        }
    });

    balls.push(ball);
    Composite.add(world, ball);
}

clearBtn.addEventListener('click', () => {
    balls.forEach(b => Composite.remove(world, b));
    balls = [];
    ballTrailMap.clear();
    fxState.particles = [];
    fxState.flashes = [];
    fxState.floatTexts = [];
    score1 = 0;
    score2 = 0;
    gameState.matchRunning = false;
    gameState.matchEnded = false;
    gameState.phase2Active = false;
    gameState.remainingSec = gameConfig.matchDurationSec;
    hideResultOverlay();
    if (phaseMsg) {
        phaseMsg.textContent = '';
        phaseMsg.classList.remove('active');
    }
    updateTimerDisplay();
    rainClouds.forEach((cloud) => {
        cloud.body.render.fillStyle = 'rgba(225, 230, 245, 0.85)';
        cloud.body.render.strokeStyle = 'rgba(200, 210, 230, 0.95)';
    });
    updateScoreDisplay();
});

Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        const isGoalZoneA = bodyA.label === 'goal-zone-1' || bodyA.label === 'goal-zone-2';
        const isGoalZoneB = bodyB.label === 'goal-zone-1' || bodyB.label === 'goal-zone-2';
        const isGoalHit = (isGoalZoneA && bodyB.label === 'ball') || (isGoalZoneB && bodyA.label === 'ball');

        if (!isGoalHit) return;

        const goalZone = isGoalZoneA ? bodyA : bodyB;
        const ball = bodyA.label === 'ball' ? bodyA : bodyB;
        const isNegativeBall = ball.plugin && ball.plugin.kind === 'negative';
        const scoreDelta = isNegativeBall ? -1 : 1;
        const scoreColor = isNegativeBall
            ? 'rgba(255, 76, 76, 1)'
            : (goalZone.label === 'goal-zone-1' ? 'rgba(255, 100, 100, 1)' : 'rgba(120, 205, 255, 1)');
        addFlash(ball.position.x, ball.position.y, scoreColor, 36, 220);
        addParticles(ball.position.x, ball.position.y, {
            count: isNegativeBall ? 28 : 24,
            color: scoreColor,
            speedMin: 60,
            speedMax: 300,
            lifeMin: 240,
            lifeMax: 620,
            sizeMin: 2.5,
            sizeMax: 5.2
        });
        Composite.remove(world, ball);
        ballTrailMap.delete(ball.id);
        balls = balls.filter((b) => b.id !== ball.id);

        if (goalZone.label === 'goal-zone-1') {
            score1 += scoreDelta;
        } else if (goalZone.label === 'goal-zone-2') {
            score2 += scoreDelta;
        }

        updateScoreDisplay();
    });
});


