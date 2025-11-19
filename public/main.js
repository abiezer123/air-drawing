// ELEMENTS
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// DRAWING VARIABLES
let lines = [];
let currentLines = [[], []]; // [leftHandLine, rightHandLine]
let isDrawing = false;

// PARTICLES (MAGIC EFFECT)
let particles = [];

// -------------------------------------------
// DISTANCE HELPER
// -------------------------------------------
function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// -------------------------------------------
// MAGIC BURST EFFECT
// -------------------------------------------
function spawnBurst(x, y) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 5 + Math.random() * 5,
            alpha: 1,
            decay: 0.02 + Math.random() * 0.03
        });
    }
}

// -------------------------------------------
// MAGIC PARTICLE RENDER
// -------------------------------------------
function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        ctx.fillStyle = `rgba(0, 200, 255, ${p.alpha})`;
        ctx.shadowColor = "rgba(0, 200, 255, 1)";
        ctx.shadowBlur = 25;
        ctx.fill();

        // Update physics
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.radius *= 0.97;

        if (p.alpha <= 0) particles.splice(i, 1);
    }

    ctx.shadowBlur = 0;
}

// -------------------------------------------
// GESTURE DETECTION
// -------------------------------------------
function getGesture(landmarks) {
    if (!landmarks) return "none";

    const tipIndexes = [8, 12, 16, 20];
    let folded = 0;

    for (let t of tipIndexes) {
        if (landmarks[t].y > landmarks[t - 2].y) folded++;
    }

    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;

    if (folded === 4) return "fist";
    if (indexUp && middleUp) return "erase";
    if (indexUp) return "draw";

    return "none";
}

// -------------------------------------------
// MOUSE DELETE LOGIC
// -------------------------------------------
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    lines = lines.map(line =>
        line.filter(p => distance(p, { x: mx, y: my }) > 20)
    );
});

// -------------------------------------------
// MAIN MEDIAPIPE RESULT LOOP
// -------------------------------------------
function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const handsLandmarks = results.multiHandLandmarks || [];
    const handsLabel = results.multiHandedness || []; // "Left" or "Right"

    handsLandmarks.forEach((lm, idx) => {
        const label = handsLabel[idx].label; // "Left" or "Right"
        const lineIndex = label === "Left" ? 0 : 1;
        const gesture = getGesture(lm);

        if (gesture === "draw") {
            const tip = lm[8];
            spawnBurst(tip.x * canvas.width, tip.y * canvas.height);
            currentLines[lineIndex].push({
                x: tip.x * canvas.width,
                y: tip.y * canvas.height
            });
        } else if (gesture === "erase") {
            const tip = lm[8];
            const ex = tip.x * canvas.width;
            const ey = tip.y * canvas.height;
            lines = lines.map(line => line.filter(p => distance(p, { x: ex, y: ey }) > 25));
            currentLines[lineIndex] = currentLines[lineIndex].filter(p => distance(p, { x: ex, y: ey }) > 25);
        } else if (gesture === "fist") {
            if (currentLines[lineIndex].length > 0) {
                lines.push(currentLines[lineIndex]);
                currentLines[lineIndex] = [];
            }
        }
    });

    // Save current lines to persistent lines
    currentLines.forEach(line => {
        if (line.length > 0) lines.push(line);
    });

    // Draw all lines
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#00f0ff";
    for (let line of lines) {
        if (line.length > 1) {
            ctx.beginPath();
            ctx.moveTo(line[0].x, line[0].y);
            for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
            ctx.stroke();
        }
    }

    // Draw magic particles
    drawParticles();
    ctx.restore();
}


// -------------------------------------------
// START MEDIAPIPE HAND TRACKING
// -------------------------------------------
const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,  // <-- now detects 2 hands
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 640,
    height: 480
});

camera.start();
