document.addEventListener('DOMContentLoaded', async () => {
    localStorage.clear();
    
    const wallContainer = document.getElementById('signature-wall');
    const wallViewport = document.getElementById('wall-viewport');
    const wallScaleWrapper = document.getElementById('wall-scale-wrapper');
    const wallContent = document.getElementById('wall-content');
    const zoomSlider = document.getElementById('zoom-slider');
    const searchNameInput = document.getElementById('search-name');
    const searchNoInput = document.getElementById('search-no');
    const searchBtn = document.getElementById('btn-search');
    const btnToggleView = document.getElementById('btn-toggle-view');
    const btnAutoplayScroll = document.getElementById('btn-autoplay-scroll');
    const btnAutoplayCarousel = document.getElementById('btn-autoplay-carousel');
    const btnSortOrder = document.getElementById('btn-sort-order');
    const wallTitle = document.getElementById('wall-title');
    
    let allSignaturesData = [];
    let isFreeMode = true;
    let wallScale = 0.5; 
    let sortOrder = 'desc'; // 'desc' (newest first) or 'asc' (oldest first)
    let currentMinWidth = 300;
    let currentUnscaledWidth = 3000;
    let currentUnscaledHeight = 3000;
    
    const CELL_W = 400;
    const CELL_H = 320;

    // --- View Tracking ---
    async function trackVisit() {
        try { await _supabase.from('page_views').insert([{ page: 'wall' }]); } catch (e) {}
    }
    trackVisit();

    async function getVisitCount() {
        try {
            const { count, error } = await _supabase.from('page_views').select('*', { count: 'exact', head: true });
            return error ? '---' : count;
        } catch (e) { return '---'; }
    }

    // --- Security Module ---
    (function() {
        const _0xsec = async () => {
            document.body.classList.add('admin-mode-active');
            const viewCount = await getVisitCount();
            const _0xnot = document.createElement('div');
            _0xnot.className = 'kd-notification';
            _0xnot.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;"><span class="material-icons" style="font-size:18px;">lock_open</span><span>管理權限已解除</span></div>
                <div style="font-size:12px;opacity:0.8;font-weight:normal;letter-spacing:1px;border-top:1px solid rgba(255,255,255,0.2);padding-top:4px;margin-top:2px;">📊 累計網頁瀏覽人次：${viewCount}</div>
                <button id="btn-admin-tidy" style="margin-top:8px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:white;padding:4px 12px;border-radius:20px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;width:100%;justify-content:center;transition:all 0.3s;">
                    <span class="material-icons" style="font-size:14px;">auto_fix_high</span>立即整理簽名間距
                </button>
            `;
            document.body.appendChild(_0xnot);
            
            const tidyBtn = _0xnot.querySelector('#btn-admin-tidy');
            tidyBtn.addEventListener('mouseenter', () => tidyBtn.style.background = 'rgba(255,255,255,0.4)');
            tidyBtn.addEventListener('mouseleave', () => tidyBtn.style.background = 'rgba(255,255,255,0.2)');
            tidyBtn.addEventListener('click', () => {
                if (confirm('確定要重新排列所有簽名嗎？這將消除空白間隙。')) {
                    tidySignatures();
                }
            });

            setTimeout(() => {
                _0xnot.style.opacity = '0';
                _0xnot.style.transition = 'opacity 0.5s ease';
                setTimeout(() => _0xnot.remove(), 500);
            }, 4000);
        };

        const tidySignatures = async () => {
            const notif = document.createElement('div');
            notif.className = 'kd-notification';
            notif.innerHTML = '正在整理簽名牆，請稍候...';
            document.body.appendChild(notif);

            try {
                const { data: signatures, error } = await _supabase.from('signatures').select('*').order('created_at', { ascending: false });
                if (error) throw error;

                const CELL_W = 400;
                const CELL_H = 320;
                const viewportW = (wallViewport.clientWidth || window.innerWidth) / wallScale;
                const cols = Math.max(3, Math.floor((viewportW - 100) / CELL_W));
                const startY = 1280;
                const startX = 100;

                const updates = signatures.map((sig, index) => {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    const jitterX = (Math.sin(index * 12.3) * 60);
                    const jitterY = (Math.cos(index * 45.6) * 40);
                    const rotation = (Math.sin(index * 88.8) * 15);
                    
                    return {
                        id: sig.id,
                        pos_x: startX + (col * CELL_W) + jitterX,
                        pos_y: startY + (row * CELL_H) + jitterY,
                        rotation: rotation
                    };
                });

                // Batch updates (Supabase doesn't support batch update by ID in one call easily without RPC)
                // We'll do them in parallel with a limit to avoid rate limits
                const BATCH_SIZE = 10;
                for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                    const batch = updates.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(upd => 
                        _supabase.from('signatures').update({
                            pos_x: upd.pos_x,
                            pos_y: upd.pos_y,
                            rotation: upd.rotation
                        }).eq('id', upd.id)
                    ));
                }

                notif.innerHTML = '✨ 簽名牆已整理完畢！';
                setTimeout(() => {
                    notif.remove();
                    window.location.reload();
                }, 2000);

            } catch (err) {
                console.error('Tidy failed:', err);
                notif.innerHTML = '❌ 整理失敗: ' + err.message;
                setTimeout(() => notif.remove(), 3000);
            }
        };
        const _0x992 = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
        let _0xidx = 0;
        window.addEventListener('keydown', (e) => {
            if (e.key === _0x992[_0xidx]) {
                _0xidx++; if (_0xidx === _0x992.length) { _0xsec(); _0xidx = 0; }
            } else { _0xidx = 0; }
        });
        document.querySelectorAll('.kd-unlock-char').forEach(_0xce => {
            _0xce.addEventListener('pointerdown', (e) => {
                _0xce.classList.add('active-tap');
                setTimeout(() => _0xce.classList.remove('active-tap'), 200);
            });
        });
    })();

    // --- Wall View Engine ---
    function updateWallTransform() {
        if (!isFreeMode) return;
        const topBuf = window.currentTopBuffer || 0;
        wallContent.style.transform = `scale(${wallScale}) translate(0px, -${topBuf}px)`;
        if (wallScaleWrapper) {
            wallScaleWrapper.style.width = `${currentUnscaledWidth * wallScale}px`;
            wallScaleWrapper.style.height = `${currentUnscaledHeight * wallScale}px`;
        }
    }

    zoomSlider.addEventListener('input', (e) => {
        if (isFreeMode) {
            wallScale = e.target.value / 100;
            updateWallTransform();
            // Re-render wall only when scale changes significantly to avoid lag
            // But for now, just let updateWallTransform handle the scale.
        } else {
            currentMinWidth = e.target.value;
            document.documentElement.style.setProperty('--kd-wall-min-width', currentMinWidth + 'px');
        }
    });

    // --- Autoplay Features ---
    let scrollAnimFrame = null;
    let isAutoScrolling = false;
    let scrollDirection = 1; 

    function autoScrollStep() {
        if (!isAutoScrolling) return;
        
        const isWindowScroll = (wallViewport.scrollHeight <= wallViewport.clientHeight);
        const scrollElement = isWindowScroll ? document.documentElement : wallViewport;
        
        // Prevent maxScroll from being negative
        let maxScroll = scrollElement.scrollHeight - (isWindowScroll ? window.innerHeight : wallViewport.clientHeight);
        if (maxScroll < 0) maxScroll = 0;
        
        if (isWindowScroll) {
            window.scrollBy(0, scrollDirection * 2);
        } else {
            wallViewport.scrollTop += scrollDirection * 2;
        }
        
        const currentScroll = isWindowScroll ? window.scrollY : wallViewport.scrollTop;
        
        if (scrollDirection === 1 && currentScroll >= maxScroll - 2) {
            scrollDirection = -1;
        } else if (scrollDirection === -1 && currentScroll <= 0) {
            scrollDirection = 1;
        }
        
        scrollAnimFrame = requestAnimationFrame(autoScrollStep);
    }

    btnAutoplayScroll.addEventListener('click', () => {
        if (isCarouselRunning) btnAutoplayCarousel.click();

        isAutoScrolling = !isAutoScrolling;
        if (isAutoScrolling) {
            btnAutoplayScroll.innerHTML = '<span class="material-icons">pause</span>停止滑動';
            btnAutoplayScroll.classList.add('active');
            scrollDirection = 1;
            scrollAnimFrame = requestAnimationFrame(autoScrollStep);
        } else {
            btnAutoplayScroll.innerHTML = '<span class="material-icons">swap_vert</span>自動滑動';
            btnAutoplayScroll.classList.remove('active');
            cancelAnimationFrame(scrollAnimFrame);
        }
    });

    let carouselInterval = null;
    let isCarouselRunning = false;
    let currentCarouselIndex = 0;

    function nextCarouselSlide() {
        let cards = Array.from(document.querySelectorAll('.kd-sig-card-free'));
        if (cards.length === 0) return;

        // Sort by sequence number ascending (001, 002...)
        cards.sort((a, b) => {
            return parseInt(a.getAttribute('data-seq')) - parseInt(b.getAttribute('data-seq'));
        });

        cards.forEach(c => {
            c.classList.remove('kd-sig-highlight');
            c.style.animation = '';
        });

        if (currentCarouselIndex >= cards.length) {
            currentCarouselIndex = 0;
        }

        const foundCard = cards[currentCarouselIndex];
        // Grid mode enlarge
        currentMinWidth = Math.min(window.innerWidth - 80, 600);
        document.documentElement.style.setProperty('--kd-wall-min-width', currentMinWidth + 'px');
        zoomSlider.value = currentMinWidth;
        
        setTimeout(() => {
            foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        
        foundCard.classList.add('kd-sig-highlight');
        foundCard.style.animation = 'none';
        foundCard.offsetHeight; 
        foundCard.style.animation = 'kd-pulse-highlight 2s ease infinite';

        currentCarouselIndex++;
    }

    btnAutoplayCarousel.addEventListener('click', () => {
        if (isAutoScrolling) btnAutoplayScroll.click();

        isCarouselRunning = !isCarouselRunning;
        if (isCarouselRunning) {
            // Force Grid Mode for Carousel
            if (isFreeMode) btnToggleView.click();

            btnAutoplayCarousel.innerHTML = '<span class="material-icons">pause</span>停止輪播';
            btnAutoplayCarousel.classList.add('active');
            currentCarouselIndex = 0;
            nextCarouselSlide();
            carouselInterval = setInterval(nextCarouselSlide, 3500); 
        } else {
            btnAutoplayCarousel.innerHTML = '<span class="material-icons">view_carousel</span>輪播模式';
            btnAutoplayCarousel.classList.remove('active');
            clearInterval(carouselInterval);
            const cards = Array.from(document.querySelectorAll('.kd-sig-card-free'));
            cards.forEach(c => {
                c.classList.remove('kd-sig-highlight');
                c.style.animation = '';
            });
            // Reset grid width
            currentMinWidth = 300;
            document.documentElement.style.setProperty('--kd-wall-min-width', '300px');
            zoomSlider.value = 300;
        }
    });

    // --- View Toggle Logic ---
    btnToggleView.addEventListener('click', () => {
        isFreeMode = !isFreeMode;
        document.body.classList.toggle('free-mode', isFreeMode);
        document.body.classList.toggle('grid-mode', !isFreeMode);
        
        if (isFreeMode) {
            wallTitle.textContent = '自由貼上的 挺阿北簽名牆';
            zoomSlider.min = 10; zoomSlider.max = 150; zoomSlider.value = wallScale * 100;
            updateWallTransform();
            renderWall(allSignaturesData);
        } else {
            wallTitle.textContent = '依序排列的 挺阿北簽名牆';
            zoomSlider.min = 150; zoomSlider.max = 600; zoomSlider.value = currentMinWidth;
            document.documentElement.style.setProperty('--kd-wall-min-width', currentMinWidth + 'px');
            renderWall(allSignaturesData);
        }
    });

    // --- SUPABASE FETCH ---
    async function fetchSignatures() {
        wallContainer.innerHTML = '<div class="kd-wall-loading"><p>正在佈置簽名牆...</p></div>';
        try {
            const { data, error } = await _supabase.from('signatures').select('*').order('created_at', { ascending: (sortOrder === 'asc') });
            if (error) throw error;
            allSignaturesData = data;
            renderWall(data);
        } catch (err) {
            console.error('Fetch failed:', err);
            renderWall([]);
        }
    }

    if (btnSortOrder) {
        btnSortOrder.addEventListener('click', () => {
            sortOrder = (sortOrder === 'desc' ? 'asc' : 'desc');
            btnSortOrder.innerHTML = `
                <span class="material-icons">sort</span>
                ${sortOrder === 'desc' ? '由新到舊' : '由舊到新'}
            `;
            fetchSignatures();
        });
    }

    function renderWall(signatures) {
        wallContainer.innerHTML = '';
        
        // Calculate dynamic columns for those without fixed positions
        const viewportW = (wallViewport.clientWidth || window.innerWidth) / wallScale;
        const dynamicCols = Math.max(3, Math.floor((viewportW - 100) / CELL_W));
        
        let maxRowY = 0;
        let minRowY = Infinity;

        if (!signatures || signatures.length === 0) {
            wallContainer.innerHTML = '<p class="kd-empty-state">目前牆上空空如也，快來簽名吧！</p>';
            window.currentTopBuffer = 0;
            currentUnscaledWidth = viewportW;
            currentUnscaledHeight = 1000;
            wallContent.style.width = `${currentUnscaledWidth}px`;
            wallContent.style.height = `${currentUnscaledHeight}px`;
            updateWallTransform();
            return;
        }

        const totalCount = signatures.length;
        const fragment = document.createDocumentFragment(); // Use fragment for performance

        signatures.forEach((sig, index) => {
            let seqNo;
            if (sortOrder === 'desc') {
                seqNo = totalCount - index;
            } else {
                seqNo = index + 1;
            }
            
            const date = new Date(sig.created_at).toLocaleString('zh-TW', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const displayName = sig.display_name || '嘉賓';
            
            let px, py, rot;
            // 關鍵修正：
            // 1. 如果在「排列模式」，絕對不使用資料庫座標，完全依照 index 排列。
            // 2. 如果在「自由模式」但使用者切換到了「由舊到新」，我們也強制重新排列，否則視覺上不會動。
            const shouldIgnoreDBPos = !isFreeMode || (sortOrder === 'asc'); 
            
            if (sig.pos_x !== null && sig.pos_y !== null && !shouldIgnoreDBPos) {
                px = sig.pos_x; py = sig.pos_y; rot = sig.rotation || 0;
            } else {
                // 自動計算位置：確保 index 0 永遠在最上面 (y=1280)
                const col = index % dynamicCols; 
                const row = Math.floor(index / dynamicCols);
                const jitterX = (Math.sin(index * 12.3) * 60); 
                const jitterY = (Math.cos(index * 45.6) * 40);
                rot = (Math.sin(index * 88.8) * 15);
                px = 100 + (col * CELL_W) + jitterX; 
                py = 1280 + (row * CELL_H) + jitterY;
            }
            maxRowY = Math.max(maxRowY, py);
            minRowY = Math.min(minRowY, py);

            const card = document.createElement('div');
            card.className = 'kd-sig-card-free';
            card.id = `sig-${sig.id}`;
            card.setAttribute('data-seq', seqNo);
            card.setAttribute('data-name', displayName.toLowerCase());
            
            if (isFreeMode) {
                card.style.left = `${px}px`; card.style.top = `${py}px`; card.style.rotate = `${rot}deg`;
            }
            
            const imageUrl = sig.image_url + (sig.image_url.includes('?') ? '&' : '?') + 't=' + new Date(sig.created_at).getTime();
            card.innerHTML = `
                <div class="kd-sig-number">#${seqNo}</div>
                <img src="${imageUrl}" class="kd-sig-img" alt="Signature" draggable="false">
                <div class="kd-sig-meta-v2">
                    <span class="kd-sig-name">${displayName}</span>
                    <span class="kd-sig-date">${date}</span>
                </div>
                <div class="kd-sig-admin-tools">
                   <button class="kd-print-sig" title="列印"><span class="material-icons">print</span></button>
                   <button class="kd-delete-sig" title="刪除"><span class="material-icons">close</span></button>
                </div>
            `;
            
            card.querySelector('.kd-print-sig').addEventListener('click', (e) => { e.stopPropagation(); printSignature(imageUrl); });
            card.querySelector('.kd-delete-sig').addEventListener('click', (e) => { e.stopPropagation(); deleteSignature(sig.id, sig.image_url); });
            fragment.appendChild(card);
        });

        wallContainer.appendChild(fragment);

        if (minRowY === Infinity) minRowY = 0;
        const topBuffer = Math.max(0, minRowY - 50); // Leave a small 50px visual padding
        window.currentTopBuffer = topBuffer;

        // Set dimensions for scroll
        currentUnscaledWidth = Math.max(viewportW, dynamicCols * CELL_W + 500);
        currentUnscaledHeight = maxRowY - topBuffer + 800;
        
        wallContent.style.width = `${currentUnscaledWidth}px`;
        wallContent.style.height = `${currentUnscaledHeight}px`; // We still keep it large to hold absolute positioned elements, but the wrapper truncates it visually because of translateY
        
        updateWallTransform(); // Apply current scale to wrapper

    }

    function printSignature(src) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><img src="${src}" style="max-width:90%;max-height:90%;"></body><script>window.onload=function(){window.print();window.close();};<\/script></html>`);
        printWindow.document.close();
    }

    async function deleteSignature(id, imageUrl) {
        if (!confirm('確定要永久刪除此簽名嗎？')) return;
        try {
            await _supabase.from('signatures').delete().eq('id', id);
            if (imageUrl && imageUrl.includes('supabase.co')) {
                const fileName = imageUrl.split('/').pop();
                await _supabase.storage.from('signatures').remove([fileName]);
            }
            fetchSignatures();
        } catch (err) { alert('刪除失敗'); }
    }

    function performSearch() {
        const nameQuery = searchNameInput.value.trim().toLowerCase();
        const noQuery = searchNoInput.value.trim().replace(/#/g, '').trim();
        
        const cards = Array.from(document.querySelectorAll('.kd-sig-card-free'));
        let foundCard = null;

        // Clear previous highlights
        cards.forEach(c => {
            c.classList.remove('kd-sig-highlight');
            c.style.animation = '';
        });

        if (noQuery) {
            // Numeric match (normalized)
            const targetSeq = parseInt(noQuery, 10);
            if (!isNaN(targetSeq)) {
                foundCard = cards.find(c => parseInt(c.getAttribute('data-seq'), 10) === targetSeq);
            }
        } else if (nameQuery) {
            // Name match (partial)
            foundCard = cards.find(c => c.getAttribute('data-name').includes(nameQuery));
        }

        if (foundCard) {
            const isWindowScroll = (wallViewport.scrollHeight <= wallViewport.clientHeight);

            if (isFreeMode) {
                // In Free Mode, we scroll the viewport or window to the card's scaled center
                const rect = foundCard.getBoundingClientRect();
                
                if (isWindowScroll) {
                    const scrollX = window.scrollX + rect.left - (window.innerWidth / 2) + (rect.width / 2);
                    const scrollY = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
                    window.scrollTo({
                        left: scrollX,
                        top: scrollY,
                        behavior: 'smooth'
                    });
                } else {
                    const viewRect = wallViewport.getBoundingClientRect();
                    const scrollX = wallViewport.scrollLeft + (rect.left - viewRect.left) - (viewRect.width / 2) + (rect.width / 2);
                    const scrollY = wallViewport.scrollTop + (rect.top - viewRect.top) - (viewRect.height / 2) + (rect.height / 2);
                    
                    wallViewport.scrollTo({
                        left: scrollX,
                        top: scrollY,
                        behavior: 'smooth'
                    });
                }
            } else {
                foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            foundCard.classList.add('kd-sig-highlight');
            
            // Pulse effect
            foundCard.style.animation = 'none';
            foundCard.offsetHeight; // trigger reflow
            foundCard.style.animation = 'kd-pulse-highlight 2s ease infinite';
        } else {
            alert('找不到符合條件的簽名。');
        }
    }

    searchBtn.addEventListener('click', performSearch);
    [searchNameInput, searchNoInput].forEach(input => { input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); }); });
    window.addEventListener('resize', () => renderWall(allSignaturesData));
    fetchSignatures();

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isAutoScrolling) btnAutoplayScroll.click();
            if (isCarouselRunning) btnAutoplayCarousel.click();
        }
    });
});
