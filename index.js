import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk'; 
import { google } from 'googleapis'; 

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. 聯動雲端資料庫
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ 資料庫連線成功！'))
  .catch(err => console.error('❌ 資料庫連線失敗：', err));

const Customer = mongoose.model('Customer', new mongoose.Schema({ lineUserId: String, lineName: String, realName: String, phone: String, birthday: String, allergy: String, serviceItem: String, durationHours: Number, bookingTime: String, createdAt: { type: Date, default: Date.now } }));
const LineUser = mongoose.model('LineUser', new mongoose.Schema({ lineUserId: { type: String, unique: true }, lineName: String, updatedAt: { type: Date, default: Date.now } }));

// 2. LINE 與 Google 設定
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), scopes: ['https://www.googleapis.com/auth/calendar'] });
const calendar = google.calendar({ version: 'v3', auth });

// 3. 搜尋 API
app.get('/api/search-user', async (req, res) => {
  const users = await LineUser.find({ lineName: { $regex: req.query.q, $options: 'i' } }).limit(15);
  res.json(users);
});

// 4. 精品黑金後台介面
app.get('/admin', async (req, res) => {
  const top6Users = await LineUser.find().sort({ updatedAt: -1 }).limit(6);
  let optionsHtml = top6Users.map(u => `<option value="${u.lineUserId}">⏱️ ${u.lineName}</option>`).join('');
  res.send(`
    <!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js"></script>
    <style>
        body { font-family: 'Noto Sans TC', sans-serif; background: #0f0f0f; color: #fff; padding: 40px; display: flex; justify-content: center; }
        .container { width: 100%; max-width: 450px; background: #1c1c1c; padding: 40px; border-radius: 20px; border: 1px solid #dfba73; }
        h1 { color: #dfba73; text-align: center; letter-spacing: 3px; }
        input, select { width: 100%; padding: 12px; margin: 10px 0; background: #2a2a2a; border: 1px solid #444; color: white; border-radius: 8px; }
        button { width: 100%; padding: 15px; margin-top: 20px; background: #dfba73; border: none; font-weight: 600; border-radius: 8px; cursor: pointer; }
    </style></head><body>
    <div class="container"><h1>SOARICH.STUDIO</h1>
    <form action="/admin/add-customer" method="POST">
        <select name="lineUserId" id="s">${optionsHtml}</select>
        <input type="text" name="realName" placeholder="真實姓名" required>
        <input type="tel" name="phone" placeholder="電話" required>
        <input type="date" name="birthday" required>
        <select name="serviceItem"><option value="霧眉">霧眉</option><option value="美睫">美睫</option></select>
        <input type="number" step="0.5" name="durationHours" placeholder="時長(小時)" required>
        <input type="datetime-local" name="bookingTime" required>
        <button type="submit">發送精品確認卡</button>
    </form></div><script>new Choices('#s');</script></body></html>`);
});

// 5. 核心邏輯
app.post('/admin/add-customer', async (req, res) => {
  const { lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime } = req.body;
  await new Customer({ lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime }).save();
  await calendar.events.insert({ calendarId: 'soarich8588@gmail.com', requestBody: { summary: `🌸 ${realName} - ${serviceItem}`, start: { dateTime: new Date(bookingTime).toISOString(), timeZone: 'Asia/Taipei' }, end: { dateTime: new Date(new Date(bookingTime).getTime() + Number(durationHours) * 3600000).toISOString(), timeZone: 'Asia/Taipei' } } });
  res.send(`<script>alert("同步成功！");window.location.href="/admin";</script>`);
});

app.post('/webhook', (req, res) => {
  res.status(200).send('OK');
  if (req.body.events) req.body.events.forEach(async e => { if (e.source.userId) await LineUser.findOneAndUpdate({ lineUserId: e.source.userId }, { updatedAt: new Date() }, { upsert: true }); });
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🚀 系統服役中...'));
