// ASSIZE authoritative server — SQLite via bun:sqlite (spec §6 said better-sqlite3; the same
// SQLite engine under the bun runtime, zero native-build risk in this sandbox — documented in README).
import { Database } from 'bun:sqlite';

const db = new Database('/home/z/my-project/db/assize.db', { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  standing INTEGER NOT NULL DEFAULT 1000,
  recovery_hash TEXT,
  purchases TEXT NOT NULL DEFAULT '[]',
  flagged INTEGER NOT NULL DEFAULT 0,
  shadow INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  p0 TEXT, p1 TEXT,
  seed TEXT NOT NULL,
  tier TEXT NOT NULL,
  winner TEXT,
  reason TEXT,
  rating0 INTEGER, rating1 INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_results (
  date_key TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  mistakes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (date_key, account_id)
);
CREATE TABLE IF NOT EXISTS streaks (
  account_id TEXT PRIMARY KEY,
  last_date TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  best INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_time ON daily_results (date_key, time_ms);
`);

export const q = {
  getAccount: db.query('SELECT * FROM accounts WHERE id = ?'),
  insertAccount: db.query('INSERT INTO accounts (id, secret_hash, name, standing, recovery_hash, purchases, flagged, shadow, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)'),
  updateName: db.query('UPDATE accounts SET name = ? WHERE id = ?'),
  updateStanding: db.query('UPDATE accounts SET standing = ? WHERE id = ?'),
  updateRecovery: db.query('UPDATE accounts SET recovery_hash = ? WHERE id = ?'),
  updatePurchases: db.query('UPDATE accounts SET purchases = ? WHERE id = ?'),
  flag: db.query('UPDATE accounts SET flagged = 1 WHERE id = ?'),
  shadow: db.query('UPDATE accounts SET shadow = 1 WHERE id = ?'),
  byRecovery: db.query('SELECT * FROM accounts WHERE recovery_hash = ?'),
  insertDuel: db.query('INSERT INTO duels (id, mode, p0, p1, seed, tier, winner, reason, rating0, rating1, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  dailyUpsert: db.query(`INSERT INTO daily_results (date_key, account_id, name, time_ms, mistakes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (date_key, account_id) DO UPDATE SET time_ms = MIN(time_ms, excluded.time_ms), mistakes = MIN(mistakes, excluded.mistakes)`),
  dailyBoard: db.query('SELECT name, account_id, time_ms, mistakes FROM daily_results WHERE date_key = ? ORDER BY time_ms ASC LIMIT 100'),
  dailyRankOf: db.query('SELECT COUNT(*) + 1 AS rank FROM daily_results WHERE date_key = ? AND time_ms < (SELECT time_ms FROM daily_results WHERE date_key = ? AND account_id = ?)'),
  dailyBest: db.query('SELECT time_ms, mistakes FROM daily_results WHERE date_key = ? AND account_id = ?'),
  streakGet: db.query('SELECT * FROM streaks WHERE account_id = ?'),
  streakUpsert: db.query(`INSERT INTO streaks (account_id, last_date, streak, best) VALUES (?, ?, ?, ?)
    ON CONFLICT (account_id) DO UPDATE SET last_date = excluded.last_date, streak = excluded.streak, best = MAX(best, excluded.streak)`),
  telemetry: db.query('INSERT INTO telemetry (event, at) VALUES (?, ?)'),
};

export function hash(s: string): string {
  return new Bun.CryptoHasher('sha256').update(`assize:${s}`).digest('hex');
}

export function adjustRating(a: number, b: number, scoreA: number): { a: number; b: number; da: number } {
  const kA = a >= 1600 ? 20 : 32;
  const kB = b >= 1600 ? 20 : 32;
  const expectedA = 1 / (1 + 10 ** ((b - a) / 400));
  const expectedB = 1 - expectedA;
  const da = Math.round(kA * (scoreA - expectedA));
  const dB = Math.round(kB * ((1 - scoreA) - expectedB));
  return { a: Math.max(100, a + da), b: Math.max(100, b + dB), da };
}

export const todayKey = (d = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
