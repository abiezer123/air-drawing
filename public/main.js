const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let lines = [];       // array of separate lines
let currentLine = []; // current line being drawn
let isDrawing = false;

// Gesture detection
function getGesture(landmarks) {
    if (!landmarks) return 'none';

    const tipIndexes = [8, 12, 16, 20]; // index, middle, ring, pinky
    let foldedFingers = 0;
    for (let i = 0; i < tipIndexes.length; i++) {
        if (landmarks[tipIndexes[i]].y > landmarks[tipIndexes[i] - 2].y) foldedFingers++;
    }

    // Two fingers (index + middle) up
    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;

    if (foldedFingers === 4) return 'fist';        // all fingers folded
    if (indexUp && middleUp) return 'erase';       // index + middle → erase
    if (indexUp) return 'draw';                    // index → draw
    return 'none';                                 // nothing
}

// Distance helper
function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// Callback when hands are detected
function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const gesture = getGesture(landmarks);

        if (gesture === 'fist') {
            isDrawing = false;
            if (currentLine.length > 0) {
                lines.push(currentLine); // save current line
                currentLine = [];        // start fresh next time
            }
        } else if (gesture === 'erase') {
            // Erase points near index finger
            const tip = landmarks[8];
            const eraseX = tip.x * canvas.width;
            const eraseY = tip.y * canvas.height;
            lines = lines.map(line => line.filter(p => distance(p, { x: eraseX, y: eraseY }) > 30));
            currentLine = currentLine.filter(p => distance(p, { x: eraseX, y: eraseY }) > 30);
        } else if (gesture === 'draw') {
            isDrawing = true;
            const tip = landmarks[8]; // index finger tip
            currentLine.push({ x: tip.x * canvas.width, y: tip.y * canvas.height });
        } else {
            isDrawing = false;
            if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
            }
        }
    }

    // Draw all saved lines
    for (let line of lines) {
        if (line.length > 1) {
            ctx.beginPath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#FF0000';
            ctx.lineJoin = 'round';
            ctx.moveTo(line[0].x, line[0].y);
            for (let i = 1; i < line.length; i++) {
                ctx.lineTo(line[i].x, line[i].y);
            }
            ctx.stroke();
        }
    }

    // Draw current line
    if (currentLine.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FF0000';
        ctx.lineJoin = 'round';
        ctx.moveTo(currentLine[0].x, currentLine[0].y);
        for (let i = 1; i < currentLine.length; i++) {
            ctx.lineTo(currentLine[i].x, currentLine[i].y);
        }
        ctx.stroke();
    }

    ctx.restore();
}

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

// Start camera
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 640,
    height: 480
});
camera.start();
