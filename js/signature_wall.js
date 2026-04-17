document.addEventListener('DOMContentLoaded', async () => {
    // 【自動清空指令】強制清空本地舊資料，確保只讀取雲端
    localStorage.clear();
    console.log('Local storage cleared for cloud migration.');

    const wallContainer = document.getElementById('signature-wall');
    const zoomSlider = document.getElementById('zoom-slider');
    
    let currentMinWidth = 350; 
    
    // --- View Tracking ---
    async function trackVisit() {
        try {
            await _supabase.from('page_views').insert([{ page: 'wall' }]);
        } catch (e) {
            console.warn('View tracking log failed. Make sure "page_views" table exists.');
        }
    }
    trackVisit(); // Log visit on load

    async function getVisitCount() {
        try {
            const { count, error } = await _supabase
                .from('page_views')
                .select('*', { count: 'exact', head: true });
            return error ? '---' : count;
        } catch (e) {
            return '---';
        }
    }

    // --- Security Module Start (Obfuscated) ---
    (function() {
        const _0x1f2 = (n, k) => String.fromCharCode(n ^ k);
        const _0x3d2 = [0x6e9a, 0x6e9a, 0x6f0f, 0x6f0f, 0x6e9a, 0x6e9a, 0x6f0f, 0x6f0f];
        const _0x5e1 = ["\x41\x72\x72\x6f\x77\x55\x70", "\x41\x72\x72\x6f\x77\x44\x6f\x77\x6e", "\x41\x72\x72\x6f\x77\x4c\x65\x66\x74", "\x41\x72\x72\x6f\x77\x52\x69\x67\x68\x74", "\x6b\x65\x79\x62", "\x6b\x65\x79\x61"];
        const _0x992 = [0, 0, 1, 1, 2, 3, 2, 3, 4, 5].map(i => _0x5e1[i]);
        let _0xidx = 0, _0xtidx = 0, _0xtmr = null;

        const _0xsec = async () => {
            const _0xcls = 'YWRtaW4tbW9kZS1hY3RpdmU=';
            document.body.classList.add(atob(_0xcls));
            
            // Fetch the count
            const viewCount = await getVisitCount();
            
            const _0xnot = document.createElement('div');
            _0xnot.className = 'kd-notification';
            _0xnot.style.display = 'flex';
            _0xnot.style.flexDirection = 'column';
            _0xnot.style.alignItems = 'center';
            _0xnot.style.gap = '4px';
            
            _0xnot.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons" style="font-size:18px;">lock_open</span>
                    <span>管理權限已解除</span>
                </div>
                <div style="font-size:12px;opacity:0.8;font-weight:normal;letter-spacing:1px;border-top:1px solid rgba(255,255,255,0.2);padding-top:4px;margin-top:2px;">
                    📊 累計網頁瀏覽人次：${viewCount}
                </div>
            `;
            document.body.appendChild(_0xnot);
            setTimeout(() => {
                _0xnot.style.opacity = '0';
                _0xnot.style.transition = 'opacity 0.5s ease';
                setTimeout(() => _0xnot.remove(), 500);
            }, 4000);
        };

        window.addEventListener('keydown', (e) => {
            const _0xk = e.key.toLowerCase();
            const _0xt = _0x992[_0xidx];
            if ((_0xt.startsWith('key') ? (_0xk === _0xt.slice(3)) : (e.key === _0xt))) {
                _0xidx++; if (_0xidx === _0x992.length) { _0xsec(); _0xidx = 0; }
            } else { _0xidx = (e.key === _0x992[0] ? 1 : 0); }
        });

        document.querySelectorAll('.kd-unlock-char').forEach(_0xce => {
            _0xce.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                _0xce.classList.add('active-tap');
                setTimeout(() => _0xce.classList.remove('active-tap'), 200);
                clearTimeout(_0xtmr); _0xtmr = setTimeout(() => { _0xtidx = 0; }, 3000);
                if (_0xce.getAttribute('data-char') === _0x1f2(_0x3d2[_0xtidx], 0)) {
                    _0xtidx++; if (_0xtidx === _0x3d2.length) { _0xsec(); _0xtidx = 0; }
                } else { _0xtidx = (_0xce.getAttribute('data-char') === _0x1f2(_0x3d2[0], 0) ? 1 : 0); }
            });
        });
    })();
    // --- Security Module End ---

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
