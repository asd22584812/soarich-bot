import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk'; 
import { google } from 'googleapis'; 

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==========================================
// 1. 聯動資料庫 (雲端安全版)
// ==========================================
// 將連線字串改為從環境變數讀取，保護你的資料庫隱私
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ 大店複合式資料庫連線成功！'))
  .catch(err => console.error('❌ 資料庫連線失敗：', err));

const customerSchema = new mongoose.Schema({
  lineUserId: String, lineName: String, realName: String, phone: String, birthday: String, allergy: String, serviceItem: String, durationHours: Number, bookingTime: String, depositPaid: { type: Number, default: 500 }, createdAt: { type: Date, default: Date.now }
});
const Customer = mongoose.model('Customer', customerSchema);
const lineUserSchema = new mongoose.Schema({
  lineUserId: { type: String, unique: true }, lineName: String, updatedAt: { type: Date, default: Date.now }
});
const LineUser = mongoose.model('LineUser', lineUserSchema);

// ==========================================
// 2. LINE Bot 設定 (環境變數保護)
// ==========================================
const client = new line.messagingApi.MessagingApiClient({ 
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN 
});

// ==========================================
// 3. Google 行事曆授權 (安全處理)
// ==========================================
// 從環境變數解析 JSON，不再依賴實體檔案，適應雲端部署
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), 
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

// ==========================================
// 4. API 路由與 5. 管理後台 (視覺風格完全保留)
// ==========================================
app.get('/api/search-user', async (req, res) => {
  try {
    const keyword = req.query.q;
    if (!keyword) return res.json([]);
    const users = await LineUser.find({ lineName: { $regex: keyword, $options: 'i' } }).limit(15);
    res.json(users);
  } catch (err) { res.status(500).json({ error: "搜尋出錯" }); }
});

app.get('/admin', async (req, res) => {
  try {
    const top6Users = await LineUser.find().sort({ updatedAt: -1 }).limit(6);
    let optionsHtml = top6Users.map(u => `<option value="${u.lineUserId}">⏱️ 最新互動：${u.lineName}</option>`).join('');
    
    // 這裡維持你原本的流金風格 HTML 結構，確保 res.send 完美輸出網頁
    res.send(`<!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SOARICH.STUDIO | 奢華智慧管理系統</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Noto+Sans+TC:wght@300;400;500&display=swap');
            body { font-family: 'Noto Sans TC', sans-serif; background-image: url('https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1500&auto=format&fit=crop'); background-size: cover; background-attachment: fixed; background-position: center; padding: 60px 20px; color: #2c2c2c; }
            .container { max-width: 540px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); padding: 50px; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.1); margin: 0 auto; border: 2px solid #dfba73; }
            h1 { font-family: 'Cinzel', serif; font-weight: 600; font-size: 34px; text-align: center; background: linear-gradient(135deg, #bf953f 0%, #b38728 50%, #aa771c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            label { font-weight: 500; display: block; margin-top: 24px; color: #44321a; font-size: 14px; }
            input, select, textarea { width: 100%; padding: 14px; margin-top: 8px; border: 1px solid #dcd1bd; border-radius: 12px; background-color: rgba(255,255,255,0.7); }
            .deposit-box { background: linear-gradient(135deg, #f9f6f0 0%, #f3ede0 100%); color: #8a6d3b; padding: 14px; border-radius: 12px; margin-top: 30px; border: 1px solid #dfba73; text-align: center; }
            button { width: 100%; padding: 18px; background: linear-gradient(135deg, #bf953f 0%, #b38728 50%, #aa771c 100%); border: none; color: #fff; font-weight: 600; border-radius: 12px; margin-top: 30px; cursor: pointer; letter-spacing: 3px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>SOARICH.STUDIO</h1>
            <form action="/admin/add-customer" method="POST">
                <label>連動 LINE 顧客帳號</label>
                <select name="lineUserId" id="searchable-select" required><option value="">請搜尋舊客...</option>${optionsHtml}</select>
                <label>客人真實姓名</label><input type="text" name="realName" required>
                <label>行動電話</label><input type="tel" name="phone" required>
                <label>出生年月日</label><input type="date" name="birthday" required>
                <label>施作項目</label>
                <select name="serviceItem"><option value="日式美睫">日式美睫</option><option value="霧眉">霧眉</option><option value="霧唇">霧唇</option></select>
                <label>預估施作時長(小時)</label><input type="number" step="0.5" name="durationHours" required>
                <label>顧客備註</label><textarea name="allergy" rows="3"></textarea>
                <label>預約日期與時間</label><input type="datetime-local" name="bookingTime" required>
                <div class="deposit-box">✨ 已確認入帳預約訂金 $500 TWD</div>
                <button type="submit">發送精品預約確認卡</button>
            </form>
        </div>
        <script>
            const choices = new Choices('#searchable-select', { searchEnabled: true });
            document.getElementById('searchable-select').addEventListener('search', async (e) => {
                const res = await fetch('/api/search-user?q=' + encodeURIComponent(e.detail.value));
                const users = await res.json();
                choices.setChoices(users.map(u => ({value: u.lineUserId, label: '✨ 舊客：' + u.lineName})), 'value', 'label', true);
            });
        </script>
    </body>
    </html>`);
  } catch (err) { res.status(500).send("後台錯誤"); }
});

// 6. POST 邏輯與 7. Webhook (保持不變)
app.post('/admin/add-customer', async (req, res) => { /* 你的完整 POST 邏輯 */ });
app.post('/webhook', (req, res) => { /* 你的 Webhook 邏輯 */ });
async function handleEvent(event) { /* 你的 handleEvent 邏輯 */ }

// 關鍵修改：使用 Render 提供的動態 Port 並綁定 0.0.0.0
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 系統已於 Port ${PORT} 啟動，完美服役中...`));
