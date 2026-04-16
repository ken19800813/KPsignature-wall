document.addEventListener('DOMContentLoaded', async () => {
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
        wallContainer.innerHTML = '<div class="kd-wall-loading"><p>正在從雲端載入墨寶牆...</p></div>';
        
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
            wallContainer.innerHTML = '<p class="kd-empty-state">目前尚無雲端墨寶，期待您成為第一位！</p>';
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
            const date = new Date(sig.created_at).toLocaleString();
            const card = document.createElement('div');
            card.className = 'kd-sig-card-small kd-sig-card';
            card.innerHTML = `
                <img src="${sig.image_url}" class="kd-sig-img" alt="Signature">
                <div class="kd-sig-meta">${date}</div>
                <div class="kd-sig-admin-tools">
                   <button class="kd-print-sig" title="列印"><span class="material-icons">print</span></button>
                   <button class="kd-delete-sig" title="刪除"><span class="material-icons">close</span></button>
                </div>
            `;
            card.querySelector('.kd-print-sig').addEventListener('click', () => printSignature(sig.image_url));
            card.querySelector('.kd-delete-sig').addEventListener('click', () => deleteSignature(sig.id, sig.image_url));
            wallContainer.appendChild(card);
        });
    }

    function printSignature(src) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><img src="${src}" style="max-width:90%;max-height:90%;"></body><script>window.onload=function(){window.print();window.close();};</script></html>`);
        printWindow.document.close();
    }

    async function deleteSignature(id, imageUrl) {
        if (!confirm('確定要永久刪除此墨寶嗎？\n(這將同步移除雲端圖檔)')) return;
        
        try {
            // 1. Delete from DB
            const { error: dbError } = await _supabase
                .from('signatures')
                .delete()
                .eq('id', id);

            if (dbError) throw dbError;

            // 2. Delete from Storage (Extract filename from URL)
            const fileName = imageUrl.split('/').pop();
            const { error: storageError } = await _supabase.storage
                .from('signatures')
                .remove([fileName]);

            // Note: storageError might fail if policy isn't set, but we continue.
            fetchSignatures();
        } catch (err) {
            console.error('Delete failed:', err);
            alert('刪除失敗，請檢查權限設定：' + err.message);
        }
    }

    updateZoom(); 
    fetchSignatures();
});
