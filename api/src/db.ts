import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "fellowship",
  DB_SSL = "",
  DB_SSL_REJECT_UNAUTHORIZED = "true",
  DB_SSL_CA = "",
} = process.env;

const useSsl = ["1", "true", "yes"].includes(DB_SSL.toLowerCase());
const rejectUnauthorized = !["0", "false", "no"].includes(DB_SSL_REJECT_UNAUTHORIZED.toLowerCase());
const ssl = useSsl
  ? {
      rejectUnauthorized,
      ...(DB_SSL_CA ? { ca: DB_SSL_CA } : {}),
    }
  : undefined;

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ...(ssl ? { ssl } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function healthCheck() {
  const [rows] = await pool.query("SELECT 1 as ok");
  return rows;
}
