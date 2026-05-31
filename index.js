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
  .catch(err => console.error('❌ 本機連線失敗：', err));

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

// 4. 【SOARICH.STUDIO】後台管理介面 (還原完整版視覺與選單)
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
        body { font-family: 'Noto Sans TC', sans-serif; background-image: url('https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1500&auto=format&fit=crop'); padding: 60px 20px; color: #2c2c2c; }
        .container { max-width: 540px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); padding: 50px; border-radius: 24px; border: 2px solid #dfba73; margin: 0 auto; }
        h1 { font-family: 'Cinzel', serif; color: #aa771c; text-align: center; letter-spacing: 4px; }
        input, select, textarea { width: 100%; padding: 14px; margin-top: 8px; border: 1px solid #dcd1bd; border-radius: 12px; background: rgba(255,255,255,0.7); }
        .deposit-box { background: #f3ede0; color: #8a6d3b; padding: 14px; border-radius: 12px; border: 1px solid #dfba73; text-align: center; margin-top: 20px; }
        button { width: 100%; padding: 18px; background: linear-gradient(135deg, #bf953f 0%, #b38728 50%, #aa771c 100%); border: none; color: #fff; font-weight: 600; border-radius: 12px; margin-top: 30px; cursor: pointer; }
    </style></head><body>
    <div class="container"><h1>SOARICH.STUDIO</h1>
    <form action="/admin/add-customer" method="POST">
        <label>連動 LINE 顧客帳號</label><select name="lineUserId" id="s" required><option value="">請搜尋舊客...</option>${optionsHtml}</select>
        <label>真實姓名</label><input type="text" name="realName" required>
        <label>電話</label><input type="tel" name="phone" required>
        <label>生日</label><input type="date" name="birthday" required>
        <label>施作項目</label>
        <select name="serviceItem"><option value="日式美睫">日式美睫</option><option value="睫毛管理">睫毛管理</option><option value="霧眉">霧眉</option><option value="飄眉">飄眉</option><option value="無創淡色">無創淡色</option><option value="霧唇">霧唇</option></select>
        <label>預估時長(小時)</label>
        <select name="durationHours"><option value="0.5">0.5</option><option value="1">1</option><option value="1.5">1.5</option><option value="2">2</option><option value="2.5">2.5</option><option value="3">3</option></select>
        <label>顧客備註</label><textarea name="allergy" rows="3"></textarea>
        <label>預約時間</label><input type="datetime-local" name="bookingTime" required>
        <div class="deposit-box">✨ 已確認預約訂金 $500 TWD</div>
        <button type="submit">發送精品預約確認卡</button>
    </form></div><script>new Choices('#s');</script></body></html>`);
  } catch (err) { res.status(500).send("錯誤"); }
});

// 5. POST 預約邏輯 (加入精品卡片發送)
app.post('/admin/add-customer', async (req, res) => {
  try {
    const { lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime, allergy } = req.body;
    await new Customer({ lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime, allergy }).save();
    await calendar.events.insert({ calendarId: 'soarich8588@gmail.com', requestBody: { summary: `🌸 SOARICH | ${realName} - ${serviceItem}`, description: `電話: ${phone}\n備註: ${allergy}`, start: { dateTime: new Date(bookingTime).toISOString() }, end: { dateTime: new Date(new Date(bookingTime).getTime() + Number(durationHours)*3600000).toISOString() } } });
    await client.pushMessage({ to: lineUserId, messages: [{ type: 'text', text: `✨ 預約成功！\n名稱：${realName}\n項目：${serviceItem}\n時間：${bookingTime}` }] });
    res.send(`<script>alert("系統同步成功！");window.location.href="/admin";</script>`);
  } catch (err) { res.status(500).send("預約失敗"); }
});

// 6. Webhook
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 系統服役中，Port ${PORT}`));
