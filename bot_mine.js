const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH CỦA BẠN (SỬA CÁC DÒNG NÀY)
// ==========================================
const SERVER_HOST = 'sgp.kingmc.vn'; 
const SERVER_PORT = 25565;
const BOT_USERNAME = 'Pumtrummod'; 
const PASSWORD = 'manhne11'; 

// ✅ Cập nhật phiên bản theo khuyến nghị của KingMC
const BOT_VERSION = '1.21.11'; 
const AUTH_MODE = 'offline'; 

// ✅ BẢO MẬT: Phải khớp với API_KEY bên file Discord
const API_KEY = process.env.API_KEY || "mat_khau_bao_mat_123"; 

// ==========================================
// KHỞI TẠO & LOGIC CHÍNH
// ==========================================
let globalBot = null; 
let isInMainServer = false;
let joinAttempt = 0; 
let hasLoggedIn = false; 
let afkInterval = null;

function startBot() {
  if (afkInterval) clearInterval(afkInterval);

  joinAttempt++;
  hasLoggedIn = false; 
  isInMainServer = false; 
  
  console.log(`\n🔄 [LẦN ${joinAttempt}] Đang kết nối vào ${SERVER_HOST} (v${BOT_VERSION})...`);
  
  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
    version: BOT_VERSION,
    auth: AUTH_MODE,
    hideErrors: true,
    checkTimeoutInterval: 120000,
    // ✅ BẢN VÁ LỖI SOCKETCLOSED: Tắt physics lúc kết nối
    physicsEnabled: false, 
  });
  
  globalBot = bot; 

  // ✅ Bật lại physics sau khi đã vào sảnh chờ thành công
  bot.once('spawn', () => {
    setTimeout(() => {
      if (!bot._ended) bot.physicsEnabled = true;
    }, 2000);
  });

  bot.on('error', (err) => {
    if (err.code !== 'ECONNRESET') console.log(`[LỖI] ${err.message}`);
  });

  bot.on('spawn', () => {
    console.log(`✅ [LẦN ${joinAttempt}] Đã vào sảnh chờ!`);
    
    if (joinAttempt === 1) {
      // Lần đầu tiên: Đợi 6 giây rồi tự out để lách anti-bot
      console.log(`⏳ [CHỐNG BOT] Đang ở bảng xác nhận. Tự động out sau 6 giây...`);
      setTimeout(() => {
        console.log(`🚪 Tự động ngắt kết nối (Quit).`);
        bot.quit(); 
      }, 6000); 
    } else {
      if (hasLoggedIn) return;
      hasLoggedIn = true;

      // Đăng nhập sau 3 giây
      setTimeout(() => {
        console.log(`[AUTH] Gửi lệnh đăng nhập: /dn ${PASSWORD}`);
        bot.chat(`/dn ${PASSWORD}`);
      }, 3000);

      // Mở menu sau 8 giây
      setTimeout(() => {
        if (!isInMainServer) {
          console.log(`[GUI] Đang chọn ô đồng hồ (ô thứ 5) để mở Menu...`);
          try {
            bot.setQuickBarSlot(4); 
            bot.activateItem(); 
          } catch(e) {}
        }
      }, 8000);
    }
  });

  bot.on('windowOpen', (window) => {
    let titleStr = "";
    try {
      if (typeof window.title === 'string') titleStr = window.title;
      else titleStr = JSON.stringify(window.title);
    } catch (e) { titleStr = "Unknown"; }
    
    console.log(`[GUI] Đã mở bảng: ${titleStr}`);
    
    if (!isInMainServer) {
      setTimeout(() => {
        const slotToClick = 24; 
        try {
          bot.clickWindow(slotToClick, 0, 0);
          console.log(`[GUI] Đã click ô 25 để vào KingSMP!`);
          isInMainServer = true; 
          console.log(`✅ [MAIN] Đã vào KingSMP! Sẵn sàng nhận lệnh /pay.`);
        } catch (e) {
          console.log(`[LỖI] Không click được: ${e}`);
        }
      }, 1500); 
    }
  });

  bot.on('kicked', (reason) => {
    let r = reason;
    try { r = JSON.stringify(reason); } catch (e) {}
    console.log(`❌ Bot bị đá. Lý do: ${r}`);
  });

  bot.on('end', (reason) => {
    console.log(`❌ Bot ngắt kết nối. Lý do: ${reason}`);
    if (afkInterval) { clearInterval(afkInterval); afkInterval = null; }
    
    // Tăng thời gian chờ lên 15 giây để tránh bị anti-bot chặn
    console.log(`🔄 Tự động kết nối lại sau 15 giây...`);
    setTimeout(startBot, 15000); 
  });
  
  // Chống AFK
  afkInterval = setInterval(() => {
    if (isInMainServer && bot.entity) {
      try {
        bot.setControlState('jump', true);
        setTimeout(() => { try { bot.setControlState('jump', false); } catch (e) {} }, 500);
      } catch(e) {}
    }
  }, 30000);
}

startBot();

// ==========================================
// API NHẬN LỆNH TỪ BOT DISCORD (TRẢ TIỀN)
// ==========================================
app.post('/pay', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).send({ status: 'error', message: 'Sai API Key' });
  }

  const { ign, amount } = req.body;
  if (!isInMainServer || !globalBot) {
    return res.status(400).send({ status: 'error', message: 'Bot chưa vào server chính' });
  }
  
  try {
    globalBot.chat(`/pay ${ign} ${amount}`);
    console.log(`[PAY] Đã gửi lệnh: /pay ${ign} ${amount}`);
    res.send({ status: 'success' });
  } catch (e) {
    res.status(500).send({ status: 'error', message: e.message });
  }
});

app.get('/', (req, res) => {
  res.send({ status: 'ok', botConnected: !!globalBot, inMainServer: isInMainServer });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('🌐 API Bot Mine đang chạy ở cổng ' + (process.env.PORT || 3000));
});
