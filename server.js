
// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

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


// Serve static files for all folders (keep structure)
app.use(express.static(__dirname));

// Serve confirm_participation.html at /confirm_participation
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/confirm_participation.html');
});


app.get('/music', (req, res) => {
  res.sendFile(__dirname + '/camcui.vn/congthanhwedding/file/music.mp3');
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



// Serve main wedding page at root without exposing subfolder in URL
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/camcui.vn/congthanhwedding/index.html');
});

// Optional: fallback for 404 (static files not found)
app.use((req, res, next) => {
  res.status(404).send('Not found');
});

app.listen(port, () => {
  console.log(`Server is running at https://demothiepcuoi-production.up.railway.app:${port}`);
});
