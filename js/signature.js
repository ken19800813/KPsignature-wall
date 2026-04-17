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

    let currentSize = 3;
    let currentColor = '#1B3969';
    let undoStack = [];
    let isEraser = false;

    // --- Premium notification ---
    function showNotification(msg) {
        // Remove existing ones to prevent stacking
        const existing = document.querySelectorAll('.kd-notification');
        existing.forEach(el => el.remove());

        const notif = document.createElement('div');
        notif.className = 'kd-notification';
        notif.textContent = msg;
        document.body.appendChild(notif);
        
        // Auto remove
        setTimeout(() => {
            if (notif.parentNode) {
                notif.style.opacity = '0';
                notif.style.transition = 'opacity 0.5s ease';
                setTimeout(() => notif.remove(), 500);
            }
        }, 3000);
    }

    // --- Sticker Asset Manager (Central Cache & Negative Cache) ---
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
            sessionStorage.setItem('sig_sticker_neg_cache', JSON.stringify(this.negativeCache));
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
                img.onerror = () => {
                    if (!this.negativeCache.includes(path)) {
                        this.negativeCache.push(path);
                    }
                    resolve();
                };
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
    let stickersLoaded = false;
    stickerToggle.addEventListener('click', () => {
        stickerPicker.classList.toggle('active');
        stickerToggle.classList.toggle('active');
        if (stickerPicker.classList.contains('active') && !stickersLoaded) {
            StickerAssetManager.init(stickerPicker).then(() => {
                stickersLoaded = true;
            });
        }
    });

    // Use Event Delegation for dynamically loaded stickers
    stickerPicker.addEventListener('click', (e) => {
        const item = e.target.closest('.kd-sticker-item');
        if (item) {
            saveState();
            addDraggableSticker(item.getAttribute('data-src'));
            stickerPicker.classList.remove('active');
            stickerToggle.classList.remove('active');
        }
    });

    // --- Photo Upload ---
    photoBtn.addEventListener('click', () => {
        photoUpload.click();
    });

    // --- AI Content Moderation ---
    async function checkMaliceAI(blob, guestName) {
        // 優先從 js/ai-config.js 讀取 (本地開發)，若無則嘗試從 localStorage 讀取 (線上環境手動設定)
        let FINAL_KEY = "";
        if (typeof AI_API_KEY !== 'undefined') {
            FINAL_KEY = AI_API_KEY;
        } else {
            FINAL_KEY = localStorage.getItem('gemini_api_key') || "";
        }
        
        if (!FINAL_KEY) {
            console.warn('AI 審核功能未啟用 (缺少 API Key)。若在線上環境，可在 Console 輸入 localStorage.setItem("gemini_api_key", "您的Key") 來啟用。');
            return true; 
        }

        try {
            showNotification('AI 正在審核內容安全性...');
            
            // 轉換圖片為 Base64
            const base64Data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });

            const prompt = `
                任務：嚴格審核手寫簽名板內容，維護平台和諧。
                使用者姓名：${guestName}
                圖片內容：包含使用者手寫字跡、貼圖或上傳的照片。
                
                【審核標準 - 必須攔截的內容】：
                1. 針對「柯文哲」的仇恨言論、攻擊性文字或惡意嘲諷。
                2. 包含以下敏感關鍵字（或含義相近者）：
                   - 貪污、貪汙、收賄、髒錢
                   - 17年、十七年 (關於刑期之惡意預測)
                   - 關、被關、進去蹲、吃牢飯
                   - 坐牢、監獄、囚犯
                   - 飛輪、踩飛輪 (具負面連結之惡意調侃)
                   - 任何形式的粗俗髒話 (如：x、xx、xxx之類)
                3. 一般性違規：色情內容、商業廣告、色情暗示之圖文。
                
                【審核標準 - 應予通過的內容】：
                - 所有的加油、打氣、祝福文字（例如：柯P加油、清白、支持、平安）。
                - 無政治相關但具創意、溫暖、正向的塗鴉。
                
                請嚴格審查圖片中的手寫文字（OCR）與整體語境。
                請僅回傳以下格式的 JSON，不要有其他說明文字：
                {"is_malicious": boolean, "reason": "說明攔截原因 (例如：偵測到針對特定對象的攻擊性詞彙)"}
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${FINAL_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                        ]
                    }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });

            const result = await response.json();
            const responseText = result.candidates[0].content.parts[0].text;
            const evalResult = JSON.parse(responseText);

            if (evalResult.is_malicious) {
                alert(`【系統提醒】內容審核未通過：\n${evalResult.reason}\n\n請保持理性並重新編輯您的簽名，謝謝您的協助。`);
                return false;
            }

            console.log('AI 審核通過');
            return true;
        } catch (e) {
            console.error('AI 審核發生異常:', e);
            // 異常時預設放行，避免造成使用者體驗斷點
            return true; 
        }
    }

    photoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // Resize photo before adding to keep memory low
                const maxDim = 800; // Max dimension for placed photo
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = (h / w) * maxDim; w = maxDim; }
                    else { w = (w / h) * maxDim; h = maxDim; }
                }

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = w;
                tempCanvas.height = h;
                const tctx = tempCanvas.getContext('2d');
                tctx.drawImage(img, 0, 0, w, h);
                
                // Add as a sticker
                saveState();
                addDraggableSticker(tempCanvas.toDataURL('image/jpeg', 0.8));
                photoUpload.value = ''; // Reset input
            };
        };
        reader.readAsDataURL(file);
    });

    // --- Flatten & Capture Board Logics ---
    async function captureBoard(isDownload = false) {
        console.log('Capturing board... isDownload:', isDownload);
        
        // Target high-quality width for screenshot
        const targetWidth = 1200; 
        const canvasRect = canvas.getBoundingClientRect();
        const ratio = targetWidth / canvasRect.width;
        const targetHeight = canvasRect.height * ratio;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;
        const fctx = finalCanvas.getContext('2d');

        // 1. Draw Board Background (White)
        fctx.fillStyle = '#FFFFFF';
        fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // 2. Draw Hand-drawn Signature Layer
        // We need to draw the source canvas properly scaled
        fctx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);

        // 3. Draw Stickers & Photos Layer
        const stickers = document.querySelectorAll('.kd-placed-sticker');
        const parentRect = canvas.parentElement.getBoundingClientRect();
        
        const drawPromises = Array.from(stickers).map(s => {
            return new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "anonymous"; 
                img.src = s.querySelector('img').src;
                
                img.onload = () => {
                    const rect = s.getBoundingClientRect();
                    const x = (rect.left - parentRect.left) * ratio;
                    const y = (rect.top - parentRect.top) * ratio;
                    const w = rect.width * ratio;
                    const h = rect.height * ratio;
                    fctx.drawImage(img, x, y, w, h);
                    resolve();
                };
                img.onerror = () => {
                    console.warn('Failed to load image for capture:', img.src);
                    resolve();
                };
            });
        });

        await Promise.all(drawPromises);

        // 4. Output as Compressed JPEG
        const quality = isDownload ? 0.9 : 0.75;
        const format = 'image/jpeg';
        
        if (isDownload) {
            const dataUrl = finalCanvas.toDataURL(format, quality);
            const link = document.createElement('a');
            link.download = `kente_signature_${Date.now()}.jpg`;
            link.href = dataUrl;
            link.click();
            return null;
        } else {
            return new Promise(resolve => finalCanvas.toBlob(resolve, format, quality));
        }
    }

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
        }

        container.appendChild(sticker);
        
        // Dynamic Aspect Ratio Handling
        const img = sticker.querySelector('img');
        img.onload = () => {
            if (!savedData) {
                const naturalRatio = img.naturalWidth / img.naturalHeight;
                const baseSize = 140; // Target placement size
                
                if (naturalRatio >= 1) { // Landscape or Square
                    sticker.style.width = baseSize + 'px';
                    sticker.style.height = (baseSize / naturalRatio) + 'px';
                } else { // Portrait
                    sticker.style.height = baseSize + 'px';
                    sticker.style.width = (baseSize * naturalRatio) + 'px';
                }
                
                // Recentering after size calculation
                sticker.style.left = (container.clientWidth / 2 - sticker.offsetWidth / 2) + 'px';
                sticker.style.top = (container.clientHeight / 2 - sticker.offsetHeight / 2) + 'px';
            }
        };
        
        const deleteBtn = sticker.querySelector('.kd-sticker-delete');
        const performDelete = (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveState();
            sticker.remove();
        };

        deleteBtn.addEventListener('click', performDelete);
        deleteBtn.addEventListener('touchstart', performDelete, { passive: false });
        deleteBtn.addEventListener('mousedown', (e) => e.stopPropagation());

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
        const guestName = document.getElementById('guest-name').value.trim();
        if (!guestName) {
            showNotification('請輸入您的姓名後再送出哦！');
            return;
        }

        // Check if there's any content on the board
        const stickers = document.querySelectorAll('.kd-placed-sticker');
        const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let isCanvasDirty = false;
        // Check if any pixel has been drawn (alpha > 0)
        for (let i = 0; i < pixelData.length; i += 4) {
            if (pixelData[i + 3] > 0) {
                isCanvasDirty = true;
                break;
            }
        }

        if (stickers.length === 0 && !isCanvasDirty) {
            showNotification('簽名板上還沒有內容喔，請簽名或加入貼圖！');
            return;
        }

        if (loadingOverlay) loadingOverlay.classList.remove('kd-invisible');
        
        try {
            // 1. Capture and Compress the board
            const blob = await captureBoard(false);
            if (!blob) throw new Error('畫布截取失敗');

            // 1.5 AI 視覺審核 (檢查姓名與圖片內容)
            const isSafe = await checkMaliceAI(blob, guestName);
            if (!isSafe) {
                if (loadingOverlay) loadingOverlay.classList.add('kd-invisible');
                return; // 終止儲存
            }

            const fileName = `sig_${Date.now()}.jpg`;

            // 2. Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from('signatures')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = _supabase.storage
                .from('signatures')
                .getPublicUrl(fileName);

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
            alert('上傳失敗：' + err.message);
        } finally {
            if (loadingOverlay) loadingOverlay.classList.add('kd-invisible');
        }
    });
});
