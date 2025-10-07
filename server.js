// ESSENTIAL: toàn bộ cấu hình DB nằm trong file này (theo yêu cầu).
// WARNING: KHÔNG commit file này nếu chứa credentials thật. Giữ file private.

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); // using promise API
const app = express();

// ESSENTIAL: Điền chuỗi kết nối DB1 (primary) và DB2 (overflow) ở đây.
// WARNING: Nếu bạn có .env, tốt hơn là dùng .env; nhưng theo yêu cầu, để mọi thứ trong file này.
// Thay đổi giá trị bên dưới bằng kết nối thật của bạn.
const DB1_URL = 'mysql://nws822ss8hy4oky8:scft1zboqo9zngmh@mgs0iaapcj3p9srz.cbetxkdyhwsb.us-east-1.rds.amazonaws.com:3306/dels9yo341lbvfd0'; // ESSENTIAL: DB1 (primary)
const DB2_URL = 'mysql://wrx9vjfadbichxbn:lcdoka9yjqgzvazg@erxv1bzckceve5lh.cbetxkdyhwsb.us-east-1.rds.amazonaws.com:3306/hlmj0arslui9e8d8'; // ESSENTIAL: DB2 (overflow)
const DB1_MAX_ROWS = 50000; // ESSENTIAL: ngưỡng tối đa hàng cho DB1, thay nếu cần
const PORT = process.env.PORT || 3000; // ESSENTIAL: port có thể để ở đây hoặc dùng env

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create connection pools for both DBs
const pool1 = mysql.createPool(DB1_URL);
const pool2 = mysql.createPool(DB2_URL);

// ESSENTIAL: schema của bảng guests — chỉnh nếu form/schema khác
const createGuestsTableSQL = `CREATE TABLE IF NOT EXISTS guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  will_attend VARCHAR(255),
  accompany VARCHAR(255),
  guest_of VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

// Ensure table exists on both DBs (best-effort)
async function ensureTables() {
  try {
    await pool1.query(createGuestsTableSQL);
    console.log('Guests table ready on DB1.');
  } catch (err) {
    console.warn('Failed to create guests table on DB1:', err.message);
  }
  try {
    await pool2.query(createGuestsTableSQL);
    console.log('Guests table ready on DB2.');
  } catch (err) {
    console.warn('Failed to create guests table on DB2:', err.message);
  }
}
ensureTables().catch(() => { /* ignore */ });

// ESSENTIAL: logic to decide if DB1 is "full" — uses row count threshold.
// You can replace with a different check (disk usage, quota, etc.) if available.
async function isDb1Full() {
  try {
    const [rows] = await pool1.query('SELECT COUNT(1) AS cnt FROM guests');
    const cnt = rows && rows[0] ? Number(rows[0].cnt || 0) : 0;
    return cnt >= DB1_MAX_ROWS;
  } catch (err) {
    // If DB1 is down or query fails, treat it as full to avoid relying on it
    console.warn('isDb1Full check failed; treating DB1 as full:', err.message);
    return true;
  }
}

// Helper: trả về chuỗi datetime chuẩn MySQL theo GMT+7
function nowGMT7String() {
  // Date.now() trả về epoch ms (UTC). Cộng 7 giờ để được thời gian GMT+7.
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  // use UTC getters because we already offset by +7h
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const mins = pad(d.getUTCMinutes());
  const secs = pad(d.getUTCSeconds());
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

// Insert guest: ưu tiên DB1 (nếu không đầy), fallback DB2
async function insertGuest({ name, message, will_attend, accompany, guest_of }) {
  // ESSENTIAL: giờ created_at sẽ được set trực tiếp từ server theo GMT+7
  const created_at = nowGMT7String();
  const sql = 'INSERT INTO guests (name, message, will_attend, accompany, guest_of, created_at) VALUES (?, ?, ?, ?, ?, ?)';
  const params = [name, message, will_attend || null, accompany || null, guest_of || null, created_at];

  const db1Full = await isDb1Full();
  if (!db1Full) {
    try {
      const [result] = await pool1.query(sql, params);
      return { ok: true, db: 'db1', insertId: result.insertId, created_at };
    } catch (err) {
      console.warn('Insert to DB1 failed, falling back to DB2:', err.message);
      // fall through to DB2
    }
  } else {
    console.info('DB1 is full by threshold, writing to DB2.');
  }

  // Insert into DB2
  const [result2] = await pool2.query(sql, params);
  return { ok: true, db: 'db2', insertId: result2.insertId, created_at };
}

// Read guests: query cả 2 DB song song, merge + dedupe theo fingerprint (ưu tiên DB1)
async function getGuests() {
  const sql = 'SELECT * FROM guests';
  // Query both DBs (catch từng DB để không vỡ toàn bộ khi 1 DB lỗi)
  const p1 = pool1.query(sql).catch(err => {
    console.warn('DB1 read failed:', err.message);
    return [ [] ];
  });
  const p2 = pool2.query(sql).catch(err => {
    console.warn('DB2 read failed:', err.message);
    return [ [] ];
  });

  const [[rows1], [rows2]] = await Promise.all([p1, p2]);

  // Debug log: hiển thị số hàng lấy được từ mỗi DB
  console.log(`getGuests: DB1 rows=${Array.isArray(rows1) ? rows1.length : 0}, DB2 rows=${Array.isArray(rows2) ? rows2.length : 0}`);

  // Dedupe bằng "fingerprint" (name|message|created_at) — tránh mất bản ghi DB2 khi id trùng
  const seen = new Set();
  const merged = [];

  // Thêm DB1 trước (ưu tiên DB1 khi cùng fingerprint)
  if (Array.isArray(rows1)) {
    for (const r of rows1) {
      const ts = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || '');
      const key = `${String(r.name)}|${String(r.message)}|${ts}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }

  // Thêm các bản ghi DB2 nếu fingerprint chưa thấy
  if (Array.isArray(rows2)) {
    for (const r of rows2) {
      const ts = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || '');
      const key = `${String(r.name)}|${String(r.message)}|${ts}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }

  // Sắp xếp kết quả theo created_at giảm dần trước khi trả về
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return merged;
}

// API endpoint để lưu form
app.post('/api/save', async (req, res) => {
  try {
    const { name, message, form_item7, form_item8, form_item9 } = req.body;
    if (!name || !message) {
      return res.json({ success: false, message: 'Thiếu thông tin bắt buộc.' });
    }

    // ESSENTIAL: validate thêm nếu cần
    const result = await insertGuest({
      name,
      message,
      will_attend: form_item7,
      accompany: form_item8,
      guest_of: form_item9
    });

    res.json({ success: true, savedTo: result.db, created_at: result.created_at });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lưu dữ liệu.' });
  }
});

// Serve static files (giữ cấu trúc thư mục)
app.use(express.static(__dirname));

// Admin page
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/confirm_participation.html');
});

// Music file
app.get('/music', (req, res) => {
  res.sendFile(__dirname + 'https://demothiepcuoi-production.up.railway.app/music.mp3');
});

// Lấy danh sách khách (merge từ 2 DB)
app.get('/api/guests', async (req, res) => {
  try {
    const guests = await getGuests();
    console.log(`Returning ${guests.length} merged guests`);
    res.json(guests);
  } catch (err) {
    console.error('Get guests error:', err);
    res.status(500).json([]);
  }
});

// Root page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/camcui.vn/congthanhwedding/index.html');
});

// Fallback 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port localhost:${PORT}`);
});