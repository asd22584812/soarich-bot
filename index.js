import express from 'express';
import mongoose from 'mongoose';
import * as line from '@line/bot-sdk';
import { google } from 'googleapis';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const dbURI = process.env.MONGODB_URI;
mongoose.connect(dbURI).then(() => console.log('✅ 資料庫連線成功！')).catch(err => console.error(err));

const Customer = mongoose.model('Customer', new mongoose.Schema({ lineUserId: String, lineName: String, realName: String, phone: String, birthday: String, allergy: String, serviceItem: String, durationHours: Number, bookingTime: String, depositPaid: { type: Number, default: 500 }, createdAt: { type: Date, default: Date.now } }));
const LineUser = mongoose.model('LineUser', new mongoose.Schema({ lineUserId: { type: String, unique: true }, lineName: String, updatedAt: { type: Date, default: Date.now } }));

const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_KEY_JSON), scopes: ['https://www.googleapis.com/auth/calendar'] });
const calendar = google.calendar({ version: 'v3', auth });

app.get('/api/search-user', async (req, res) => {
  const users = await LineUser.find({ lineName: { $regex: req.query.q, $options: 'i' } }).limit(15);
  res.json(users);
});

app.get('/admin', async (req, res) => {
  const top6Users = await LineUser.find().sort({ updatedAt: -1 }).limit(6);
  let optionsHtml = top6Users.map(u => `<option value="${u.lineUserId}">⏱️ ${u.lineName}</option>`).join('');
  res.send(`<!DOCTYPE html><html><body><h1>SOARICH.STUDIO</h1><form action="/admin/add-customer" method="POST"><select name="lineUserId">${optionsHtml}</select><input type="text" name="realName" placeholder="姓名" required><input type="tel" name="phone" placeholder="電話" required><input type="date" name="birthday" required><select name="serviceItem"><option value="霧眉">霧眉</option><option value="美睫">美睫</option></select><input type="number" step="0.5" name="durationHours" placeholder="時長" required><input type="datetime-local" name="bookingTime" required><button type="submit">送出</button></form></body></html>`);
});

app.post('/admin/add-customer', async (req, res) => {
  const { lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime } = req.body;
  const newCustomer = new Customer({ lineUserId, realName, phone, birthday, serviceItem, durationHours, bookingTime });
  await newCustomer.save();
  await calendar.events.insert({ calendarId: 'soarich8588@gmail.com', requestBody: { summary: `🌸 ${realName} - ${serviceItem}`, start: { dateTime: new Date(bookingTime).toISOString(), timeZone: 'Asia/Taipei' }, end: { dateTime: new Date(new Date(bookingTime).getTime() + Number(durationHours) * 3600000).toISOString(), timeZone: 'Asia/Taipei' } } });
  res.send(`<script>alert("成功！");window.location.href="/admin";</script>`);
});

app.post('/webhook', (req, res) => {
  res.status(200).send('OK');
  if (req.body.events) req.body.events.forEach(async e => { if (e.source.userId) await LineUser.findOneAndUpdate({ lineUserId: e.source.userId }, { updatedAt: new Date() }, { upsert: true }); });
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('🚀 系統服役中...'));
