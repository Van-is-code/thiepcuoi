// config.js
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid'); // Import uuid

// Chỉ giữ lại 1 connection string sql heroku dbwedding 3
const db_conn = process.env.DATABASE_URL_1 || 'mysql://d7xh4dxvhoykba91:s26dru7o4t5slog7@l6slz5o3eduzatkw.cbetxkdyhwsb.us-east-1.rds.amazonaws.com:3306/y2n7m8fe32s9fhgf';

// Tạo 1 pool duy nhất
const pool = mysql.createPool(db_conn);

// SQL tạo bảng (Giữ nguyên)
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS guests (
    id VARCHAR(36) PRIMARY KEY, 
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    will_attend VARCHAR(255),
    accompany VARCHAR(255),
    guest_of VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

// Hàm khởi tạo database (đơn giản hóa)
const initDatabase = async () => {
  try {
    // Chỉ chạy query trên 1 pool
    await pool.query(createTableSQL);
    console.log('✓ Guests table is ready');
  } catch (err) {
    console.error('✗ Failed to create guests table:', err);
    throw err;
  }
};

module.exports = {
  pool, // Chỉ export 1 pool
  initDatabase,
  uuidv4
};