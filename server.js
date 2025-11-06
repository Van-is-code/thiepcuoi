// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // THAY ĐỔI: Sử dụng 'pg' thay vì 'mysql2'
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// THAY ĐỔI: Cấu hình kết nối PostgreSQL
// TODO: Cập nhật connection string cho database PostgreSQL của bạn
// Ví dụ: 'postgresql://USER:PASSWORD@HOST:PORT/DATABASE'
// Bạn có thể lấy connection string này từ Railway (nếu bạn dùng PG trên Railway)
const connectionString = 'postgres://koyeb-adm:npg_pcjBze5f9Hhn@ep-crimson-water-a1t8exfm.ap-southeast-1.pg.koyeb.app/koyebdb';

const pool = new Pool({
  connectionString: connectionString,
  // Có thể cần nếu kết nối với các dịch vụ cloud như Heroku, Railway
  ssl: {
    rejectUnauthorized: false
  }
});

// THAY ĐỔI: Kiểm tra kết nối và tự động tạo bảng (cách tiếp cận của pg)
const createTableSQL = `CREATE TABLE IF NOT EXISTS guests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  will_attend VARCHAR(255),
  accompany VARCHAR(255),
  guest_of VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

pool.query(createTableSQL, (err) => {
  if (err) {
    console.error('Failed to create guests table:', err);
  } else {
    console.log('Guests table ready.');
  }
});

// API endpoint to save form data
app.post('/api/save', (req, res) => {
  const { name, message, form_item7, form_item8, form_item9 } = req.body;

  if (!name || !message) {
    return res.json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
  }

  // THAY ĐỔI: Sử dụng $1, $2... cho placeholders
  const sql = 'INSERT INTO guests (name, message, will_attend, accompany, guest_of) VALUES ($1, $2, $3, $4, $5)';
  const values = [name, message, form_item7, form_item8, form_item9];

  // THAY ĐỔI: Sử dụng 'pool.query'
  pool.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Lỗi lưu dữ liệu.' });
    }
    res.json({ success: true });
  });
});

// API: get all guests
app.get('/api/guests', (req, res) => {
  // THAY ĐỔI: Sử dụng 'pool.query'
  pool.query('SELECT * FROM guests ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }
    // THAY ĐỔI: Kết quả trả về nằm trong 'results.rows'
    res.json(results.rows);
  });
});

// Serve admin page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'confirm_participation.html'));
});

// Serve music file
app.get('/music', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/file/music.mp3'));
});

// Serve thiep cuoi (wedding invitation)
app.get('/thiepcuoi', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/thiepcuoi.html'));
});

// Serve thiep moi (invitation card)
app.get('/thiepmoi', (req, res) => {
  res.sendFile(path.join(__dirname, 'camcui.vn/congthanhwedding/thiepmoi.html'));
});

// Serve static files for all folders
app.use(express.static(__dirname));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Admin page: http://localhost:${port}/`);
  console.log(`Thiệp mời: http://localhost:${port}/thiepmoi`);
  console.log(`Thiệp cưới: http://localhost:${port}/thiepcuoi`);
});