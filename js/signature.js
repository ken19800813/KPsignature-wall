document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById('clear-btn');
    const saveBtn = document.getElementById('save-btn');
    const undoBtn = document.getElementById('undo-btn');
    const eraserBtn = document.getElementById('eraser-btn');
    const stickerToggle = document.getElementById('sticker-toggle');
    const photoBtn = document.getElementById('photo-btn');
    const photoUpload = document.getElementById('photo-upload');
    const stickerPicker = document.getElementById('sticker-picker');
    const brushSizeInput = document.getElementById('brush-size');
    const brushColorInput = document.getElementById('brush-color');
    const colorHexLabel = document.getElementById('color-hex');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Confirmation Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    // Placement Screen Elements
    const placementScreen = document.getElementById('placement-screen');
    const placementViewport = document.getElementById('placement-viewport');
    const placementContent = document.getElementById('placement-content');
    const placementWallBg = document.getElementById('placement-wall-bg');
    const userSigPreview = document.getElementById('user-sig-preview');
    const userSigPreviewImg = document.getElementById('user-sig-preview-img');
    const userSigPreviewName = document.getElementById('user-sig-preview-name');
    const placementCancel = document.getElementById('placement-cancel');
    const placementAuto = document.getElementById('placement-auto');
    const placementConfirm = document.getElementById('placement-confirm');

    let currentSize = 3;
    let currentColor = '#1B3969';
    let undoStack = [];
    let isEraser = false;

    // --- Placement State ---
    let finalPosX = 200;
    let finalPosY = 200;
    let finalRotation = 0;
    let placementScale = 0.5;
    let existingSignaturesPositions = [];
    let currentSignatureBlob = null; // Store blob to prevent redundant captures and canvas-clearing bugs

    // --- Premium notification ---
    function showNotification(msg) {
        const existing = document.querySelectorAll('.kd-notification');
        existing.forEach(el => el.remove());
        const notif = document.createElement('div');
        notif.className = 'kd-notification';
        notif.textContent = msg;
        document.body.appendChild(notif);
        setTimeout(() => {
            if (notif.parentNode) {
                notif.style.opacity = '0';
                notif.style.transition = 'opacity 0.5s ease';
                setTimeout(() => notif.remove(), 500);
            }
        }, 3000);
    }

    // --- Sticker Asset Manager ---
    const StickerAssetManager = {
        cache: new Set(),
        negativeCache: JSON.parse(sessionStorage.getItem('sig_sticker_neg_cache') || '[]'),
        maxId: 50,
        async init(container) {
            if (!container) return;
            const fragment = document.createDocumentFragment();
            const checks = [];
            for (let i = 1; i <= this.maxId; i++) {
                const id = i.toString().padStart(2, '0');
                const path = `images/${id}.gif`;
                if (!this.negativeCache.includes(path)) {
                    checks.push(this.verifyAndAppend(id, path, fragment));
                }
            }
            await Promise.all(checks);
            container.innerHTML = '';
            container.appendChild(fragment);
        },
        async verifyAndAppend(id, path, fragment) {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    this.cache.add(path);
                    const item = document.createElement('div');
                    item.className = 'kd-sticker-item';
                    item.setAttribute('data-src', path);
                    item.innerHTML = `<img src="${path}" alt="s${id}">`;
                    fragment.appendChild(item);
                    resolve();
                };
                img.onerror = () => { if (!this.negativeCache.includes(path)) this.negativeCache.push(path); resolve(); };
                img.src = path;
            });
        }
    };

    // --- State Management ---
    function saveState() {
        const stickersData = Array.from(document.querySelectorAll('.kd-placed-sticker')).map(el => ({
            src: el.querySelector('img').src,
            left: el.style.left,
            top: el.style.top,
            width: el.style.width,
            height: el.style.height
        }));
        undoStack.push({ canvas: canvas.toDataURL(), stickers: stickersData });
        if (undoStack.length > 50) undoStack.shift();
    }

    function undo() {
        if (undoStack.length === 0) return;
        const lastState = undoStack.pop();
        document.querySelectorAll('.kd-placed-sticker').forEach(el => el.remove());
        lastState.stickers.forEach(data => addDraggableSticker(data.src, data));
        const img = new Image();
        img.src = lastState.canvas;
        img.onload = () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            ctx.scale(ratio, ratio);
            ctx.drawImage(img, 0, 0, canvas.width / ratio, canvas.height / ratio);
            syncToolState();
        };
    }

    function syncToolState() {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = isEraser ? currentSize * 2 : currentSize;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    }

    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth * ratio;
        canvas.height = parent.clientHeight * ratio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        syncToolState();
    }

    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 100);

    let isDrawing = false;
    let lastX = 0, lastY = 0;

    stickerToggle.addEventListener('click', () => {
        stickerPicker.classList.toggle('active');
        stickerToggle.classList.toggle('active');
        if (stickerPicker.classList.contains('active')) StickerAssetManager.init(stickerPicker);
    });

    stickerPicker.addEventListener('click', (e) => {
        const item = e.target.closest('.kd-sticker-item');
        if (item) {
            saveState(); addDraggableSticker(item.getAttribute('data-src'));
            stickerPicker.classList.remove('active'); stickerToggle.classList.remove('active');
        }
    });

    photoBtn.addEventListener('click', () => photoUpload.click());
    photoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                saveState(); addDraggableSticker(img.src);
                photoUpload.value = '';
            };
        };
        reader.readAsDataURL(file);
    });

    // --- Capture Logic ---
    async function captureBoard(isDownload = false) {
        const targetWidth = 1200; 
        const canvasRect = canvas.getBoundingClientRect();
        const ratio = targetWidth / canvasRect.width;
        const targetHeight = canvasRect.height * ratio;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetWidth; finalCanvas.height = targetHeight;
        const fctx = finalCanvas.getContext('2d');
        fctx.fillStyle = '#FFFFFF'; fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        fctx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
        const stickers = document.querySelectorAll('.kd-placed-sticker');
        const parentRect = canvas.parentElement.getBoundingClientRect();
        const drawPromises = Array.from(stickers).map(s => {
            return new Promise(resolve => {
                const img = new Image(); img.crossOrigin = "anonymous"; img.src = s.querySelector('img').src;
                img.onload = () => {
                    const rect = s.getBoundingClientRect();
                    const x = (rect.left - parentRect.left) * ratio;
                    const y = (rect.top - parentRect.top) * ratio;
                    const w = rect.width * ratio; const h = rect.height * ratio;
                    fctx.drawImage(img, x, y, w, h); resolve();
                };
                img.onerror = resolve;
            });
        });
        await Promise.all(drawPromises);
        fctx.fillStyle = '#28c8c8';
        fctx.font = `900 ${Math.round(18 * ratio)}px "Noto Sans TC"`;
        fctx.textAlign = 'right'; 
        fctx.textBaseline = 'alphabetic'; 
        const waterX = finalCanvas.width - (20 * ratio);
        const waterY = finalCanvas.height - (10 * ratio);
        fctx.fillText('柯文哲清清白白', waterX, waterY);
        
        if (isDownload) {
            const link = document.createElement('a');
            link.download = `sig_${Date.now()}.jpg`; link.href = finalCanvas.toDataURL('image/jpeg', 0.9); link.click();
            return null;
        }
        return new Promise(resolve => finalCanvas.toBlob(resolve, 'image/jpeg', 0.8));
    }

    function addDraggableSticker(src, savedData = null) {
        const sticker = document.createElement('div');
        sticker.className = 'kd-placed-sticker';
        sticker.innerHTML = `<img src="${src}"><div class="kd-sticker-delete"><span class="material-icons">close</span></div><div class="kd-sticker-resizer"></div>`;
        const container = canvas.parentElement;
        if (savedData) {
            sticker.style.left = savedData.left; sticker.style.top = savedData.top;
            sticker.style.width = savedData.width; sticker.style.height = savedData.height;
        }
        container.appendChild(sticker);
        const img = sticker.querySelector('img');
        img.onload = () => {
            if (!savedData) {
                const r = img.naturalWidth / img.naturalHeight;
                sticker.style.width = '140px'; sticker.style.height = (140 / r) + 'px';
                sticker.style.left = (container.clientWidth / 2 - 70) + 'px';
                sticker.style.top = (container.clientHeight / 2 - 70) + 'px';
            }
        };
        sticker.querySelector('.kd-sticker-delete').addEventListener('click', () => { saveState(); sticker.remove(); });
        makeDraggableAndResizable(sticker);
    }

    function makeDraggableAndResizable(el) {
        const resizer = el.querySelector('.kd-sticker-resizer');
        let isDragging = false, isResizing = false;
        let sx, sy, sw, sh, sl, st;
        const onStart = (e) => {
            if (e.target.closest('.kd-sticker-delete')) return;
            saveState(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY;
            if (e.target === resizer) isResizing = true; else isDragging = true;
            sx = cx; sy = cy; sw = el.offsetWidth; sh = el.offsetHeight; sl = el.offsetLeft; st = el.offsetTop;
            el.style.zIndex = 1001; if (e.cancelable) e.preventDefault();
        };
        const onMove = (e) => {
            if (!isDragging && !isResizing) return;
            const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY;
            const pr = el.parentElement.getBoundingClientRect();
            if (isResizing) {
                const nw = sw + (cx - sx); const r = sh / sw;
                el.style.width = Math.max(40, nw) + 'px'; el.style.height = Math.max(40 * r, nw * r) + 'px';
            } else if (isDragging) {
                el.style.left = (cx - pr.left - (sx - (sl + pr.left))) + 'px';
                el.style.top = (cy - pr.top - (sy - (st + pr.top))) + 'px';
            }
        };
        const onEnd = () => { isDragging = false; isResizing = false; el.style.zIndex = 10; };
        el.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
        el.addEventListener('touchstart', onStart, {passive: false}); window.addEventListener('touchmove', onMove, {passive: false}); window.addEventListener('touchend', onEnd);
    }

    // --- Drawing ---
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; syncToolState(); const p = getPos(e); [lastX, lastY] = [p.x, p.y]; }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { if (!isDrawing) return; e.preventDefault(); const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); [lastX, lastY] = [p.x, p.y]; }, { passive: false });
    canvas.addEventListener('mousedown', (e) => { isDrawing = true; syncToolState(); const p = getPos(e); [lastX, lastY] = [p.x, p.y]; });
    canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); [lastX, lastY] = [p.x, p.y]; });
    window.addEventListener('mouseup', () => isDrawing = false); window.addEventListener('touchend', () => isDrawing = false);
    function getPos(e) { const r = canvas.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: cx - r.left, y: cy - r.top }; }

    brushSizeInput.addEventListener('input', (e) => { currentSize = e.target.value; syncToolState(); });
    brushColorInput.addEventListener('input', (e) => { currentColor = e.target.value; colorHexLabel.textContent = currentColor.toUpperCase(); isEraser = false; eraserBtn.classList.remove('active'); syncToolState(); });
    eraserBtn.addEventListener('click', () => { isEraser = !isEraser; eraserBtn.classList.toggle('active', isEraser); syncToolState(); });
    undoBtn.addEventListener('click', undo);
    clearBtn.addEventListener('click', () => { if (confirm('確定要清除所有筆跡與貼圖嗎？')) { saveState(); ctx.clearRect(0,0,canvas.width,canvas.height); document.querySelectorAll('.kd-placed-sticker').forEach(s => s.remove()); }});

    // --- Placement Mode Logic ---
    async function enterPlacementMode() {
        const guestName = document.getElementById('guest-name').value.trim();
        if (!guestName) { showNotification('請輸入您的姓名後再送出哦！'); return; }
        
        loadingOverlay.classList.remove('kd-invisible');
        try {
            // Capture ONCE and store. This prevents issues if the canvas is cleared by resize events
            // during the transition or while the user is on the placement screen.
            currentSignatureBlob = await captureBoard();
            const url = URL.createObjectURL(currentSignatureBlob);
            userSigPreviewImg.src = url;
            userSigPreviewName.textContent = guestName;
            
            placementScreen.classList.remove('kd-invisible');
            
            // Fetch Wall BG first to know the height
            const { data } = await _supabase.from('signatures').select('*').order('created_at', { ascending: false });
            existingSignaturesPositions = renderPlacementWall(data || []);
            
            // Initial Position: Centered horizontally, and start at the boundary (4 rows of space above)
            const contentW = parseFloat(placementContent.style.width) || (window.innerWidth / placementScale);
            finalPosX = (contentW - 350) / 2;
            finalPosY = 1280; 
            finalRotation = (Math.random() * 20) - 10;
            
            userSigPreview.style.left = finalPosX + 'px';
            userSigPreview.style.top = finalPosY + 'px';
            userSigPreview.style.rotate = finalRotation + 'deg';
            
            // Auto-scroll to show the preview
            setTimeout(() => {
                placementViewport.scrollTo({
                    top: (finalPosY * placementScale) - 100,
                    behavior: 'instant'
                });
            }, 100);
            
            initPlacementControls();
        } finally {
            loadingOverlay.classList.add('kd-invisible');
        }
    }

    function renderPlacementWall(signatures) {
        placementWallBg.innerHTML = '';
        const viewportW = window.innerWidth / placementScale;
        const dynamicCols = Math.max(3, Math.floor((viewportW - 100) / 400));
        let maxRowY = 0;
        const positions = [];

        signatures.forEach((sig, index) => {
            const col = index % dynamicCols; const row = Math.floor(index / dynamicCols);
            let px, py, rot;
            if (sig.pos_x !== null && sig.pos_x !== undefined) {
                px = sig.pos_x; py = sig.pos_y; rot = sig.rotation || 0;
            } else {
                px = 100 + col * 400 + (Math.sin(index) * 60);
                py = 1280 + row * 320 + (Math.cos(index) * 40); // 4 rows buffer (4 * 320)
                rot = (Math.sin(index * 8) * 15);
            }
            positions.push({ x: px, y: py });

            maxRowY = Math.max(maxRowY, py);
            const card = document.createElement('div');
            card.className = 'kd-sig-card-free';
            card.style.left = px + 'px'; card.style.top = py + 'px'; card.style.rotate = rot + 'deg';
            card.style.opacity = '0.5'; card.style.pointerEvents = 'none';
            // Add cache buster to prevent showing old images
            const imageUrl = sig.image_url + (sig.image_url.includes('?') ? '&' : '?') + 't=' + new Date(sig.created_at).getTime();
            card.innerHTML = `<img src="${imageUrl}" class="kd-sig-img"><div class="kd-sig-meta-v2"><span class="kd-sig-name">${sig.display_name}</span></div>`;
            placementWallBg.appendChild(card);
        });
        placementContent.style.width = Math.max(viewportW, dynamicCols * 400 + 500) + 'px';
        placementContent.style.height = (maxRowY + 1200) + 'px';
        placementContent.style.transform = `scale(${placementScale})`;

        return positions;
    }

    function initPlacementControls() {
        let isUserDrag = false; let lx, ly;
        userSigPreview.onmousedown = (e) => { isUserDrag = true; lx = e.clientX; ly = e.clientY; e.stopPropagation(); };
        window.addEventListener('mousemove', (e) => {
            if (isUserDrag) {
                const dx = (e.clientX - lx) / placementScale; const dy = (e.clientY - ly) / placementScale;
                finalPosX += dx; finalPosY += dy;
                
                // Boundaries
                const currentW = parseFloat(placementContent.style.width) || (window.innerWidth / placementScale);
                const padding = 60; // 增加邊距緩衝，防止旋轉時超出
                if (finalPosX < padding) finalPosX = padding;
                if (finalPosX > currentW - 350 - padding) finalPosX = currentW - 350 - padding;
                if (finalPosY < 0) finalPosY = 0;
                
                userSigPreview.style.left = finalPosX + 'px'; userSigPreview.style.top = finalPosY + 'px';
                lx = e.clientX; ly = e.clientY;
                
                // AUTO GROW Logic
                const currentH = parseFloat(placementContent.style.height);
                if (finalPosY + 400 > currentH) {
                    placementContent.style.height = (finalPosY + 800) + 'px';
                }
            }
        });
        window.addEventListener('mouseup', () => isUserDrag = false);
        
        userSigPreview.addEventListener('touchstart', (e) => { isUserDrag = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; e.stopPropagation(); }, {passive:false});
        window.addEventListener('touchmove', (e) => {
            if (isUserDrag) {
                const dx = (e.touches[0].clientX - lx) / placementScale; const dy = (e.touches[0].clientY - ly) / placementScale;
                finalPosX += dx; finalPosY += dy;
                
                // Boundaries
                const currentW = parseFloat(placementContent.style.width) || (window.innerWidth / placementScale);
                const padding = 60; // 增加邊距緩衝，防止旋轉時超出
                if (finalPosX < padding) finalPosX = padding;
                if (finalPosX > currentW - 350 - padding) finalPosX = currentW - 350 - padding;
                if (finalPosY < 0) finalPosY = 0;

                userSigPreview.style.left = finalPosX + 'px'; userSigPreview.style.top = finalPosY + 'px';
                lx = e.touches[0].clientX; ly = e.touches[0].clientY;
                
                const currentH = parseFloat(placementContent.style.height);
                if (finalPosY + 400 > currentH) {
                    placementContent.style.height = (finalPosY + 800) + 'px';
                }
            }
        }, {passive:false});
        window.addEventListener('touchend', () => isUserDrag = false);
    }

    saveBtn.addEventListener('click', () => {
        const guestName = document.getElementById('guest-name').value.trim();
        if (!guestName) { showNotification('請輸入您的姓名後再送出哦！'); return; }
        confirmModal.classList.remove('kd-invisible');
    });

    modalConfirm.addEventListener('click', () => {
        confirmModal.classList.add('kd-invisible');
        enterPlacementMode();
    });

    modalCancel.addEventListener('click', () => confirmModal.classList.add('kd-invisible'));
    placementCancel.addEventListener('click', () => placementScreen.classList.add('kd-invisible'));

    placementAuto.addEventListener('click', () => {
        // Find a non-overlapping spot
        const cardW = 400; // conservative width
        const cardH = 350; // conservative height
        const viewportW = window.innerWidth / placementScale;
        
        let targetX = 300, targetY = 1280;
        let found = false;

        // Strategy: Try random spots first, checking against stored positions
        for (let i = 0; i < 200; i++) {
            const tx = 50 + Math.random() * (viewportW - cardW - 100);
            const ty = 1280 + Math.random() * 2500;
            
            let collision = false;
            for (const pos of existingSignaturesPositions) {
                if (!(tx + cardW < pos.x || tx > pos.x + cardW || ty + cardH < pos.y || ty > pos.y + cardH)) {
                    collision = true;
                    break;
                }
            }
            if (!collision) {
                targetX = tx; targetY = ty;
                found = true;
                break;
            }
        }

        if (!found) {
            // Fallback: Place at the absolute bottom
            let maxY = 1280;
            existingSignaturesPositions.forEach(p => { if (p.y > maxY) maxY = p.y; });
            targetX = 100 + Math.random() * (viewportW - 450);
            targetY = maxY + 350;
        }

        const targetRot = (Math.random() * 30) - 15;
        
        // Update state
        finalPosX = targetX;
        finalPosY = targetY;
        finalRotation = targetRot;

        // Animate visually
        userSigPreview.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        userSigPreview.style.left = finalPosX + 'px';
        userSigPreview.style.top = finalPosY + 'px';
        userSigPreview.style.rotate = finalRotation + 'deg';
        
        // Scroll to show the new position
        setTimeout(() => {
            placementViewport.scrollTo({
                top: (finalPosY * placementScale) - 200,
                left: (finalPosX * placementScale) - (window.innerWidth / 2) + 150,
                behavior: 'smooth'
            });
            setTimeout(() => { userSigPreview.style.transition = ''; }, 600);
        }, 100);
        
        showNotification('系統已為您找到一個空位！');
    });

    placementConfirm.addEventListener('click', async () => {
        if (!currentSignatureBlob) {
            alert('找不到簽名資料，請重新嘗試');
            placementScreen.classList.add('kd-invisible');
            return;
        }

        loadingOverlay.classList.remove('kd-invisible');
        try {
            const fileName = `sig_${Date.now()}.jpg`;
            await _supabase.storage.from('signatures').upload(fileName, currentSignatureBlob);
            const { data: { publicUrl } } = _supabase.storage.from('signatures').getPublicUrl(fileName);
            
            await _supabase.from('signatures').insert([{
                image_url: publicUrl,
                display_name: userSigPreviewName.textContent,
                pos_x: finalPosX,
                pos_y: finalPosY,
                rotation: finalRotation
            }]);
            
            window.location.href = 'index.html';
        } catch (err) { alert('上傳失敗'); }
    });
});
