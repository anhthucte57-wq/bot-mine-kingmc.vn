const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.use(express.json());

// ==========================================
// CẤU HÌNH CỦA BẠN (SỬA CÁC DÒNG NÀY)
// ==========================================
const SERVER_HOST = 'play.kingmc.vn'; 
const SERVER_PORT = 25565;
const BOT_USERNAME = 'pumcomtam'; 
// Đã xoá PASSWORD vì bạn không muốn đăng nhập
const BOT_VERSION = '1.20.1'; 

const DISCORD_WEBHOOK_URL = "http://ord-804768-2261.cldcode.host:24950/api/game_payment";
const API_KEY = process.env.API_KEY || "mat_khau_bao_mat_123"; 

// ==========================================
// BIẾN TOÀN CỤC
// ==========================================
let globalBot = null; 
let joinAttempt = 0; 

// ==========================================
// HÀM KHỞI TẠO VÀ KẾT NỐI LẠI
// ==========================================
function startBot() {
  joinAttempt++;
  console.log(`\n🔄 [LẦN ${joinAttempt}] Đang kết nối vào sảnh...`);
  
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
    console.log(`✅ [LẦN ${joinAttempt}] Đã vào sảnh chờ! Đang treo tại đây...`);
    
    // Nếu là lần đầu kết nối (để vượt qua bảng chống bot nếu có)
    if (joinAttempt === 1) {
      console.log(`⏳ [CHỐNG BOT] Đang ở bảng xác nhận. Tự động out sau 3 giây...`);
      setTimeout(() => {
        console.log(`🚪 Tự động ngắt kết nối (Quit).`);
        bot.quit(); 
      }, 3000); 
    }
    // Từ lần 2 trở đi, bot chỉ đứng im ở sảnh, không làm gì cả.
  });

  // Không quan tâm bị văng vì lý do gì, cứ văng là vào lại
  bot.on('end', (reason) => {
    console.log(`❌ Bot ngắt kết nối (Lý do: ${reason}).`);
    console.log(`🔄 Tự động kết nối lại sảnh sau 5 giây...`);
    
    globalBot = null;
    
    setTimeout(() => {
      startBot();
    }, 5000); 
  });
}

// Khởi chạy lần đầu
startBot();

// ==========================================
// API (Giữ lại phòng trường hợp bạn cần, dù treo sảnh thì không rút được tiền)
// ==========================================
app.post('/pay', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) return res.status(401).send({ status: 'error', message: 'Sai API Key' });
  
  res.status(400).send({ status: 'error', message: 'Bot đang treo sảnh, không thể rút tiền' });
});

app.get('/', (req, res) => res.send({ status: 'ok', botConnected: !!globalBot }));
app.listen(process.env.PORT || 3000, () => console.log('🌐 API chạy ở cổng ' + (process.env.PORT || 3000)));
