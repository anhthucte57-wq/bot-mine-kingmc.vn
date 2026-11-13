const mineflayer = require('mineflayer');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH CỦA BẠN (SỬA ĐÚNG CÁC CHỖ NÀY)
// ==========================================
const SERVER_HOST = 'play.kingmc.vn';
const SERVER_PORT = 25565;

const BOT_USERNAME = 'Pumtrummod';
const PASSWORD = 'manhne11'; // Sửa lại mật khẩu thật
const DISCORD_API_URL = "ord-804768-2261.cldcode.host:24950";

// ✅ QUAN TRỌNG: Đã sửa cho khớp với Fabric 1.21.1
const BOT_VERSION = '1.21.1';

// ✅ Nếu server KingMC là server lậu/offline (không dùng tài khoản Microsoft),
// giữ 'offline'. Nếu là server chính thức, đổi thành 'microsoft'
const AUTH_MODE = 'offline';

// ✅ Lệnh đăng nhập. Kiểm tra lại KingMC dùng lệnh nào: /dn, /login, /l, /dangnhap...
const LOGIN_COMMAND = `/dn ${PASSWORD}`;

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
  // Dọn dẹp trước khi tạo bot mới
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
    version: BOT_VERSION,       // ✅ Đã sửa
    auth: AUTH_MODE,            // ✅ Đã thêm
    hideErrors: true,
    checkTimeoutInterval: 120000,
    // viewDistance: 'tiny',    // Tùy chọn: giảm tải cho Render Free Tier
  });

  globalBot = bot;

  // --- XỬ LÝ LỖI ---
  bot.on('error', (err) => {
    if (err.code !== 'ECONNRESET') {
      console.log(`[LỖI] ${err.message}`);
    }
  });

  // --- KHI ĐÃ VÀO SẢNH CHỜ ---
  bot.on('spawn', () => {
    console.log(`✅ [LẦN ${joinAttempt}] Đã vào sảnh chờ!`);

    // Lần đầu: tự out sau 3s để "đánh lừa" anti-bot, sau đó kết nối lại
    if (joinAttempt === 1) {
      console.log(`⏳ [CHỐNG BOT] Tự động out sau 3 giây...`);
      setTimeout(() => { bot.quit(); }, 3000);
      return;
    }

    // Các lần sau: đăng nhập
    if (hasLoggedIn) return;
    hasLoggedIn = true;

    setTimeout(() => {
      console.log(`[AUTH] Đang gửi lệnh đăng nhập: ${LOGIN_COMMAND}`);
      bot.chat(LOGIN_COMMAND);
    }, 2000);

    // Sau 6s, mở menu (ô đồng hồ - slot 5)
    setTimeout(() => {
      if (!isInMainServer) {
        console.log(`[GUI] Đang chọn ô đồng hồ (ô thứ 5) để mở Menu...`);
        try {
          bot.setQuickBarSlot(4);
          bot.activateItem();
        } catch (e) {
          console.log(`[GUI LỖI] ${e.message}`);
        }
      }
    }, 6000);
  });

  // --- KHI MỞ MENU GUI ---
  bot.on('windowOpen', (window) => {
    let titleStr = "";
    try {
      if (typeof window.title === 'string') titleStr = window.title;
      else titleStr = JSON.stringify(window.title);
    } catch (e) { titleStr = "Unknown"; }
    console.log(`[GUI] Đã mở bảng: ${titleStr}`);

    if (!isInMainServer) {
      setTimeout(() => {
        console.log(`[GUI] Đang click ô 25 để vào KingSMP...`);
        try {
          bot.clickWindow(24, 0, 0);
          isInMainServer = true;
          console.log(`✅ [MAIN] Đã vào KingSMP! Bắt đầu nhận lệnh /pay.`);
        } catch (e) {
          console.log(`[GUI CLICK LỖI] ${e.message}`);
        }
      }, 1000);
    }
  });

  // --- LẮNG NGHE TIN NHẮN (BẮT TIỀN VÀO) ---
  bot.on('message', async (jsonMsg) => {
    const msg = jsonMsg.toString();
    console.log(`[CHAT] ${msg}`); // Log tất cả để dễ debug

    if (msg.includes("Bạn nhận được") && msg.includes("từ")) {
      console.log(`💰 [TIỀN VÀO] ${msg}`);
      try {
        await axios.post(DISCORD_API_URL, { message: msg });
        console.log(`[API] Đã gửi thông tin về Discord thành công.`);
      } catch (error) {
        console.log(`❌ [API LỖI] ${error.message}`);
      }
    }
  });

  // --- KHI BỊ KICK ---
  bot.on('kicked', (reason) => {
    let r = reason;
    try { r = JSON.stringify(reason); } catch (e) {}
    console.log(`❌ Bot bị đá khỏi server. Lý do: ${r}`);
  });

  // --- KHI NGẮT KẾT NỐI: LUÔN RECONNECT ---
  bot.on('end', (reason) => {
    console.log(`❌ Bot ngắt kết nối. Lý do: ${reason}`);
    if (afkInterval) { clearInterval(afkInterval); afkInterval = null; }
    console.log(`🔄 Thử kết nối lại sau 5 giây...`);
    reconnectTimer = setTimeout(startBot, 5000);
  });

  // --- CHỐNG AFK: NHẢY MỖI 30 GIÂY ---
  afkInterval = setInterval(() => {
    if (isInMainServer && bot.entity) {
      try {
        bot.setControlState('jump', true);
        setTimeout(() => {
          try { bot.setControlState('jump', false); } catch (e) {}
        }, 500);
      } catch (e) {}
    }
  }, 30000);
}

// ==========================================
// API SERVER (NHẬN LỆNH /PAY TỪ BÊN NGOÀI)
// ==========================================
app.post('/pay', (req, res) => {
  const { ign, amount } = req.body;

  if (!ign || !amount) {
    return res.status(400).send({ status: 'error', message: 'Thiếu ign hoặc amount' });
  }

  if (!isInMainServer || !globalBot) {
    return res.status(400).send({ status: 'error', message: 'Bot chưa vào server' });
  }

  try {
    globalBot.chat(`/pay ${ign} ${amount}`);
    console.log(`[PAY] Đã gõ lệnh: /pay ${ign} ${amount}`);
    res.send({ status: 'success' });
  } catch (e) {
    res.status(500).send({ status: 'error', message: e.message });
  }
});

// Health check cho Render
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