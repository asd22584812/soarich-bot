import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk'; 
import { google } from 'googleapis'; 

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. 雲端資料庫連線
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ 大店複合式資料庫連線成功！'))
  .catch(err => console.error('❌ 資料庫連線失敗：', err));

const Customer = mongoose.model('Customer', new mongoose.Schema({ lineUserId: String, lineName: String, realName: String, phone: String, birthday: String, allergy: String, serviceItem: String, durationHours: Number, bookingTime: String, depositPaid: { type: Number, default: 500 }, createdAt: { type: Date, default: Date.now } }));
const LineUser = mongoose.model('LineUser', new mongoose.Schema({ lineUserId: { type: String, unique: true }, lineName: String, updatedAt: { type: Date, default: Date.now } }));

// 2. LINE Bot 設定
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });

// 3. Google 行事曆設定 (環境變數解析)
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), 
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

// 4. API 路由
app.get('/api/search-user', async (req, res) => {
  try {
    const users = await LineUser.find({ lineName: { $regex: req.query.q, $options: 'i' } }).limit(15);
    res.json(users);
  } catch (err) { res.status(500).json([]); }
});

// 5. 【SOARICH.STUDIO】後台管理介面 (視覺風格保留)
app.get('/admin', async (req, res) => {
  try {
    const top6Users = await LineUser.find().sort({ updatedAt: -1 }).limit(6);
    let optionsHtml = top6Users.map(u => `<option value="${u.lineUserId}">⏱️ 最新互動：${u.lineName}</option>`).join('');
    
    res.send(`<!DOCTYPE html>
    <html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOARICH.STUDIO | 奢華智慧管理系統</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Noto+Sans+TC:wght@300;400;500&display=swap');
        body { font-family: 'Noto Sans TC', sans-serif; background: #0f0f0f; padding: 40px 20px; color: #fff; }
        .container { max-width: 540px; background: #1c1c1c; padding: 50px; border-radius: 24px; border: 1px solid #dfba73; margin: 0 auto; }
        h1 { font-family: 'Cinzel', serif; color: #dfba73; text-align: center; letter-spacing: 4px; }
        input, select, textarea { width: 100%; padding: 14px; margin-top: 8px; border: 1px solid #444; border-radius: 12px; background: #2a2a2a; color: #fff; }
        .deposit-box { background: #2a2a2a; color: #dfba73; padding: 14px; border-radius: 12px; border: 1px solid #dfba73; text-align: center; margin-top: 20px; }
        button { width: 100%; padding: 18px; background: #dfba73; border: none; color: #000; font-weight: 600; border-radius: 12px; margin-top: 30px; cursor: pointer; }
    </style></head><body>
    <div class="container"><h1>SOARICH.STUDIO</h1>
    <form action="/admin/add-customer" method="POST">
        <label>連動 LINE 顧客帳號</label><select name="lineUserId" id="s" required><option value="">請搜尋舊客...</option>${optionsHtml}</select>
        <label>真實姓名</label><input type="text" name="realName" required>
        <label>電話</label><input type="tel" name="phone" required>
        <label>生日</label><input type="date" name="birthday" required>
        <label>施作項目</label><select name="serviceItem"><option value="日式美睫">日式美睫</option><option value="霧眉">霧眉</option></select>
        <label>時長(小時)</label><input type="number" step="0.5" name="durationHours" required>
        <label>預約時間</label><input type="datetime-local" name="bookingTime" required>
        <div class="deposit-box">✨ 已確認預約訂金 $500 TWD</div>
        <button type="submit">發送精品預約確認卡</button>
    </form></div><script>new Choices('#s');</script></body></html>`);
  } catch (err) { res.status(500).send("後台錯誤"); }
});

// 6. 預約邏輯
app.post('/admin/add-customer', async (req, res) => {
  const { lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime } = req.body;
  await new Customer({ lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime }).save();
  await calendar.events.insert({ calendarId: 'soarich8588@gmail.com', requestBody: { summary: `🌸 ${realName} - ${serviceItem}`, start: { dateTime: new Date(bookingTime).toISOString() }, end: { dateTime: new Date(new Date(bookingTime).getTime() + Number(durationHours)*3600000).toISOString() } } });
  res.send(`<script>alert("系統同步成功！");window.location.href="/admin";</script>`);
});

// 7. LINE Webhook
app.post('/webhook', (req, res) => {
  res.status(200).send('OK');
  if (req.body.events) req.body.events.forEach(async e => { if (e.source.userId) await LineUser.findOneAndUpdate({ lineUserId: e.source.userId }, { updatedAt: new Date() }, { upsert: true }); });
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🚀 系統服役中...'));
