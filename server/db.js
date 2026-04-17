import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Azure MySQL Flexible Server requires SSL. When DB_HOST points at Azure
// (or DB_SSL is explicitly true), enable TLS. Local dev stays plain.
const isAzure = (process.env.DB_HOST || '').includes('database.azure.com');
const useSSL  = isAzure || process.env.DB_SSL === 'true';

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'coog_zoo',
    ssl:      useSSL ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit:    10,
    timezone: '+00:00',   // store/read all DATETIMEs as UTC
});

export default pool;
