import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

export const query = async (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
