import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk'; 
import { google } from 'googleapis'; 

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==========================================
// 1. 聯動資料庫 (雲端環境優化)
// ==========================================
// 關鍵修改：使用 process.env.MONGODB_URI，確保伺服器從環境變數讀取安全連結
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
// 3. Google 行事曆授權 (JSON 轉物件處理)
// ==========================================
// 關鍵修改：從環境變數讀取 JSON 字串並解析，無需存放實體檔案在雲端
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), 
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

// ==========================================
// 4~7. 其餘功能 (保持你原本的流金風格與邏輯)
// ==========================================
app.get('/api/search-user', async (req, res) => {
  try {
    const keyword = req.query.q;
    if (!keyword) return res.json([]);
    const users = await LineUser.find({ lineName: { $regex: keyword, $options: 'i' } }).limit(15);
    res.json(users);
  } catch (err) { res.status(500).json({ error: "搜尋出錯" }); }
});

// [這裡放入你原本那一大段 app.get('/admin', ...) 的流金大理石 HTML 代碼]
// (為了排版，我這裡省略，請確保你原本那段完整的代碼貼在這裡)

app.post('/admin/add-customer', async (req, res) => { /* 你原本的 POST 邏輯 */ });

app.post('/webhook', (req, res) => {
  res.json({ status: 'ok' });
  if (req.body && req.body.events) req.body.events.map(handleEvent);
});

async function handleEvent(event) { /* 你原本的處理邏輯 */ }

// 關鍵修改：使用 Render 提供的動態 PORT，並綁定 0.0.0.0
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => { 
  console.log(`🚀 系統已於 Port ${PORT} 啟動，完美服役中...`); 
});
