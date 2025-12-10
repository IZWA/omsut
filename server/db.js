const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'omsut.db');

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDb();
const db = new sqlite3.Database(DB_PATH);

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      photo_path TEXT,
      keycloak_id TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_badges (
      user_id INTEGER,
      badge_id INTEGER,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, badge_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (badge_id) REFERENCES badges(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      mode TEXT,
      word TEXT,
      won INTEGER,
      tries_used INTEGER,
      time_seconds INTEGER,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      total_games INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      daily_current_streak INTEGER DEFAULT 0,
      daily_best_streak INTEGER DEFAULT 0,
      free_current_streak INTEGER DEFAULT 0,
      free_best_streak INTEGER DEFAULT 0,
      best_time_seconds INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Insert some example badges if not exist
    const badges = [
      { name: 'First Win', description: 'Gagné une partie' },
      { name: 'Streak 3', description: '3 victoires consécutives' },
      { name: 'Streak 5', description: '5 victoires consécutives' },
      { name: 'Speed Runner', description: 'Victoire en moins de 30 secondes' },
      { name: 'Explorer', description: 'Joué en mode Libre' }
    ];
    const stmt = db.prepare(`INSERT OR IGNORE INTO badges (name, description) VALUES (?, ?)`);
    badges.forEach(b => stmt.run(b.name, b.description));
    stmt.finalize();
  });
}

module.exports = { db, init, DB_PATH };
