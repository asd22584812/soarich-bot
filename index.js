import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk';
import { google } from 'googleapis';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. 資料庫連線 (使用環境變數)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ 資料庫連線成功'))
  .catch(err => console.error('❌ 資料庫連線失敗', err));

const Customer = mongoose.model('Customer', new mongoose.Schema({ lineUserId: String, lineName: String, realName: String, phone: String, birthday: String, allergy: String, serviceItem: String, durationHours: Number, bookingTime: String, createdAt: { type: Date, default: Date.now } }));
const LineUser = mongoose.model('LineUser', new mongoose.Schema({ lineUserId: { type: String, unique: true }, lineName: String, updatedAt: { type: Date, default: Date.now } }));

// 2. LINE 與 Google 設定
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), scopes: ['https://www.googleapis.com/auth/calendar'] });
const calendar = google.calendar({ version: 'v3', auth });

// 3. API 路由
app.get('/api/search-user', async (req, res) => {
  const users = await LineUser.find({ lineName: { $regex: req.query.q || "", $options: 'i' } }).limit(15);
  res.json(users);
});

// 4. 【SOARICH.STUDIO】後台管理介面 (還原流金視覺風格)
app.get('/admin', async (req, res) => {
  try {
    const top6Users = await LineUser.find().sort({ updatedAt: -1 }).limit(6);
    let optionsHtml = top6Users.map(u => `<option value="${u.lineUserId}">⏱️ 最新互動：${u.lineName || 'LINE 貴賓'}</option>`).join('');
    
    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
    <html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SOARICH.STUDIO | 奢華智慧管理系統</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Noto+Sans+TC:wght@300;400;500&display=swap');
        body { font-family: 'Noto Sans TC', sans-serif; background-image: url('https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1500&auto=format&fit=crop'); background-size: cover; background-attachment: fixed; background-position: center; padding: 60px 20px; color: #2c2c2c; }
        .container { max-width: 540px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); padding: 50px; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.1); margin: 0 auto; border: 2px solid #dfba73; }
        h1 { font-family: 'Cinzel', serif; font-weight: 600; font-size: 34px; text-align: center; background: linear-gradient(135deg, #bf953f 0%, #b38728 50%, #aa771c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        label { font-weight: 500; display: block; margin-top: 24px; color: #44321a; font-size: 14px; }
        input, select, textarea { width: 100%; padding: 14px; margin-top: 8px; border: 1px solid #dcd1bd; border-radius: 12px; background: rgba(255,255,255,0.7); }
        .deposit-box { background: linear-gradient(135deg, #f9f6f0 0%, #f3ede0 100%); color: #8a6d3b; padding: 14px; border-radius: 12px; margin-top: 30px; border: 1px solid #dfba73; text-align: center; font-weight: 500; }
        button { width: 100%; padding: 18px; background: linear-gradient(135deg, #bf953f 0%, #b38728 50%, #aa771c 100%); border: none; color: #fff; font-weight: 600; border-radius: 12px; margin-top: 30px; cursor: pointer; letter-spacing: 3px; }
        .choices__inner { background: rgba(255,255,255,0.7) !important; border: 1px solid #dcd1bd !important; border-radius: 12px !important; }
    </style></head><body>
    <div class="container"><h1>SOARICH.STUDIO</h1>
    <form action="/admin/add-customer" method="POST">
        <label>連動 LINE 顧客帳號</label><select name="lineUserId" id="s" required><option value="">請搜尋舊客...</option>${optionsHtml}</select>
        <label>真實姓名</label><input type="text" name="realName" required>
        <label>行動電話</label><input type="tel" name="phone" required>
        <label>出生年月日</label><input type="date" name="birthday" required>
        <label>施作項目</label><select name="serviceItem"><option value="日式美睫">日式美睫</option><option value="霧眉">霧眉</option></select>
        <label>預估時長(小時)</label><input type="number" step="0.5" name="durationHours" required>
        <label>預約時間</label><input type="datetime-local" name="bookingTime" required>
        <div class="deposit-box">✨ 已確認入帳預約訂金 $500 TWD</div>
        <button type="submit">發送精品預約確認卡</button>
    </form></div><script>new Choices('#s');</script></body></html>`);
  } catch (err) { res.status(500).send("系統錯誤"); }
});

// 5. 預約與 Webhook 邏輯 (保持同步狀態)
app.post('/admin/add-customer', async (req, res) => {
  try {
    const { lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime } = req.body;
    await new Customer({ lineUserId, realName, realName, phone, birthday, serviceItem, durationHours, bookingTime }).save();
    await calendar.events.insert({ calendarId: 'soarich8588@gmail.com', requestBody: { summary: `🌸 ${realName} - ${serviceItem}`, start: { dateTime: new Date(bookingTime).toISOString() }, end: { dateTime: new Date(new Date(bookingTime).getTime() + Number(durationHours)*3600000).toISOString() } } });
    res.send(`<script>alert("系統同步成功！");window.location.href="/admin";</script>`);
  } catch (err) { res.status(500).send("預約失敗"); }
});

app.post('/webhook', (req, res) => {
  res.status(200).send('OK');
  if (req.body.events) req.body.events.forEach(async e => {
      if (e.source.userId) {
          try {
              const p = await client.getProfile(e.source.userId);
              await LineUser.findOneAndUpdate({ lineUserId: e.source.userId }, { lineName: p.displayName, updatedAt: new Date() }, { upsert: true });
          } catch (ex) { await LineUser.findOneAndUpdate({ lineUserId: e.source.userId }, { lineName: 'LINE 貴賓', updatedAt: new Date() }, { upsert: true }); }
      }
  });
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🚀 系統服役中'));
