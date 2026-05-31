import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk'; 
import { google } from 'googleapis'; 

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==========================================
// 1. 聯動資料庫 (自動判斷雲端還是本機)
// ==========================================
const dbURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mySalonDB";
mongoose.connect(dbURI)
  .then(() => console.log('✅ 資料庫連線成功！'))
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
// 2. LINE Bot 設定 (改用環境變數)
// ==========================================
const client = new line.messagingApi.MessagingApiClient({ 
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN 
});

// ==========================================
// 3. Google 行事曆授權 (安全處理)
// ==========================================
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), 
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

// ==========================================
// 4~7. 其餘 API 與邏輯 (省略...與你之前的完全一樣)
// ==========================================
// (請將原本你那份代碼第 45 行以後的部分，直接貼在這裡)

app.listen(process.env.PORT || 3000, () => { console.log('🚀 系統已準備就緒！'); });