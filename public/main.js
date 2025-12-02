// -------------------- ELEMENTS --------------------
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// -------------------- DRAWING VARIABLES --------------------
let lines = [];                  // persistent lines
let currentLines = [[], []];     // current drawing per hand
let brushColor = "#00f0ff";
let brushSize = 5;

// -------------------- PARTICLES --------------------
let particles = [];
let particleShape = "circle"; // default

document.getElementById("particleShape").addEventListener("change", (e) => {
    particleShape = e.target.value;
});



// -------------------- COLOR & SIZE --------------------
document.querySelectorAll(".color").forEach(c => {
    c.addEventListener("click", () => brushColor = c.dataset.color);
});
document.getElementById("brushSize").addEventListener("input", (e) => {
    brushSize = parseInt(e.target.value);
});

// -------------------- DISTANCE HELPER --------------------
function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// -------------------- PARTICLE FUNCTIONS --------------------
function spawnParticles(x, y, color, shape = particleShape) {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const speed = 1 + Math.random() * 2;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 10,
            color,
            shape // use selected shape
        });
    }
}


function updateParticles() {
    for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
    }
    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 30);
        ctx.fillStyle = p.color;

        switch (p.shape) {
            case "circle":
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case "square":
                ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
                break;

            case "diamond":
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - 4);
                ctx.lineTo(p.x + 4, p.y);
                ctx.lineTo(p.x, p.y + 4);
                ctx.lineTo(p.x - 4, p.y);
                ctx.closePath();
                ctx.fill();
                break;

            case "heart":
                ctx.beginPath();
                const s = 3;
                ctx.moveTo(p.x, p.y);
                ctx.bezierCurveTo(p.x, p.y - s, p.x - s, p.y - s, p.x - s, p.y);
                ctx.bezierCurveTo(p.x - s, p.y + s, p.x, p.y + s * 1.5, p.x, p.y + s * 2);
                ctx.bezierCurveTo(p.x, p.y + s * 1.5, p.x + s, p.y + s, p.x + s, p.y);
                ctx.bezierCurveTo(p.x + s, p.y - s, p.x, p.y - s, p.x, p.y);
                ctx.fill();
                break;
        }
    });
    ctx.globalAlpha = 1;
}


// -------------------- GESTURE DETECTION --------------------
function getGesture(landmarks) {
    if (!landmarks) return "none";
    const tipIndexes = [8, 12, 16, 20];
    let folded = 0;
    for (let t of tipIndexes) if (landmarks[t].y > landmarks[t - 2].y) folded++;
    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;
    if (folded === 4) return "fist";
    if (indexUp && middleUp) return "erase";
    if (indexUp) return "draw";
    return "none";
}
// -------------------- MOUSE ERASE LOGIC --------------------
// -------------------- MOUSE ERASE LOGIC --------------------
function mouseErase(mouseX, mouseY) {
    const eraseRadius = 40;

    // 1. Compute mirrored visual position
    const visualX = canvas.width - mouseX;

    // 2. Draw circle *where the user sees it*
    ctx.strokeStyle = "rgba(255, 0, 0, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(visualX, mouseY, eraseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. ERASE in the same visual location  
    // Convert circle back to real coordinate space
    const eraseCenterX = mouseX; // <-- real erase location

    lines = lines.map(line => ({
        ...line,
        points: line.points.filter(p => distance(p, { x: eraseCenterX, y: mouseY }) > eraseRadius)
    }));
}

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    mouseErase(mouseX, mouseY);
});


// -------------------- MAIN MEDIAPIPE LOOP --------------------
function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const handsLandmarks = results.multiHandLandmarks || [];
    const handsLabel = results.multiHandedness || [];

    handsLandmarks.forEach((lm, idx) => {
        const label = handsLabel[idx].label;
        const lineIndex = label === "Left" ? 0 : 1;
        const gesture = getGesture(lm);
        const tip = lm[8];
        const x = tip.x * canvas.width;
        const y = tip.y * canvas.height;

        if (gesture === "draw") {
            currentLines[lineIndex].push({ x, y });
            spawnParticles(x, y, brushColor);
        } else if (gesture === "erase") {
            lines = lines.map(line => ({
                ...line,
                points: line.points.filter(p => distance(p, { x, y }) > 25)
            }));
            currentLines[lineIndex] = currentLines[lineIndex].filter(p => distance(p, { x, y }) > 25);
        } else if (gesture === "fist") {
            if (currentLines[lineIndex].length > 0) {
                lines.push({
                    points: currentLines[lineIndex],
                    color: brushColor,
                    size: brushSize
                });
                currentLines[lineIndex] = [];
            }
        }
    });

    // Draw all lines (persistent + current)
    [...lines, ...currentLines.filter(l => l.length > 0).map(l => ({ points: l, color: brushColor, size: brushSize }))].forEach(line => {
        if (line.points.length < 2) return;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.size;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(line.points[0].x, line.points[0].y);
        for (let i = 1; i < line.points.length; i++) ctx.lineTo(line.points[i].x, line.points[i].y);
        ctx.stroke();
    });

    updateParticles();
    drawParticles();
}

// -------------------- START MEDIAPIPE HAND TRACKING --------------------
const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
hands.onResults(onResults);

const camera = new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 640,
    height: 480
});
camera.start();

// Resize canvas to match video
video.addEventListener("loadedmetadata", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
});

function clearAll() {
    lines = [];
    currentLines = [[], []];
    particles = [];
    ctx.clearRect(0.0, canvas.width.canvas.height);
}

document.getElementById("clearBtn").addEventListener("click", clearAll);