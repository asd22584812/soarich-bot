import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk'; 
import { google } from 'googleapis'; 

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. 資料庫連線
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

// 2. LINE 與 Google 設定
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), 
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

// 3. API 路由
app.get('/api/search-user', async (req, res) => {
  try {
    const keyword = req.query.q;
    if (!keyword) return res.json([]);
    const users = await LineUser.find({ lineName: { $regex: keyword, $options: 'i' } }).limit(15);
    res.json(users);
  } catch (err) { res.status(500).json({ error: "搜尋出錯" }); }
});

// ==========================================================
// 4. 管理後台 (請確保這段 HTML 代碼在你的 index.js 裡是解開的)
// ==========================================================
app.get('/admin', async (req, res) => {
  try {
    const top6Users = await LineUser.find().sort({ updatedAt: -1 }).limit(6);
    let optionsHtml = top6Users.map(u => `<option value="${u.lineUserId}">⏱️ 最新互動：${u.lineName}</option>`).join('');
    
    // 這裡放入你那整段 HTML 字符串，確保沒有被註解掉
    res.send(`<!DOCTYPE html>...[你原本那一大段 HTML]...`); 
  } catch (err) { res.status(500).send("後台載入出錯"); }
});

// 5. POST 預約邏輯
app.post('/admin/add-customer', async (req, res) => {
  // 這裡填入你完整的 POST 邏輯，不要包在註解裡
});

// 6. Webhook
app.post('/webhook', (req, res) => {
  res.json({ status: 'ok' });
  if (req.body && req.body.events) req.body.events.map(handleEvent);
});

async function handleEvent(event) {
  // 這裡填入你的 handleEvent 邏輯
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 啟動成功，Port ${PORT}`));
