/**
 * 自動整理簽名牆間距腳本 (Node.js 版)
 * 用途：消除簽名牆上的大空白間隙，重新排列所有簽名。
 * 建議設定：每小時執行一次 (Cron Job)
 */

const { createClient } = require('@supabase/supabase-js');

// 優先從環境變數讀取，若無則使用預設值
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://khfdeygyhjvmvljztiwg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZmRleWd5aGp2bXZsanp0Iwg.r8_...'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function tidySignatures() {
    console.log('開始執行簽名牆整理排程...');
    
    try {
        // 1. 抓取所有簽名並依時間排序
        const { data: signatures, error } = await supabase
            .from('signatures')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!signatures || signatures.length === 0) {
            console.log('目前牆上沒有簽名，無需整理。');
            return;
        }

        console.log(`偵測到 ${signatures.length} 個簽名，計算新座標中...`);

        // 2. 定義排列邏輯 (與 signature_wall.js 一致)
        const CELL_W = 400;
        const CELL_H = 320;
        const cols = 5; // 每排 5 個
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

        // 3. 執行批次更新
        console.log('正在更新資料庫...');
        const BATCH_SIZE = 20;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(upd => 
                supabase.from('signatures').update({
                    pos_x: upd.pos_x,
                    pos_y: upd.pos_y,
                    rotation: upd.rotation
                }).eq('id', upd.id)
            ));
            console.log(`進度: ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length}`);
        }

        console.log('✨ 簽名牆整理完成！');

    } catch (err) {
        console.error('❌ 整理過程中發生錯誤:', err.message);
    }
}

tidySignatures();
