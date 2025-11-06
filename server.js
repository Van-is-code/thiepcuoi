// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'shinkansen.proxy.rlwy.net',
  port: 41461,
  user: 'root',
  password: 'BZQAVvMfOBbhtxHuuzAQxCvWoprmyjNM',
  database: 'railway'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to database.');
  
  // Auto create guests table if not exists
  const createTableSQL = `CREATE TABLE IF NOT EXISTS guests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    will_attend VARCHAR(255),
    accompany VARCHAR(255),
    guest_of VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  
  db.query(createTableSQL, (err) => {
    if (err) {
      console.error('Failed to create guests table:', err);
    } else {
      console.log('Guests table ready.');
    }
  });
});

// API endpoint to save form data
app.post('/api/save', (req, res) => {
  const { name, message, form_item7, form_item8, form_item9 } = req.body;
  
  if (!name || !message) {
    return res.json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
  }
  
  const sql = 'INSERT INTO guests (name, message, will_attend, accompany, guest_of) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [name, message, form_item7, form_item8, form_item9], (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, message: 'Lỗi lưu dữ liệu.' });
    }
    res.json({ success: true });
  });
});

// API: get all guests
app.get('/api/guests', (req, res) => {
  db.query('SELECT * FROM guests ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }
    res.json(results);
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