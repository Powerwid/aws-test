const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aws-test',
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
  charset: 'utf8mb4'
});

module.exports = pool;
