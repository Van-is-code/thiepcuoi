// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
// Import 1 pool và uuidv4
const { pool, initDatabase, uuidv4 } = require('./config');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Khởi tạo database khi server start
initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// API endpoint to save form data (Đơn giản hóa)
app.post('/api/save', async (req, res) => {
  const { name, message, form_item7, form_item8, form_item9 } = req.body;

  if (!name || !message) {
    return res.json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
  }

  const guestId = uuidv4();
  const sql = 'INSERT INTO guests (id, name, message, will_attend, accompany, guest_of) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [guestId, name, message, form_item7, form_item8, form_item9];

  try {
    // Chỉ ghi vào 1 DB
    await pool.query(sql, values);
    
    console.log(`✓ Guest saved: ${name} (ID: ${guestId})`);
    res.json({ success: true, id: guestId });
  } catch (err) {
    console.error('Error saving data:', err);
    res.json({ success: false, message: 'Lỗi lưu dữ liệu.' });
  }
});

// API: get all guests (Đơn giản hóa và hiệu quả hơn)
app.get('/api/guests', async (req, res) => {
  // Thêm ORDER BY vào SQL để database tự sắp xếp
  const sql = 'SELECT * FROM guests ORDER BY created_at DESC';
  try {
    // Chỉ lấy dữ liệu từ 1 DB
    // Destructure [rows] từ kết quả [rows, fields]
    const [rows] = await pool.query(sql);

    // Không cần gộp hay lọc trùng lặp
    res.json(rows);
  } catch (err) {
    console.error('Error fetching guests:', err);
    res.status(500).json([]);
  }
});

// --- (Các route serve file HTML không thay đổi) ---
// Serve admin page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'confirm_participation.html'));
});

// Serve music file
app.get('/music', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/file/music.mp3'));
});

// NHÀ GÁI
app.get('/nhagai/thiepcuoi', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/thiepcuoi_nhagai.html'));
});
app.get('/nhagai/thiepmoi', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/thiepmoi_nhagai.html'));
});

// NHÀ TRAI
app.get('/nhatrai/thiepcuoi', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/thiepcuoi_nhatrai.html'));
});
app.get('/nhatrai/thiepmoi', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/thiepmoi_nhatrai.html'));
});

// Serve static files for all folders
app.use(express.static(__dirname));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not found');
});
// ----------------------------------------------------

// Graceful shutdown (đóng 1 pool)
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
  });
});

app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   🎉 Server is running on port ${port}                      ║
║   💾 Using 1 MySQL Databases (High Availability)            ║
╠════════════════════════════════════════════════════════════╣
║   📊 Admin page: http://localhost:${port}/                  ║
║                                                            ║
║   💌 Nhà gái:                                              ║
║      Thiệp mời: http://localhost:${port}/nhagai/thiepmoi   ║
║      Thiệp cưới: http://localhost:${port}/nhagai/thiepcuoi  ║
║                                                            ║
║   🤵 Nhà trai:                                              ║
║      Thiệp mời: http://localhost:${port}/nhatrai/thiepmoi  ║
║      Thiệp cưới: http://localhost:${port}/nhatrai/thiepcuoi ║
╚════════════════════════════════════════════════════════════╝
  `);
});
