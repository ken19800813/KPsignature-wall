document.addEventListener('DOMContentLoaded', async () => {
    // 【自動清空指令】強制清空本地舊資料，確保只讀取雲端
    localStorage.clear();
    console.log('Local storage cleared for cloud migration.');

    const wallContainer = document.getElementById('signature-wall');
    const zoomSlider = document.getElementById('zoom-slider');
    
    let currentMinWidth = 350; 

    // Konami Code Logic
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'keyb', 'keya'];
    let konamiIndex = 0;

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        let currentTarget = konamiCode[konamiIndex];
        let match = (currentTarget.startsWith('key')) ? (key === currentTarget.replace('key', '')) : (e.key === currentTarget);
        if (match) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                unlockAdmin();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = (e.key === konamiCode[0]) ? 1 : 0;
        }
    });

    // Mobile Admin Unlock: Click '清', '清', '白', '白' sequence twice
    const unlockChars = document.querySelectorAll('.kd-unlock-char');
    const secretSequence = ['清', '清', '白', '白', '清', '清', '白', '白'];
    let secretIndex = 0;
    let sequenceTimer = null;

    const handleUnlockTap = (el, char) => {
        // Visual feedback
        el.classList.add('active-tap');
        setTimeout(() => el.classList.remove('active-tap'), 200);

        // Reset if no activity for 3s
        clearTimeout(sequenceTimer);
        sequenceTimer = setTimeout(() => {
            secretIndex = 0;
            console.log('Sequence reset due to timeout');
        }, 3000);

        if (char === secretSequence[secretIndex]) {
            secretIndex++;
            if (secretIndex === secretSequence.length) {
                unlockAdmin();
                secretIndex = 0;
                clearTimeout(sequenceTimer);
            }
        } else {
            // Check if user is starting over
            secretIndex = (char === secretSequence[0]) ? 1 : 0;
        }
    };

    unlockChars.forEach(el => {
        // Use pointerdown for fastest response on both mouse and touch
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handleUnlockTap(el, el.getAttribute('data-char'));
        });
    });

    function unlockAdmin() {
        document.body.classList.add('admin-mode-active');
        const notification = document.createElement('div');
        notification.className = 'kd-notification';
        notification.innerHTML = '🔓 管理限權已解除';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Slider Zoom Logic
    zoomSlider.addEventListener('input', (e) => {
        currentMinWidth = e.target.value;
        updateZoom();
    });

    function updateZoom() {
        document.documentElement.style.setProperty('--kd-wall-min-width', currentMinWidth + 'px');
    }

    // --- SUPABASE FETCH ---
    async function fetchSignatures() {
        wallContainer.innerHTML = '<div class="kd-wall-loading"><p>正在從雲端載入簽名牆...</p></div>';
        
        try {
            const { data, error } = await _supabase
                .from('signatures')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderWall(data);
        } catch (err) {
            console.error('Fetch failed:', err);
            // Fallback to local storage if offline or failed
            const localSignatures = JSON.parse(localStorage.getItem('signatures') || '[]');
            renderWall(localSignatures.map(s => ({ id: s.id, image_url: s.image, created_at: s.date })));
        }
    }

    function renderWall(signatures) {
        wallContainer.innerHTML = '';

        if (!signatures || signatures.length === 0) {
            wallContainer.innerHTML = '<p class="kd-empty-state">目前尚無簽名，期待您成為第一位！</p>';
            return;
        }

        // Auto-sizing logic
        if (signatures.length > 3 && !zoomSlider.matches(':active') && currentMinWidth === 350) {
            if (signatures.length > 8) currentMinWidth = 200;
            else if (signatures.length > 4) currentMinWidth = 250;
            zoomSlider.value = currentMinWidth;
            updateZoom();
        }

        wallContainer.classList.add('kd-signature-wall-dense');
        signatures.forEach(sig => {
            const date = new Date(sig.created_at).toLocaleString('zh-TW', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const displayName = sig.display_name || '嘉賓 / Guest';
            const card = document.createElement('div');
            card.className = 'kd-sig-card-small kd-sig-card';
            card.innerHTML = `
                <img src="${sig.image_url}" class="kd-sig-img" alt="Signature">
                <div class="kd-sig-meta-v2">
                    <span class="kd-sig-name">${displayName}</span>
                    <span class="kd-sig-date">${date}</span>
                </div>
                <div class="kd-sig-admin-tools">
                   <button class="kd-print-sig" title="列印"><span class="material-icons">print</span></button>
                   <button class="kd-delete-sig" title="刪除"><span class="material-icons">close</span></button>
                </div>
            `;
            const printBtn = card.querySelector('.kd-print-sig');
            const deleteBtn = card.querySelector('.kd-delete-sig');

            const handlePrint = (e) => { e.stopPropagation(); printSignature(sig.image_url); };
            const handleDelete = (e) => { e.stopPropagation(); deleteSignature(sig.id, sig.image_url); };

            printBtn.addEventListener('click', handlePrint);
            printBtn.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); handlePrint(e); }, {passive: false});

            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); handleDelete(e); }, {passive: false});
            wallContainer.appendChild(card);
        });
    }

    function printSignature(src) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><img src="${src}" style="max-width:90%;max-height:90%;"></body><script>window.onload=function(){window.print();window.close();};</script></html>`);
        printWindow.document.close();
    }

    async function deleteSignature(id, imageUrl) {
        if (!confirm('確定要永久刪除此簽名嗎？\n(這將同步移除雲端圖檔)')) return;
        
        try {
            console.log('正在刪除 ID:', id);

            // 1. 先從資料庫刪除紀錄
            const { error: dbError } = await _supabase
                .from('signatures')
                .delete()
                .eq('id', id);

            if (dbError) {
                console.error('資料庫刪除失敗:', dbError);
                throw new Error('資料庫存取失敗: ' + dbError.message);
            }

            // 2. 判斷是否為雲端網址，如果是才去刪除實體檔案
            if (imageUrl && imageUrl.includes('supabase.co')) {
                const fileName = imageUrl.split('/').pop();
                console.log('正在嘗試刪除雲端檔案:', fileName);
                
                const { error: storageError } = await _supabase.storage
                    .from('signatures')
                    .remove([fileName]);

                if (storageError) {
                    console.warn('雲端檔案刪除失敗（可能權限不足），但資料紀錄已移除:', storageError);
                }
            } else {
                console.log('偵測為本地舊資料，僅移除畫面顯示');
            }

            // 成功後重新載入
            fetchSignatures();
        } catch (err) {
            console.error('刪除程序發生錯誤:', err);
            alert('刪除失敗，錯誤原因：' + err.message);
        }
    }

    updateZoom(); 
    fetchSignatures();
});
