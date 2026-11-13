const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH CỦA BẠN (SỬA CÁC DÒNG NÀY)
// ==========================================
const SERVER_HOST = 'play.kingmc.vn'; 
const SERVER_PORT = 25565;
const BOT_USERNAME = 'Pumtrummod'; 
const PASSWORD = 'manhne11'; 
const BOT_VERSION = '1.20.1'; 

const DISCORD_WEBHOOK_URL = "http://ord-804768-2261.cldcode.host:24950/api/game_payment";
const API_KEY = process.env.API_KEY || "mat_khau_bao_mat_123"; 

// ==========================================
// KHỞI TẠO & LOGIC CHÍNH
// ==========================================
let globalBot = null; 
let isInMainServer = false;
let joinAttempt = 0; 
let hasLoggedIn = false; 

function startBot() {
  joinAttempt++;
  hasLoggedIn = false; 
  console.log(`\n🔄 [LẦN ${joinAttempt}] Đang kết nối vào server...`);
  
  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
    version: BOT_VERSION,
    hideErrors: true,
    checkTimeoutInterval: 120000
  });
  
  globalBot = bot; 

  bot.on('error', (err) => {
    if (err.code !== 'ECONNRESET') console.log(`[LỖI] ${err.message}`);
  });

  bot.on('spawn', () => {
    console.log(`✅ [LẦN ${joinAttempt}] Đã vào sảnh chờ!`);
    
    if (joinAttempt === 1) {
      console.log(`⏳ [CHỐNG BOT] Đang ở bảng xác nhận. Tự động out sau 3 giây...`);
      setTimeout(() => {
        console.log(`🚪 Tự động ngắt kết nối (Quit).`);
        bot.quit(); 
      }, 3000); 
    } else {
      if (hasLoggedIn) return;
      hasLoggedIn = true;

      setTimeout(() => {
        console.log(`[AUTH] Gửi lệnh đăng nhập: /dn ${PASSWORD}`);
        bot.chat(`/dn ${PASSWORD}`);
      }, 2000);

      setTimeout(() => {
        if (!isInMainServer) {
          console.log(`[GUI] Đang chọn ô đồng hồ (ô thứ 5) để mở Menu...`);
          bot.setQuickBarSlot(4); 
          bot.activateItem(); 
        }
      }, 6000);
    }
  });

  bot.on('windowOpen', (window) => {
    if (!isInMainServer) {
      setTimeout(() => {
        const slotToClick = 24; 
        try {
          bot.clickWindow(slotToClick, 0, 0);
          console.log(`[GUI] Đã click ô 25 để vào KingSMP!`);
          isInMainServer = true; 
          console.log(`✅ [MAIN] Đã vào KingSMP! Sẵn sàng Nạp/Rút.`);
        } catch (e) {
          console.log(`[LỖI] Không click được: ${e}`);
        }
      }, 1000);
    }
  });

  bot.on('message', async (jsonMsg) => {
    const msg = jsonMsg.toString();
    
    if (msg.includes("Bạn đã nhận được") || msg.includes("Bạn nhận được")) {
      console.log(`💰 [TIỀN VÀO] ${msg}`);
      
      try {
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        console.log(`[API] Đã báo tiền nạp về Discord.`);
      } catch (error) {
        console.log(`❌ [API LỖI] Không gửi được webhook: ${error.message}`);
      }
    }
  });

  bot.on('end', (reason) => {
    console.log(`❌ Bot ngắt kết nối. Lý do: ${reason}`);
    if (joinAttempt === 1 || !isInMainServer) {
      console.log(`🔄 Tự động kết nối lại...`);
      setTimeout(startBot, 3000); 
    }
  });
  
  setInterval(() => {
    if (isInMainServer && bot.entity) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }
  }, 30000);
}

startBot();

// ==========================================
// API RÚT TIỀN (TỪ BOT DISCORD GỌI SANG)
// ==========================================
app.post('/pay', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) return res.status(401).send({ status: 'error', message: 'Sai API Key' });
  
  const { ign, amount } = req.body;
  
  if (!isInMainServer || !globalBot) return res.status(400).send({ status: 'error', message: 'Bot chưa vào server chính' });
  
  try {
    // ✅ SỬA: Thêm chữ "M" vào sau số tiền (1 PCoin = 1M trong game)
    globalBot.chat(`/pay ${ign} ${amount}M`);
    console.log(`[PAY] Đã gửi lệnh: /pay ${ign} ${amount}M`);
    res.send({ status: 'success' });
  } catch (e) { 
    res.status(500).send({ status: 'error', message: e.message }); 
  }
});

app.get('/', (req, res) => res.send({ status: 'ok', botConnected: !!globalBot, inMainServer: isInMainServer }));
app.listen(process.env.PORT || 3000, () => console.log('🌐 API chạy ở cổng ' + (process.env.PORT || 3000)));
