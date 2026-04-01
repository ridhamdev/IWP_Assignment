let canvas = document.querySelector('.main-canvas');
let ctx = canvas.getContext('2d');
let overlayContainer = document.querySelector('.overlay-container');

let isDrawing = false;
let currentTool = 'brush';
let startX = 0, startY = 0;
let snapshot = null;

const globals = {
    stroke: '#ffffff',
    fill: '#9d4edd',
    lineWidth: 5,
    eraserWidth: 20
};

// --- History State ---
let undoStack = [];
let redoStack = [];

function saveState() {
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > 50) undoStack.shift();
    redoStack = []; 
}

function undo() {
    if (undoStack.length > 1) { 
        const currentState = undoStack.pop();
        redoStack.push(currentState);
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = undoStack[undoStack.length - 1]; 
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
    // Delete selected object on Backspace / Delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && activeTarget && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        deleteSelectedObject();
    }
});

// --- Initialization & Flow ---
window.onload = () => {
    // Fill canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const template = localStorage.getItem('aura_template');
    const resumeId = localStorage.getItem('aura_resume_id');
    const activeUserStr = localStorage.getItem('aura_active_user');

    if (!activeUserStr) {
        window.location.href = 'index.html';
        return;
    }
    const activeUser = JSON.parse(activeUserStr);

    if (resumeId) {
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
            if(item.overlayData) restoreOverlays(item.overlayData);
        } else saveState();
    } else if (template && template !== 'blank') {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            // Smart cover aspect ratio instead of absolute stretch
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio  = Math.max(hRatio, vRatio); // Cover strategy
            const centerShift_x = (canvas.width - img.width*ratio) / 2;
            const centerShift_y = (canvas.height - img.height*ratio) / 2;  
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0,0, img.width, img.height, centerShift_x, centerShift_y, img.width*ratio, img.height*ratio);
            saveState();
        };
        const urls = {
            'birthday': 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1000&q=90', // Higher res
            'festival': 'https://images.unsplash.com/photo-1542385151-efd9000785a0?w=1000&q=90',
            'cyberpunk': 'https://images.unsplash.com/photo-1530103862676-de8892b12fa4?w=1000&q=90',
            'abstract': 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1000&q=90'
        };
        img.src = urls[template] || "";
    } else {
        saveState();
    }
    initMoveable();
};


// Theme Toggle
function toggleTheme(e) {
    if (e.target.checked) setLightMode();
    else setDarkMode();
}
function setLightMode() {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('aura_theme', 'light');
}
function setDarkMode() {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('aura_theme', 'dark');
}
if(localStorage.getItem('aura_theme') === 'light') {
    document.getElementById('checkbox').checked = true;
    setLightMode();
}

// Global Moveable reference
let moveable;
let activeTarget = null;
let isCropMode = false;

function initMoveable() {
    if (!window.Moveable) return;
    
    // Create moveable inside the first wrapper layout
    moveable = new Moveable(document.body, {
        target: null,
        draggable: true,
        resizable: true,
        rotatable: true,
        keepRatio: false,
        snappable: true,
        bounds: null,
        clippable: false, // Cropping
        zoom: 1
    });

    moveable.on("drag", ({ target, transform }) => {
        target.style.transform = transform;
    }).on("resize", ({ target, width, height, drag }) => {
        target.style.width = width + "px";
        target.style.height = height + "px";
        target.style.transform = drag.transform;
    }).on("rotate", ({ target, drag }) => {
        target.style.transform = drag.transform;
    }).on("clip", ({ target, clipStyle }) => {
        target.style.clipPath = clipStyle;
    });

    // Detect click to select or unselect
    window.addEventListener('mousedown', (e) => {
        // If clicking on moveable controls, allow default
        if (e.target.closest('.moveable-control-box') || e.target.closest('.toolbar-left') || e.target.closest('.toolbar-right') || e.target.closest('.action-bar')) {
            return;
        }

        // If clicking on an overlay item
        const overlayItem = e.target.closest('.anim-overlay');
        
        if (overlayItem) {
            e.preventDefault();
            selectObject(overlayItem);
        } else if (e.target.tagName === 'CANVAS') {
            deselectObject();
        }
    });
}

function rgbToHex(color) {
    if(!color) return '#ffffff';
    if (color.startsWith('#')) return color;
    const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return '#ffffff';
    function hex(x) { return ("0" + parseInt(x).toString(16)).slice(-2); }
    return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
}

function selectObject(el) {
    if(activeTarget) activeTarget.classList.remove('selected-element');
    activeTarget = el;
    activeTarget.classList.add('selected-element');
    moveable.target = activeTarget;

    document.getElementById('objectPropsPanel').classList.add('active');
    document.getElementById('sharedProps').style.display = 'block';

    const imgNode = activeTarget.querySelector('img');
    const textNode = activeTarget.querySelector('.anim-content');

    if (imgNode) {
        document.getElementById('imageFilters').style.display = 'block';
        document.getElementById('textOnlyProps').style.display = 'none';
        
        const currentFilter = imgNode.style.filter || '';
        const b = currentFilter.match(/brightness\((\d+)\%\)/);
        const c = currentFilter.match(/contrast\((\d+)\%\)/);
        const s = currentFilter.match(/saturate\((\d+)\%\)/);

        document.getElementById('filterBrightness').value = b ? b[1] : 100;
        document.getElementById('filterContrast').value = c ? c[1] : 100;
        document.getElementById('filterSaturate').value = s ? s[1] : 100;
        document.getElementById('brightVal').innerText = document.getElementById('filterBrightness').value + '%';
        document.getElementById('contVal').innerText = document.getElementById('filterContrast').value + '%';
        document.getElementById('satVal').innerText = document.getElementById('filterSaturate').value + '%';

        hydrateAnimOptions(imgNode);
    } else if (textNode) {
        document.getElementById('imageFilters').style.display = 'none';
        document.getElementById('textOnlyProps').style.display = 'block';

        document.getElementById('editTextColor').value = rgbToHex(textNode.style.color);
        const fSize = parseInt(textNode.style.fontSize) || 20;
        document.getElementById('editFontSize').value = fSize;
        document.getElementById('editFontSizeVal').innerText = fSize + 'px';

        hydrateAnimOptions(textNode);
    }
}

function hydrateAnimOptions(node) {
    const animSel = document.getElementById('editObjectAnim');
    animSel.value = 'none';
    if (node.classList.contains('anim-bounce')) animSel.value = 'anim-bounce';
    if (node.classList.contains('anim-spin')) animSel.value = 'anim-spin';
    if (node.classList.contains('anim-pulse')) animSel.value = 'anim-pulse';
}

function deselectObject() {
    if (activeTarget) activeTarget.classList.remove('selected-element');
    activeTarget = null;
    if(moveable) moveable.target = null;
    document.getElementById('objectPropsPanel').classList.remove('active');
    isCropMode = false;
    if (moveable) moveable.clippable = false;
    document.getElementById('cropBtn').innerHTML = `<i class="fas fa-crop-alt"></i> Toggle Crop Mode`;
    document.getElementById('cropBtn').style.borderColor = 'var(--accent)';
}

function deleteSelectedObject() {
    if(activeTarget) {
        activeTarget.remove();
        deselectObject();
    }
}

function toggleCropMode() {
    isCropMode = !isCropMode;
    moveable.clippable = isCropMode;
    moveable.resizable = !isCropMode;
    const btn = document.getElementById('cropBtn');
    if(isCropMode) {
        btn.innerHTML = `<i class="fas fa-check"></i> Finish Crop`;
        btn.style.borderColor = 'var(--danger)';
    } else {
        btn.innerHTML = `<i class="fas fa-crop-alt"></i> Toggle Crop Mode`;
        btn.style.borderColor = 'var(--accent)';
    }
}

function updateFilters() {
    if(!activeTarget) return;
    const imgNode = activeTarget.querySelector('img');
    if(!imgNode) return;
    const b = document.getElementById('filterBrightness').value;
    const c = document.getElementById('filterContrast').value;
    const s = document.getElementById('filterSaturate').value;
    document.getElementById('brightVal').innerText = b + '%';
    document.getElementById('contVal').innerText = c + '%';
    document.getElementById('satVal').innerText = s + '%';
    imgNode.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function updateTextProps() {
    if(!activeTarget) return;
    const textNode = activeTarget.querySelector('.anim-content');
    if(!textNode) return;
    textNode.style.color = document.getElementById('editTextColor').value;
    const fsize = document.getElementById('editFontSize').value;
    textNode.style.fontSize = fsize + 'px';
    document.getElementById('editFontSizeVal').innerText = fsize + 'px';
    if(moveable) moveable.updateRect();
}

function updateObjectAnim() {
    if(!activeTarget) return;
    const innerNode = activeTarget.querySelector('img') || activeTarget.querySelector('.anim-content');
    if(!innerNode) return;
    const anim = document.getElementById('editObjectAnim').value;
    innerNode.classList.remove('anim-bounce', 'anim-spin', 'anim-pulse');
    if(anim !== 'none') innerNode.classList.add(anim);
    if(moveable) moveable.updateRect();
}


// --- Event Listeners ---
document.querySelectorAll('.btn-icon[data-tool]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-icon').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.getAttribute('data-tool');
        document.getElementById('shapeSelect').value = "";
        deselectObject();
    });
});

document.getElementById('shapeSelect')?.addEventListener('change', (e) => {
    document.querySelectorAll('.btn-icon').forEach(b => b.classList.remove('active'));
    currentTool = e.target.value;
    // Don't deselect automatically, maybe user wants to draw shape while layer is selected, but best practice is to untarget
    deselectObject();
});

document.getElementById('strokeColor').addEventListener('input', (e) => globals.stroke = e.target.value);
document.getElementById('fillColor').addEventListener('input', (e) => globals.fill = e.target.value);
document.getElementById('lineWidth').addEventListener('input', (e) => globals.lineWidth = e.target.value);
document.getElementById('eraserWidth')?.addEventListener('input', (e) => globals.eraserWidth = e.target.value);


// Canvas Mouse Events
const workspace = document.getElementById('workspace');

workspace.addEventListener('mousedown', (e) => {
    if (activeTarget && e.target !== activeTarget && e.target.closest('.moveable-control-box') == null) {
        // If they click on canvas, deselect is handled globally. 
        // Proceed with drawing if canvas.
    }

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


// --- Drawing Logic ---
function hexToRgba(hex) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return [(c>>16)&255, (c>>8)&255, c&255, 255];
    }
    return [0,0,0,255];
}

function floodFill(startX, startY, fillColorHex) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    
    const pixelStack = [[startX, startY]];
    const targetColor = hexToRgba(fillColorHex);
    
    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos+1];
    const startB = data[startPos+2];
    const startA = data[startPos+3];

    if (startR === targetColor[0] && startG === targetColor[1] &&
        startB === targetColor[2] && startA === targetColor[3]) {
        return;
    }

    function matchStartColor(pos) {
        return data[pos] === startR && data[pos+1] === startG &&
               data[pos+2] === startB && data[pos+3] === startA;
    }

    function colorPixel(pos) {
        data[pos] = targetColor[0];
        data[pos+1] = targetColor[1];
        data[pos+2] = targetColor[2];
        data[pos+3] = targetColor[3]; 
    }

    while(pixelStack.length) {
        const newPos = pixelStack.pop();
        let x = newPos[0];
        let y = newPos[1];

        let pixelPos = (y * width + x) * 4;
        while(y-- >= 0 && matchStartColor(pixelPos)) {
            pixelPos -= width * 4;
        }
        pixelPos += width * 4;
        ++y;
        
        let reachLeft = false;
        let reachRight = false;
        
        while(y++ < height - 1 && matchStartColor(pixelPos)) {
            colorPixel(pixelPos);

            if(x > 0) {
                if(matchStartColor(pixelPos - 4)) {
                    if(!reachLeft) {
                        pixelStack.push([x - 1, y]);
                        reachLeft = true;
                    }
                } else if(reachLeft) {
                    reachLeft = false;
                }
            }

            if(x < width - 1) {
                if(matchStartColor(pixelPos + 4)) {
                    if(!reachRight) {
                        pixelStack.push([x + 1, y]);
                        reachRight = true;
                    }
                } else if(reachRight) {
                    reachRight = false;
                }
            }
            pixelPos += width * 4;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    saveState();
}

function startDraw(e) {
    if (e.target !== canvas) return;

    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    if (currentTool === 'fill') {
        floodFill(startX, startY, globals.fill);
        return;
    }

    isDrawing = true;
    ctx.beginPath();
    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : globals.stroke;
    ctx.lineWidth = currentTool === 'eraser' ? globals.eraserWidth : globals.lineWidth;
    ctx.fillStyle = globals.fill;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (currentTool === 'neon') {
        ctx.strokeStyle = '#fff'; 
        ctx.shadowBlur = Math.max(10, globals.lineWidth * 2);
        ctx.shadowColor = globals.stroke; 
    } else {
        ctx.shadowBlur = 0;
    }

    if (['brush', 'eraser', 'neon'].includes(currentTool)) {
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX, startY);
        ctx.stroke();
    } else if (currentTool === 'select') {
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#00f5d4'; // Elite selection box color
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
        ctx.putImageData(snapshot, 0, 0);
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

        // Standard Geometry
        switch (currentTool) {
            case 'line':
                ctx.moveTo(startX, startY); ctx.lineTo(currentX, currentY); break;
            case 'curve':
                ctx.moveTo(startX, startY); ctx.quadraticCurveTo(startX, currentY, currentX, currentY); break;
            case 'rectangle': case 'rect':
                ctx.rect(startX, startY, w, h); break;
            case 'square':
                const size = Math.max(Math.abs(w), Math.abs(h));
                ctx.rect(startX, startY, w > 0 ? size : -size, h > 0 ? size : -size); break;
            case 'rounded_rectangle':
                if (ctx.roundRect) ctx.roundRect(startX, startY, w, h, Math.max(5, globals.lineWidth));
                else ctx.rect(startX, startY, w, h); 
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2));
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI); break;
            case 'oval':
                if (ctx.ellipse) ctx.ellipse(startX + w / 2, startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
                else ctx.rect(startX, startY, w, h); 
                break;
            case 'polygon': {
                const sides = 5;
                const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
                const cx = startX + w / 2, cy = startY + h / 2;
                for (let i = 0; i < sides; i++) {
                    const angle = i * 2 * Math.PI / sides - Math.PI / 2;
                    const px = cx + r * Math.cos(angle);
                    const py = cy + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); break;
            }
            case 'triangle':
                ctx.moveTo(startX + w / 2, startY); ctx.lineTo(startX, currentY); ctx.lineTo(currentX, currentY); ctx.closePath(); break;
            case 'diamond':
                ctx.moveTo(startX + w / 2, startY); ctx.lineTo(currentX, startY + h / 2); ctx.lineTo(startX + w / 2, currentY); ctx.lineTo(startX, startY + h / 2); ctx.closePath(); break;
            case 'arrow': {
                const stemW = w * 0.5, stemH = h * 0.4;
                const dir = w>0 ? 1 : -1;
                ctx.moveTo(startX, startY + h / 2 - stemH / 2);
                ctx.lineTo(startX + stemW, startY + h / 2 - stemH / 2);
                ctx.lineTo(startX + stemW, startY);
                ctx.lineTo(currentX, startY + h / 2);
                ctx.lineTo(startX + stemW, currentY);
                ctx.lineTo(startX + stemW, startY + h / 2 + stemH / 2);
                ctx.lineTo(startX, startY + h / 2 + stemH / 2);
                ctx.closePath(); break;
            }
            case 'star': {
                const cx = startX + w / 2, cy = startY + h / 2;
                const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2;
                const innerRadius = outerRadius / 2;
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / 5;
                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < 5; i++) {
                    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius); rot += step;
                    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius); rot += step;
                }
                ctx.closePath(); break;
            }
            case 'bullet': {
                const d = Math.abs(h);
                if (w > 0) { ctx.moveTo(startX, startY); ctx.lineTo(currentX - d / 2, startY); ctx.arc(currentX - d / 2, startY + d / 2, d / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(startX, currentY); } 
                else { ctx.moveTo(startX, startY); ctx.lineTo(currentX + d / 2, startY); ctx.arc(currentX + d / 2, startY + d / 2, d / 2, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(startX, currentY); }
                ctx.closePath(); break;
            }
            case 'heart': {
                const topCurveHeight = h * 0.3;
                ctx.moveTo(startX + w / 2, startY + topCurveHeight);
                ctx.bezierCurveTo(startX, startY, startX - w / 2, startY + h / 2, startX + w / 2, currentY);
                ctx.bezierCurveTo(currentX + w / 2, startY + h / 2, currentX, startY, startX + w / 2, startY + topCurveHeight);
                ctx.closePath(); break;
            }
        }

        if (currentTool !== 'line' && currentTool !== 'curve') ctx.fill();
        ctx.stroke();
    }
}

function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentTool === 'select' && snapshot && e.clientX !== undefined) {
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        ctx.putImageData(snapshot, 0, 0);

        const sx = Math.min(startX, currentX);
        const sy = Math.min(startY, currentY);
        const sw = Math.abs(currentX - startX);
        const sh = Math.abs(currentY - startY);

        if (sw > 10 && sh > 10) {
            const selectedData = ctx.getImageData(sx, sy, sw, sh);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx, sy, sw, sh);

            // Create floating image representing canvas selection
            const fCanvas = document.createElement('canvas');
            fCanvas.width = sw; fCanvas.height = sh;
            fCanvas.getContext('2d').putImageData(selectedData, 0, 0);
            
            const dataUrl = fCanvas.toDataURL();
            createOverlayImage(dataUrl, sx, sy, sw, sh);
            
            const brushBtn = document.querySelector('.btn-icon[data-tool="brush"]');
            if (brushBtn) brushBtn.click();
        }
    }

    ctx.setLineDash([]);
    ctx.beginPath(); 
    ctx.shadowBlur = 0; 
    saveState();
}

function drawSpray(x, y) {
    const radius = globals.lineWidth * 2;
    const density = 50;
    ctx.fillStyle = globals.stroke;
    for (let i = 0; i < density; i++) {
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetRadius = Math.random() * radius;
        ctx.fillRect(x + Math.cos(offsetAngle) * offsetRadius, y + Math.sin(offsetAngle) * offsetRadius, 1, 1);
    }
}


// --- Editor Actions ---
function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    overlayContainer.innerHTML = '';
    deselectObject();
    saveState();
}

function addImageFromUrl() {
    const url = prompt("Enter Image URL (e.g. from Web):");
    if (!url || !url.trim()) return;
    createOverlayImage(url, 50, 50, 300, 300); // 300 is default insert scale
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 400; // default cap for visual placement
                let w = img.width;
                let h = img.height;
                if(w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim/w, maxDim/h);
                    w *= ratio;
                    h *= ratio;
                }
                createOverlayImage(event.target.result, 100, 100, w, h);
            };
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }
}

function createOverlayImage(src, left, top, w, h) {
    const el = document.createElement('div');
    el.className = `anim-overlay`;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    
    const imgElement = document.createElement('img');
    imgElement.src = src;
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    imgElement.style.objectFit = 'contain';
    imgElement.style.pointerEvents = 'none'; // fix for Moveable drag conflicts
    el.appendChild(imgElement);

    overlayContainer.appendChild(el);
    setTimeout(() => selectObject(el), 50); 
}

function addAnimElement() {
    const text = document.getElementById('animTextInput').value;
    const fontFam = document.getElementById('animFont').value;
    const animClass = document.getElementById('animType').value;

    if (!text.trim()) return;

    const el = document.createElement('div');
    el.className = `anim-overlay`;
    el.style.left = '50px';
    el.style.top = '50px';

    const inner = document.createElement('div');
    inner.className = 'anim-content';
    if(animClass && animClass !== 'none') inner.classList.add(animClass);

    inner.innerText = text;
    inner.style.fontFamily = fontFam;
    inner.style.fontSize = `${Math.max(20, globals.lineWidth * 4)}px`;
    inner.style.color = globals.fill; 
    inner.style.fontWeight = 'bold';
    inner.style.whiteSpace = 'nowrap';
    inner.style.padding = '10px'; 
    el.appendChild(inner);

    inner.ondblclick = function () {
        const newText = prompt("Edit text:", inner.innerText);
        if (newText) {
            inner.innerText = newText;
            if(moveable && moveable.target === el) moveable.updateRect();
        }
    };

    overlayContainer.appendChild(el);
    setTimeout(() => selectObject(el), 50);
}

function serializeOverlays() {
    const arr = [];
    for(let el of overlayContainer.children) {
        if(el.classList.contains('anim-overlay')) {
            const innerTextNode = el.querySelector('.anim-content');
            const imgNode = el.querySelector('img');
            arr.push({
                isImage: !!imgNode,
                src: imgNode ? imgNode.src : null,
                text: innerTextNode ? innerTextNode.innerText : null,
                outerStyle: el.style.cssText,
                innerStyle: innerTextNode ? innerTextNode.style.cssText : (imgNode ? imgNode.style.cssText : ''),
                innerClass: innerTextNode ? innerTextNode.className : (imgNode ? imgNode.className : '')
            });
        }
    }
    return arr;
}

function restoreOverlays(arr) {
    overlayContainer.innerHTML = '';
    if(!arr) return;
    for(let data of arr) {
        const el = document.createElement('div');
        el.className = 'anim-overlay';
        el.style.cssText = data.outerStyle;
        
        if(data.isImage) {
            const imgNode = document.createElement('img');
            imgNode.src = data.src;
            imgNode.style.cssText = data.innerStyle;
            imgNode.className = data.innerClass;
            imgNode.style.pointerEvents = 'none';
            el.appendChild(imgNode);
        } else {
            const innerTextNode = document.createElement('div');
            innerTextNode.className = data.innerClass || 'anim-content';
            innerTextNode.style.cssText = data.innerStyle || '';
            innerTextNode.innerText = data.text;
            innerTextNode.ondblclick = function () {
                const newText = prompt("Edit text:", innerTextNode.innerText);
                if (newText) {
                    innerTextNode.innerText = newText;
                    if(moveable && moveable.target === el) moveable.updateRect();
                }
            };
            el.appendChild(innerTextNode);
        }
        overlayContainer.appendChild(el);
    }
}

function addPage() {
    const container = document.getElementById('pagesContainer');
    const newWrapper = document.createElement('div');
    newWrapper.className = 'canvas-wrapper';
    newWrapper.style = "width: 800px; height: 600px; margin-top:20px;";
    newWrapper.innerHTML = `
        <canvas class="main-canvas" width="800" height="600" style="position: absolute; top:0; left:0; z-index: 1;"></canvas>
        <canvas class="temp-canvas" width="800" height="600" style="position: absolute; top:0; left:0; z-index: 2; pointer-events: none;"></canvas>
        <div class="overlay-container" style="position: absolute; top:0; left:0; width: 100%; height: 100%; z-index: 5;"></div>
    `;
    const newCanvas = newWrapper.querySelector('.main-canvas');
    const newCtx = newCanvas.getContext('2d');
    newCtx.fillStyle = '#ffffff';
    newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    container.appendChild(newWrapper);
    newWrapper.scrollIntoView({ behavior: 'smooth' });
}


// --- Export (Highly Accurate using html2canvas) ---
async function downloadImage() {
    deselectObject(); // Unselect to hide moveable handles before export
    if(moveable) moveable.destroy(); // Briefly destroy controls
    const wrappers = document.querySelectorAll('.canvas-wrapper');
    if (wrappers.length === 0) return;

    // Use html2canvas to flawlessly render entire div including animations, rotation, crop
    try {
        const fullExportCanvas = document.createElement('canvas');
        const pageW = wrappers[0].offsetWidth;
        const pageH = wrappers[0].offsetHeight;
        fullExportCanvas.width = pageW;
        fullExportCanvas.height = pageH * wrappers.length;
        const fCtx = fullExportCanvas.getContext('2d');
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0,0,fullExportCanvas.width, fullExportCanvas.height);

        for(let i=0; i<wrappers.length; i++) {
            const wrapper = wrappers[i];
            const pageCanvas = await html2canvas(wrapper, {
                backgroundColor: null,
                scale: 2, // High DPI export
                logging: false,
                useCORS: true
            });
            fCtx.drawImage(pageCanvas, 0, i * pageH, pageW, pageH);
        }

        const link = document.createElement('a');
        link.download = (document.getElementById('documentName').value || 'AuraCanvas_Design') + '.png';
        link.href = fullExportCanvas.toDataURL('image/png', 1.0);
        link.click();

    } catch(err) {
        console.error("Export Error: ", err);
        alert("There was an issue rendering the canvas. Try ensuring external images allow Canvas usage.");
    } finally {
        initMoveable(); // Re-initalize interactive controls
    }
}

// --- Persistence ---
function saveToHistory() {
    deselectObject();
    const activeUserStr = localStorage.getItem('aura_active_user');
    if (!activeUserStr) {
        alert("Please log in to save your history.");
        return;
    }
    const activeUser = JSON.parse(activeUserStr);
    const key = `aura_history_${activeUser.email}`;
    const history = JSON.parse(localStorage.getItem(key)) || [];
    const docName = document.getElementById('documentName').value;

    const item = {
        name: docName,
        timestamp: Date.now(),
        // Simple thumbnail is just the first main canvas graphic without overlays for lighter storage.
        imageData: document.querySelector('.main-canvas').toDataURL('image/jpeg', 0.8),
        thumbnail: document.querySelector('.main-canvas').toDataURL('image/jpeg', 0.5),
        overlayData: serializeOverlays()
    };

    const activeId = localStorage.getItem('aura_resume_id');
    if (activeId) {
        item.id = activeId;
        const existingIdx = history.findIndex(h => h.id === activeId);
        if (existingIdx >= 0) history.splice(existingIdx, 1);
    } else {
        item.id = 'aura_doc_' + Date.now();
        localStorage.setItem('aura_resume_id', item.id);
    }

    history.push(item);
    localStorage.setItem(key, JSON.stringify(history));
    alert("Canvas successfully secured to your workspace dashboard!");
}

// --- Video Export using Screen Capture API ---
let mediaRecorder;
let recordedChunks = [];
async function toggleRecordVideo() {
    deselectObject();
    const btn = document.getElementById('recordBtn');
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { preferCurrentTab: true } });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recordedChunks = [];
        mediaRecorder.ondataavailable = function (e) {
            if (e.data.size > 0) recordedChunks.push(e.data);
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
        btn.innerHTML = '<i class="fas fa-stop"></i> Stop Video';
        btn.style.background = 'rgba(239,71,111,0.8)';
        btn.title = 'Recording... click to stop';
    } catch (err) { }
}