const mineflayer = require('mineflayer');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH CỦA BẠN (SỬA ĐÚNG CÁC CHỖ NÀY)
// ==========================================
const SERVER_HOST = 'kingmc.vn';
const SERVER_PORT = 25565;
const BOT_USERNAME = 'Pumtrummod';
const PASSWORD = 'manhne11'; // Sửa lại mật khẩu thật

// Thông tin VPS của bạn (nơi chạy bot Discord)
const DISCORD_API_URL = "http://ord-804768-2261.cldcode.host:24950/api/game_payment";

// ✅ BẢO MẬT: Phải khớp với API_KEY bên file Discord
const API_KEY = process.env.API_KEY || "mat_khau_bao_mat_123"; 

// ✅ Phiên bản server KingMC (Fabric 1.21.1)
const BOT_VERSION = '1.21.1';
const AUTH_MODE = 'offline'; // Đổi thành 'microsoft' nếu là server chính thức
const LOGIN_COMMAND = `/dn ${PASSWORD}`; // Kiểm tra lại lệnh login của KingMC

// ==========================================
// BIẾN TOÀN CỤC
// ==========================================
let globalBot = null;
let isInMainServer = false;
let joinAttempt = 0;
let hasLoggedIn = false;
let afkInterval = null;
let reconnectTimer = null;

// ==========================================
// HÀM KHỞI TẠO BOT
// ==========================================
function startBot() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (afkInterval) clearInterval(afkInterval);

  joinAttempt++;
  hasLoggedIn = false;
  isInMainServer = false;

  console.log(`\n🔄 [LẦN ${joinAttempt}] Đang kết nối vào ${SERVER_HOST}:${SERVER_PORT} (v${BOT_VERSION})...`);

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
    version: BOT_VERSION,
    auth: AUTH_MODE,
    hideErrors: true,
    checkTimeoutInterval: 120000,
  });

  globalBot = bot;

  bot.on('error', (err) => {
    if (err.code !== 'ECONNRESET') console.log(`[LỖI] ${err.message}`);
  });

  bot.on('spawn', () => {
    console.log(`✅ [LẦN ${joinAttempt}] Đã vào sảnh chờ!`);

    if (joinAttempt === 1) {
      console.log(`⏳ [CHỐNG BOT] Tự động out sau 3 giây...`);
      setTimeout(() => { bot.quit(); }, 3000);
      return;
    }

    if (hasLoggedIn) return;
    hasLoggedIn = true;

    setTimeout(() => {
      console.log(`[AUTH] Đang gửi lệnh đăng nhập...`);
      bot.chat(LOGIN_COMMAND);
    }, 2000);

    setTimeout(() => {
      if (!isInMainServer) {
        console.log(`[GUI] Đang chọn ô đồng hồ (ô thứ 5) để mở Menu...`);
        try {
          bot.setQuickBarSlot(4);
          bot.activateItem();
        } catch (e) { console.log(`[GUI LỖI] ${e.message}`); }
      }
    }, 6000);
  });

  bot.on('windowOpen', (window) => {
    if (!isInMainServer) {
      setTimeout(() => {
        console.log(`[GUI] Đang click ô 25 để vào KingSMP...`);
        try {
          bot.clickWindow(24, 0, 0);
          isInMainServer = true;
          console.log(`✅ [MAIN] Đã vào KingSMP! Sẵn sàng nhận lệnh /pay.`);
        } catch (e) { console.log(`[GUI CLICK LỖI] ${e.message}`); }
      }, 1000);
    }
  });

  // Lắng nghe tin nhắn chat để bắt tiền vào
  bot.on('message', async (jsonMsg) => {
    const msg = jsonMsg.toString();
    if (msg.includes("Bạn nhận được") && msg.includes("từ")) {
      console.log(`💰 [TIỀN VÀO] ${msg}`);
      try {
        await axios.post(DISCORD_API_URL, { message: msg });
        console.log(`[API] Đã gửi thông tin về Discord.`);
      } catch (error) { console.log(`❌ [API LỖI] ${error.message}`); }
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`❌ Bot bị đá. Lý do: ${JSON.stringify(reason)}`);
  });

  bot.on('end', (reason) => {
    console.log(`❌ Bot ngắt kết nối. Lý do: ${reason}`);
    if (afkInterval) { clearInterval(afkInterval); afkInterval = null; }
    console.log(`🔄 Thử kết nối lại sau 5 giây...`);
    reconnectTimer = setTimeout(startBot, 5000);
  });

  // Chống AFK
  afkInterval = setInterval(() => {
    if (isInMainServer && bot.entity) {
      try {
        bot.setControlState('jump', true);
        setTimeout(() => { try { bot.setControlState('jump', false); } catch (e) {} }, 500);
      } catch (e) {}
    }
  }, 30000);
}

// ==========================================
// API SERVER (NHẬN LỆNH TỪ BOT DISCORD)
// ==========================================
app.post('/pay', (req, res) => {
  // 1. Kiểm tra API Key
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).send({ status: 'error', message: 'Sai API Key' });
  }

  const { ign, amount } = req.body;

  if (!ign || !amount) {
    return res.status(400).send({ status: 'error', message: 'Thiếu ign hoặc amount' });
  }

  if (!isInMainServer || !globalBot) {
    return res.status(400).send({ status: 'error', message: 'Bot chưa vào server' });
  }

  try {
    // Gõ lệnh pay vào game
    globalBot.chat(`/pay ${ign} ${amount}`);
    console.log(`[PAY] Đã gõ lệnh: /pay ${ign} ${amount}`);
    res.send({ status: 'success' });
  } catch (e) {
    res.status(500).send({ status: 'error', message: e.message });
  }
});

// Health check cho UptimeRobot/cron-job
app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    botConnected: !!globalBot,
    inMainServer: isInMainServer,
    joinAttempt: joinAttempt,
  });
});

// ==========================================
// KHỞI ĐỘNG
// ==========================================
app.listen(process.env.PORT || 3000, () => {
  console.log('🌐 API Bot Mine đang chạy ở cổng ' + (process.env.PORT || 3000));
});

startBot();
