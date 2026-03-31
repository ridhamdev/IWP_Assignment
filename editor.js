let canvas = document.querySelector('.main-canvas');
let ctx = canvas.getContext('2d');
let overlayContainer = document.querySelector('.overlay-container');

let isDrawing = false;
let currentTool = 'brush';
let startX = 0, startY = 0;
let snapshot = null;

// User preferences
const globals = {
    stroke: '#ffffff',
    fill: '#7b2cbf',
    lineWidth: 5,
    eraserWidth: 20
};

// --- History State & Undo/Redo ---
let undoStack = [];
let redoStack = [];

function saveState() {
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > 30) undoStack.shift(); // Keep last 30 states
    redoStack = []; // Clear redo when a new action occurs
}

function undo() {
    if (undoStack.length > 1) { // Must have at least initial state + 1
        const currentState = undoStack.pop();
        redoStack.push(currentState);

        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = undoStack[undoStack.length - 1]; // Load previous
    }
}

function redo() {
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        undoStack.push(nextState);

        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = nextState;
    }
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

// --- Initialization & Loading ---
window.onload = () => {
    // Fill canvas background white initially
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const template = localStorage.getItem('aura_template');
    const resumeId = localStorage.getItem('aura_resume_id');
    const activeUserStr = localStorage.getItem('aura_active_user');

    if (!activeUserStr) {
        window.location.href = 'index.html';
        return; // Prevents loading if not logged in
    }

    const activeUser = JSON.parse(activeUserStr);

    if (resumeId) {
        // Load from history
        const historyKey = `aura_history_${activeUser.email}`;
        const history = JSON.parse(localStorage.getItem(historyKey)) || [];
        const item = history.find(i => i.id === resumeId);

        if (item) {
            document.getElementById('documentName').value = item.name || 'Untitled Canvas';
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                saveState();
            };
            img.src = item.imageData;
        } else {
            saveState();
        }
    } else if (template && template !== 'blank') {
        // Load Template Background
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            saveState();
        };
        // Mock mapping for templates with direct image backgrounds
        const urls = {
            'birthday': 'https://images.unsplash.com/photo-1530103862676-de8892b12fa4?w=800&q=80',
            'festival': 'https://images.unsplash.com/photo-1542385151-efd9000785a0?w=800&q=80',
            'cyberpunk': 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&q=80',
            'abstract': 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80'
        };
        if (urls[template]) {
            img.src = urls[template];
        } else {
            saveState();
        }
    } else {
        saveState();
    }
};

// --- Event Listeners ---
document.querySelectorAll('.btn-icon[data-tool]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-icon').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.getAttribute('data-tool');

        // Reset shape dropdown if another tool is clicked
        const shapeSelect = document.getElementById('shapeSelect');
        if (shapeSelect) shapeSelect.value = "";
    });
});

document.getElementById('shapeSelect')?.addEventListener('change', (e) => {
    document.querySelectorAll('.btn-icon').forEach(b => b.classList.remove('active'));
    currentTool = e.target.value;
    e.target.classList.add('active'); // optionally style it
});

document.getElementById('strokeColor').addEventListener('input', (e) => globals.stroke = e.target.value);
document.getElementById('fillColor').addEventListener('input', (e) => globals.fill = e.target.value);
document.getElementById('lineWidth').addEventListener('input', (e) => globals.lineWidth = e.target.value);
document.getElementById('eraserWidth')?.addEventListener('input', (e) => globals.eraserWidth = e.target.value);

// Canvas Mouse Events
const workspace = document.getElementById('workspace');

workspace.addEventListener('mousedown', (e) => {
    const wrapper = e.target.closest('.canvas-wrapper');
    if (wrapper) {
        canvas = wrapper.querySelector('.main-canvas');
        ctx = canvas.getContext('2d');
        overlayContainer = wrapper.querySelector('.overlay-container');
        
        if (e.target.classList.contains('main-canvas')) {
            startDraw(e);
        }
    }
});

workspace.addEventListener('mousemove', (e) => {
    if (isDrawing) drawing(e);
});

workspace.addEventListener('mouseup', (e) => {
    if (isDrawing) endDraw(e);
});

workspace.addEventListener('mouseout', (e) => {
    if (isDrawing && e.target.classList.contains('main-canvas')) endDraw(e);
});

function addPage() {
    const container = document.getElementById('pagesContainer');
    const newWrapper = document.createElement('div');
    newWrapper.className = 'canvas-wrapper';
    newWrapper.style = "width: 800px; height: 600px; position: relative; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.5);";
    newWrapper.innerHTML = `
        <canvas class="main-canvas" width="800" height="600" style="position: absolute; top:0; left:0; z-index: 1;"></canvas>
        <canvas class="temp-canvas" width="800" height="600" style="position: absolute; top:0; left:0; z-index: 2; pointer-events: none;"></canvas>
        <div class="overlay-container" style="position: absolute; top:0; left:0; width: 100%; height: 100%; z-index: 5; pointer-events: none;"></div>
    `;
    
    // Fill white
    const newCanvas = newWrapper.querySelector('.main-canvas');
    const newCtx = newCanvas.getContext('2d');
    newCtx.fillStyle = '#ffffff';
    newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    
    container.appendChild(newWrapper);
    newWrapper.scrollIntoView({ behavior: 'smooth' });
}

// --- Drawing Logic ---
function startDraw(e) {
    if (e.target !== canvas) return;

    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    ctx.beginPath();

    if (currentTool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = globals.eraserWidth;
    } else {
        ctx.strokeStyle = globals.stroke;
        ctx.lineWidth = globals.lineWidth;
    }

    ctx.fillStyle = globals.fill;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Save snapshot so shapes don't duplicate on drag
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (currentTool === 'neon') {
        ctx.strokeStyle = '#ffffff'; // White core
        ctx.shadowBlur = 15;
        ctx.shadowColor = globals.stroke; // Colored glow
    } else {
        ctx.shadowBlur = 0;
    }

    // Start Path for continuous tools
    if (['brush', 'eraser', 'neon'].includes(currentTool)) {
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX, startY);
        ctx.stroke();
    } else if (currentTool === 'select') {
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
    } else {
        ctx.setLineDash([]);
    }
}

function drawing(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (['brush', 'eraser', 'neon'].includes(currentTool)) {
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
    } else if (currentTool === 'spray') {
        drawSpray(currentX, currentY);
    } else {
        // Shape dragging: Restore snapshot first
        ctx.putImageData(snapshot, 0, 0);

        // Setup shape stroke
        ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : globals.stroke;
        ctx.shadowBlur = 0;

        const w = currentX - startX;
        const h = currentY - startY;

        if (currentTool === 'select') {
            ctx.beginPath();
            ctx.rect(startX, startY, w, h);
            ctx.stroke();
            return;
        }

        ctx.beginPath();

        switch (currentTool) {
            case 'line':
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                break;
            case 'curve':
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(startX, currentY, currentX, currentY);
                break;
            case 'rectangle':
            case 'rect':
                ctx.rect(startX, startY, w, h);
                break;
            case 'square': {
                const size = Math.max(Math.abs(w), Math.abs(h));
                ctx.rect(startX, startY, w > 0 ? size : -size, h > 0 ? size : -size);
                break;
            }
            case 'rounded_rectangle':
                if (ctx.roundRect) {
                    ctx.roundRect(startX, startY, w, h, 10);
                } else {
                    ctx.rect(startX, startY, w, h);
                }
                break;
            case 'circle': {
                const radius = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2));
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                break;
            }
            case 'oval':
                if (ctx.ellipse) {
                    ctx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
                } else {
                    ctx.rect(startX, startY, w, h);
                }
                break;
            case 'polygon': { // Pentagon
                const sides = 5;
                const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
                const cx = startX + w / 2;
                const cy = startY + h / 2;
                for (let i = 0; i < sides; i++) {
                    const angle = i * 2 * Math.PI / sides - Math.PI / 2;
                    const px = cx + r * Math.cos(angle);
                    const py = cy + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            }
            case 'triangle':
                ctx.moveTo(startX + w / 2, startY);
                ctx.lineTo(startX, currentY);
                ctx.lineTo(currentX, currentY);
                ctx.closePath();
                break;
            case 'right_triangle':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX, currentY);
                ctx.lineTo(currentX, currentY);
                ctx.closePath();
                break;
            case 'diamond':
                ctx.moveTo(startX + w / 2, startY);
                ctx.lineTo(currentX, startY + h / 2);
                ctx.lineTo(startX + w / 2, currentY);
                ctx.lineTo(startX, startY + h / 2);
                ctx.closePath();
                break;
            case 'arrow': {
                const stemW = w * 0.5;
                const stemH = h * 0.4;
                if (w > 0) {
                    ctx.moveTo(startX, startY + h / 2 - stemH / 2);
                    ctx.lineTo(startX + stemW, startY + h / 2 - stemH / 2);
                    ctx.lineTo(startX + stemW, startY);
                    ctx.lineTo(currentX, startY + h / 2);
                    ctx.lineTo(startX + stemW, currentY);
                    ctx.lineTo(startX + stemW, startY + h / 2 + stemH / 2);
                    ctx.lineTo(startX, startY + h / 2 + stemH / 2);
                } else {
                    ctx.moveTo(startX, startY + h / 2 - stemH / 2);
                    ctx.lineTo(startX + stemW, startY + h / 2 - stemH / 2);
                    ctx.lineTo(startX + stemW, startY);
                    ctx.lineTo(currentX, startY + h / 2);
                    ctx.lineTo(startX + stemW, currentY);
                    ctx.lineTo(startX + stemW, startY + h / 2 + stemH / 2);
                    ctx.lineTo(startX, startY + h / 2 + stemH / 2);
                }
                ctx.closePath();
                break;
            }
            case 'star': {
                const cx = startX + w / 2;
                const cy = startY + h / 2;
                const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
                const innerRadius = outerRadius / 2;
                const spikes = 5;
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / spikes;

                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    let x = cx + Math.cos(rot) * outerRadius;
                    let y = cy + Math.sin(rot) * outerRadius;
                    ctx.lineTo(x, y);
                    rot += step;

                    x = cx + Math.cos(rot) * innerRadius;
                    y = cy + Math.sin(rot) * innerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                }
                ctx.closePath();
                break;
            }
            case 'bullet': {
                const d = Math.abs(h);
                if (w > 0) {
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(currentX - d / 2, startY);
                    ctx.arc(currentX - d / 2, startY + d / 2, d / 2, -Math.PI / 2, Math.PI / 2);
                    ctx.lineTo(startX, currentY);
                } else {
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(currentX + d / 2, startY);
                    ctx.arc(currentX + d / 2, startY + d / 2, d / 2, -Math.PI / 2, Math.PI / 2, true);
                    ctx.lineTo(startX, currentY);
                }
                ctx.closePath();
                break;
            }
            case 'heart': {
                const topCurveHeight = h * 0.3;
                ctx.moveTo(startX + w / 2, startY + topCurveHeight);
                ctx.bezierCurveTo(
                    startX, startY,
                    startX - w / 2, startY + h / 2,
                    startX + w / 2, currentY
                );
                ctx.bezierCurveTo(
                    currentX + w / 2, startY + h / 2,
                    currentX, startY,
                    startX + w / 2, startY + topCurveHeight
                );
                ctx.closePath();
                break;
            }
            case 'cube':
                draw3DCube(startX, startY, currentX - startX);
                // cube draws itself, so return
                return;
        }

        if (currentTool !== 'line' && currentTool !== 'curve') {
            ctx.fill();
        }
        ctx.stroke();
    }
}

function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentTool === 'select' && snapshot && e && e.clientX !== undefined) {
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        ctx.putImageData(snapshot, 0, 0); // Remove selection box

        const sx = Math.min(startX, currentX);
        const sy = Math.min(startY, currentY);
        const sw = Math.abs(currentX - startX);
        const sh = Math.abs(currentY - startY);

        if (sw > 5 && sh > 5) {
            const selectedData = ctx.getImageData(sx, sy, sw, sh);

            // Clear source
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx, sy, sw, sh);

            // Create floating element
            const wrapper = document.createElement('div');
            wrapper.className = 'anim-overlay';
            wrapper.style.left = sx + 'px';
            wrapper.style.top = sy + 'px';
            wrapper.style.zIndex = '50';
            wrapper.style.border = '1px dashed #ccc'; // So they know it's a floating selection

            const tempC = document.createElement('canvas');
            tempC.width = sw;
            tempC.height = sh;
            tempC.getContext('2d').putImageData(selectedData, 0, 0);
            wrapper.appendChild(tempC);

            wrapper.addEventListener('contextmenu', (evt) => {
                evt.preventDefault();
                if (confirm("Stamp selection back to canvas? (Cancel to delete instead)")) {
                    ctx.drawImage(tempC, parseInt(wrapper.style.left) || 0, parseInt(wrapper.style.top) || 0);
                    saveState();
                }
                wrapper.remove();
            });

            makeDraggable(wrapper);
            overlayContainer.appendChild(wrapper);

            // Switch back to brush automatically
            const brushBtn = document.querySelector('.btn-icon[data-tool="brush"]');
            if (brushBtn) brushBtn.click();
        }
    }

    ctx.setLineDash([]);
    ctx.beginPath(); // reset path
    ctx.shadowBlur = 0; // reset effects

    saveState();
}

// Special Tools
function drawSpray(x, y) {
    const radius = globals.lineWidth * 2;
    const density = 50;
    ctx.fillStyle = globals.stroke;

    for (let i = 0; i < density; i++) {
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetRadius = Math.random() * radius;
        ctx.fillRect(
            x + Math.cos(offsetAngle) * offsetRadius,
            y + Math.sin(offsetAngle) * offsetRadius,
            1, 1
        );
    }
}

function draw3DCube(x, y, size) {
    // A simple isometric cube drawer
    if (size < 0) size = Math.abs(size);
    if (size < 5) return; // Wait to draw until big enough

    const offset = size * 0.5;

    ctx.beginPath();
    // Back face
    ctx.strokeRect(x, y, size, size);

    // Front face
    ctx.fillRect(x - offset, y + offset, size, size);
    ctx.strokeRect(x - offset, y + offset, size, size);

    // Connecting lines
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - offset, y + offset);
    ctx.moveTo(x + size, y); ctx.lineTo(x + size - offset, y + offset);
    ctx.moveTo(x, y + size); ctx.lineTo(x - offset, y + size + offset);
    ctx.moveTo(x + size, y + size); ctx.lineTo(x + size - offset, y + size + offset);
    ctx.stroke();
}

// --- Editor Helpers ---
function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    overlayContainer.innerHTML = '';
    saveState();
}

function addImageFromUrl() {
    const url = prompt("Enter Image URL (e.g. from Google Images):");
    if (!url || !url.trim()) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveState();
    };
    img.onerror = () => {
        alert("Failed to load image. The URL might be blocked by CORS or invalid.");
    };
    img.src = url;
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                saveState();
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }
}

// --- Animation / Overlay Hybrid Engine ---
function addAnimElement() {
    const text = document.getElementById('animTextInput').value;
    const animClass = document.getElementById('animType').value;
    const fontFam = document.getElementById('animFont').value;

    if (!text.trim()) return;

    const el = document.createElement('div');
    el.className = `anim-overlay`;
    if (animClass !== 'none') el.classList.add(animClass);

    el.innerText = text;
    el.style.fontFamily = fontFam;
    el.style.fontSize = `${Math.max(20, globals.lineWidth * 5)}px`;
    el.style.color = globals.stroke;

    // Position relatively inside overlayContainer
    el.style.left = '50px';
    el.style.top = '50px';

    // Make text node editable on double click
    el.ondblclick = function () {
        const newText = prompt("Edit text:", el.innerText);
        if (newText) el.innerText = newText;
    };

    // Right-click to delete text node
    el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (confirm("Delete this text element?")) {
            el.remove();
        }
    });

    makeDraggable(el);
    overlayContainer.appendChild(el);
}

function makeDraggable(el) {
    let isDragging = false;
    let initialX, initialY;

    el.onmousedown = function (e) {
        if (e.target !== el) return;
        isDragging = true;
        initialX = e.clientX - parseInt(el.style.left || 0);
        initialY = e.clientY - parseInt(el.style.top || 0);

        document.onmousemove = function (eMouse) {
            if (isDragging) {
                el.style.left = (eMouse.clientX - initialX) + "px";
                el.style.top = (eMouse.clientY - initialY) + "px";
            }
        };

        document.onmouseup = function () {
            isDragging = false;
            document.onmousemove = null;
        };
    };
}

// --- Persistence ---
function saveToHistory() {
    const activeUserStr = localStorage.getItem('aura_active_user');
    if (!activeUserStr) {
        alert("Please log in to save your history.");
        return;
    }

    const activeUser = JSON.parse(activeUserStr);
    const dataUrl = canvas.toDataURL();
    const key = `aura_history_${activeUser.email}`;
    const history = JSON.parse(localStorage.getItem(key)) || [];
    const docName = document.getElementById('documentName').value;

    const item = {
        name: docName,
        timestamp: Date.now(),
        imageData: document.querySelector('.main-canvas').toDataURL(),
        thumbnail: document.querySelector('.main-canvas').toDataURL()
    };

    const activeId = localStorage.getItem('aura_resume_id');
    if (activeId) {
        item.id = activeId;
        const existingIdx = history.findIndex(h => h.id === activeId);
        if (existingIdx >= 0) {
            history.splice(existingIdx, 1);
        }
    } else {
        item.id = 'aura_doc_' + Date.now();
        localStorage.setItem('aura_resume_id', item.id);
    }

    history.push(item);
    localStorage.setItem(key, JSON.stringify(history));

    alert("Canvas successfully secured to your workspace dashboard!");
}

function downloadImage() {
    const wrappers = document.querySelectorAll('.canvas-wrapper');
    if (wrappers.length === 0) return;
    
    const pageW = wrappers[0].querySelector('.main-canvas').width;
    const pageH = wrappers[0].querySelector('.main-canvas').height;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = pageW;
    exportCanvas.height = pageH * wrappers.length;
    const eCtx = exportCanvas.getContext('2d');

    // Fill white background just in case
    eCtx.fillStyle = '#ffffff';
    eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    wrappers.forEach((wrapper, index) => {
        const pCanvas = wrapper.querySelector('.main-canvas');
        const pOverlay = wrapper.querySelector('.overlay-container');
        const yOffset = index * pageH;
        
        // Draw the main canvas content
        eCtx.drawImage(pCanvas, 0, yOffset);

        // Render text and floating selections on top
        const overlays = pOverlay.children;
        for (let i = 0; i < overlays.length; i++) {
            const el = overlays[i];
            
            // Check for floating canvas
            const childCanvas = el.querySelector('canvas');
            if (childCanvas) {
                const left = parseInt(el.style.left) || 0;
                const top = parseInt(el.style.top) || 0;
                eCtx.drawImage(childCanvas, left, top + yOffset);
                continue;
            }

            // Check for text
            const text = el.innerText;
            if (text) {
                const style = window.getComputedStyle(el);
                eCtx.font = `${style.fontWeight || 'normal'} ${style.fontSize} ${style.fontFamily}`;
                eCtx.fillStyle = style.color;
                eCtx.textBaseline = 'top';
                
                const left = parseInt(el.style.left) || 0;
                const top = parseInt(el.style.top) || 0;
                eCtx.fillText(text, left, top + yOffset);
            }
        }
    });

    const link = document.createElement('a');
    link.download = (document.getElementById('documentName').value || 'AuraCanvas_Design') + '.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

// --- Video Export using Screen Capture API ---
let mediaRecorder;
let recordedChunks = [];

async function toggleRecordVideo() {
    const btn = document.getElementById('recordBtn');

    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { preferCurrentTab: true }
        });

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recordedChunks = [];

        mediaRecorder.ondataavailable = function (e) {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = function () {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = (document.getElementById('documentName').value || 'AuraCanvas_Animation') + '.webm';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            stream.getTracks().forEach(track => track.stop());

            btn.innerHTML = '<i class="fas fa-video"></i> Video';
            btn.style.background = 'rgba(239,71,111,0.2)';
            btn.title = 'Export Animated Video';
        };

        mediaRecorder.start();
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
        btn.style.background = 'rgba(239,71,111,0.8)';
        btn.title = 'Recording... click to stop';

    } catch (err) {
        console.error("Error starting recording:", err);
    }
}