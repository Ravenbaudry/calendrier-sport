import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// DATE (OID 1082) : garder la chaîne 'YYYY-MM-DD' pour éviter tout décalage de fuseau.
types.setTypeParser(1082, (value) => value);
// NUMERIC (1700) et BIGINT (20) : convertis en nombres JS (valeurs largement dans les limites).
types.setTypeParser(1700, (value) => Number.parseFloat(value));
types.setTypeParser(20, (value) => Number.parseInt(value, 10));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  options: `-c TimeZone=${config.timezone}`,
});

pool.on('error', (err) => {
  console.error('[db] erreur inattendue sur un client inactif', err);
});

export function query(text, params) {
  return pool.query(text, params);
}

// Exécute `fn(client)` dans une transaction (COMMIT ou ROLLBACK automatique).
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
