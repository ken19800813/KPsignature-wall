document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById('clear-btn');
    const saveBtn = document.getElementById('save-btn');
    const undoBtn = document.getElementById('undo-btn');
    const eraserBtn = document.getElementById('eraser-btn');
    const stickerToggle = document.getElementById('sticker-toggle');
    const stickerPicker = document.getElementById('sticker-picker');
    const stickerItems = document.querySelectorAll('.kd-sticker-item');
    const brushSizeInput = document.getElementById('brush-size');
    const brushColorInput = document.getElementById('brush-color');
    const colorHexLabel = document.getElementById('color-hex');
    const loadingOverlay = document.getElementById('loading-overlay');

    let currentSize = 3;
    let currentColor = '#1B3969';
    let undoStack = [];
    let isEraser = false;

    // --- State Management ---
    function saveState() {
        const stickersData = Array.from(document.querySelectorAll('.kd-placed-sticker')).map(el => ({
            src: el.querySelector('img').src,
            left: el.style.left,
            top: el.style.top,
            width: el.style.width,
            height: el.style.height
        }));
        
        undoStack.push({
            canvas: canvas.toDataURL(),
            stickers: stickersData
        });
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
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
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
    let lastX = 0;
    let lastY = 0;

    // --- Stickers ---
    stickerToggle.addEventListener('click', () => {
        stickerPicker.classList.toggle('active');
        stickerToggle.classList.toggle('active');
    });

    stickerItems.forEach(item => {
        item.addEventListener('click', () => {
            saveState();
            addDraggableSticker(item.getAttribute('data-src'));
            stickerPicker.classList.remove('active');
            stickerToggle.classList.remove('active');
        });
    });

    function addDraggableSticker(src, savedData = null) {
        const sticker = document.createElement('div');
        sticker.className = 'kd-placed-sticker';
        sticker.innerHTML = `
            <img src="${src}">
            <div class="kd-sticker-delete"><span class="material-icons">close</span></div>
            <div class="kd-sticker-resizer"></div>
        `;
        
        const container = canvas.parentElement;
        if (savedData) {
            sticker.style.left = savedData.left;
            sticker.style.top = savedData.top;
            sticker.style.width = savedData.width;
            sticker.style.height = savedData.height;
        } else {
            sticker.style.left = (container.clientWidth / 2 - 60) + 'px';
            sticker.style.top = (container.clientHeight / 2 - 45) + 'px';
            sticker.style.width = '120px';
            sticker.style.height = '120px';
        }
        
        container.appendChild(sticker);
        const deleteHandler = (e) => {
            e.stopPropagation();
            saveState();
            sticker.remove();
        };

        sticker.querySelector('.kd-sticker-delete').addEventListener('click', deleteHandler);
        sticker.querySelector('.kd-sticker-delete').addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            deleteHandler(e);
        }, { passive: false });

        makeDraggableAndResizable(sticker);
    }

    function makeDraggableAndResizable(el) {
        const resizer = el.querySelector('.kd-sticker-resizer');
        let isDragging = false, isResizing = false;
        let startX, startY, startW, startH, startL, startT;

        const onStart = (e) => {
            const isDeleteBtn = e.target.closest('.kd-sticker-delete');
            if (isDeleteBtn) return; // 不要攔截刪除按鈕

            saveState();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            if (e.target === resizer) isResizing = true;
            else isDragging = true;

            startX = clientX;
            startY = clientY;
            startW = el.offsetWidth;
            startH = el.offsetHeight;
            startL = el.offsetLeft;
            startT = el.offsetTop;
            
            el.style.zIndex = 1001;
            if (e.cancelable) e.preventDefault();
        };

        const onMove = (e) => {
            if (!isDragging && !isResizing) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const parentRect = el.parentElement.getBoundingClientRect();

            if (isResizing) {
                const newW = startW + (clientX - startX);
                const ratio = startH / startW;
                el.style.width = Math.max(40, newW) + 'px';
                el.style.height = Math.max(40 * ratio, newW * ratio) + 'px';
            } else if (isDragging) {
                el.style.left = (clientX - parentRect.left - (startX - (startL + parentRect.left))) + 'px';
                el.style.top = (clientY - parentRect.top - (startY - (startT + parentRect.top))) + 'px';
            }
        };

        const onEnd = () => {
            isDragging = false;
            isResizing = false;
            el.style.zIndex = 10;
        };

        el.addEventListener('mousedown', onStart);
        resizer.addEventListener('mousedown', (e) => { e.stopPropagation(); onStart(e); });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        el.addEventListener('touchstart', onStart, {passive: false});
        window.addEventListener('touchmove', onMove, {passive: false});
        window.addEventListener('touchend', onEnd);
    }

    // --- Drawing ---
    function startDrawing(e) {
        saveState();
        isDrawing = true;
        syncToolState();
        const pos = getPos(e);
        [lastX, lastY] = [pos.x, pos.y];
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        [lastX, lastY] = [pos.x, pos.y];
    }

    function stopDrawing() { isDrawing = false; }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    // --- Logic ---
    brushSizeInput.addEventListener('input', (e) => {
        currentSize = e.target.value;
        syncToolState();
    });

    brushColorInput.addEventListener('input', (e) => {
        currentColor = e.target.value;
        colorHexLabel.textContent = currentColor.toUpperCase();
        if (isEraser) {
            isEraser = false;
            eraserBtn.classList.remove('active');
        }
        syncToolState();
    });

    eraserBtn.addEventListener('click', () => {
        isEraser = !isEraser;
        eraserBtn.classList.toggle('active', isEraser);
        syncToolState();
    });

    undoBtn.addEventListener('click', undo);
    clearBtn.addEventListener('click', () => {
        if (!confirm('確定要清除所有筆跡與貼圖嗎？')) return;
        saveState();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        ctx.scale(ratio, ratio);
        document.querySelectorAll('.kd-placed-sticker').forEach(s => s.remove());
    });

    // --- Keyboard Shortcuts ---
    window.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifier = isMac ? e.metaKey : e.ctrlKey;
        
        if (modifier && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        }
        if (modifier && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            clearBtn.click();
        }
    });

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    // --- CLOUD SAVE (SUPABASE) ---
    saveBtn.addEventListener('click', async () => {
        if (loadingOverlay) loadingOverlay.classList.remove('kd-invisible');
        
        try {
            // Flatten to 600px width
            const targetWidth = 600;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const scale = targetWidth / (canvas.width / ratio);
            const targetHeight = (canvas.height / ratio) * scale;

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = targetWidth;
            finalCanvas.height = targetHeight;
            const fctx = finalCanvas.getContext('2d');

            fctx.fillStyle = '#FFFFFF';
            fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            fctx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);

            const stickers = document.querySelectorAll('.kd-placed-sticker');
            const parentRect = canvas.parentElement.getBoundingClientRect();
            const displayRatio = targetWidth / parentRect.width;

            const drawPromises = Array.from(stickers).map(s => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.src = s.querySelector('img').src;
                    img.crossOrigin = "anonymous"; // Essential for potential remote stickers
                    img.onload = () => {
                        const rect = s.getBoundingClientRect();
                        const x = (rect.left - parentRect.left) * displayRatio;
                        const y = (rect.top - parentRect.top) * displayRatio;
                        const w = rect.width * displayRatio;
                        const h = rect.height * displayRatio;
                        fctx.drawImage(img, x, y, w, h);
                        resolve();
                    };
                });
            });

            await Promise.all(drawPromises);

            // 1. Convert to Blob
            const blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
            const fileName = `sig_${Date.now()}.png`;

            // 2. Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from('signatures')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = _supabase.storage
                .from('signatures')
                .getPublicUrl(fileName);

            // Get Guest Name
            const guestName = document.getElementById('guest-name').value.trim() || '嘉賓 / Guest';

            // 4. Insert into Database
            const { error: dbError } = await _supabase
                .from('signatures')
                .insert([{ 
                    image_url: publicUrl,
                    display_name: guestName 
                }]);

            if (dbError) throw dbError;

            window.location.href = 'index.html';
        } catch (err) {
            console.error('Upload failed:', err);
            alert('上傳失敗，請檢查網路連線或權限設定：' + err.message);
        } finally {
            if (loadingOverlay) loadingOverlay.classList.add('kd-invisible');
        }
    });
});
