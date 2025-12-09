const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { db, init, DB_PATH } = require('./db');

const JWT_SECRET = process.env.OMSUT_JWT_SECRET || 'change_this_secret';
const PORT = process.env.PORT || 3000;

const app = express();
// Use built-in express JSON parser instead of body-parser
app.use(express.json());
// Basic CORS so frontend served from a different port can talk to the API during development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// prepare uploads directory
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });
app.use('/uploads', express.static(UPLOADS));

// Serve static frontend files (parent directory) in production
const FRONTEND = path.join(__dirname, '..');
app.use(express.static(FRONTEND, {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.userId || 'anon'}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// init DB
init();

// simple helpers
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Bad Authorization' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.username = payload.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function isAdminUsername(username) {
  const raw = process.env.OMSUT_ADMINS || '';
  if (!raw) return false;
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  return arr.includes(username);
}

// Register
app.post('/api/register', async (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const hash = await bcrypt.hash(password, 10);
  const stmt = db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)');
  stmt.run(username, hash, displayName || null, function(err) {
    if (err) return res.status(400).json({ error: 'User exists or DB error', details: err.message });
    const user = { id: this.lastID, username, display_name: displayName || null };
    const token = generateToken(user);
    res.json({ user, token });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  db.get('SELECT id, username, password_hash, display_name, photo_path FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const user = { id: row.id, username: row.username, display_name: row.display_name, photo_path: row.photo_path };
    const token = generateToken(user);
    res.json({ user, token });
  });
});

// Get profile
app.get('/api/profile', authenticate, (req, res) => {
  const uid = req.userId;
  db.get('SELECT id, username, display_name, photo_path, created_at FROM users WHERE id = ?', [uid], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'User not found' });
    db.all('SELECT b.id, b.name, b.description, ub.earned_at FROM user_badges ub JOIN badges b ON ub.badge_id = b.id WHERE ub.user_id = ?', [uid], (err2, badges) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      const photoUrl = row.photo_path ? `/uploads/${path.basename(row.photo_path)}` : null;
      const isAdmin = isAdminUsername(row.username);
      res.json({ id: row.id, username: row.username, display_name: row.display_name, photo: photoUrl, created_at: row.created_at, badges, isAdmin });
    });
  });
});

// Update profile (display_name)
app.put('/api/profile', authenticate, (req, res) => {
  const uid = req.userId;
  const { display_name } = req.body || {};
  db.run('UPDATE users SET display_name = ? WHERE id = ?', [display_name || null, uid], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

// Upload photo
app.post('/api/profile/photo', authenticate, upload.single('photo'), (req, res) => {
  const uid = req.userId;
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const filePath = req.file.path;
  db.run('UPDATE users SET photo_path = ? WHERE id = ?', [filePath, uid], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    const photoUrl = `/uploads/${path.basename(filePath)}`;
    res.json({ ok: true, photo: photoUrl });
  });
});

// Award badge to user (admin-like endpoint; in real app protect it)
app.post('/api/users/:id/badges/:badgeId', authenticate, (req, res) => {
  // protect this endpoint: only admin usernames from OMSUT_ADMINS can award
  if (!isAdminUsername(req.username)) return res.status(403).json({ error: 'Admin only' });
  const uid = parseInt(req.params.id, 10);
  const badgeId = parseInt(req.params.badgeId, 10);
  db.run('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)', [uid, badgeId], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

// list badges
app.get('/api/badges', (req, res) => {
  db.all('SELECT id, name, description FROM badges ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// find user id by username
app.get('/api/users/by-username', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username required' });
  db.get('SELECT id, username, display_name FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// Record game result
app.post('/api/games', authenticate, (req, res) => {
  const uid = req.userId;
  const { mode, word, won, tries_used, time_seconds } = req.body || {};
  
  if (mode === undefined || word === undefined || won === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  db.run('INSERT INTO games (user_id, mode, word, won, tries_used, time_seconds) VALUES (?, ?, ?, ?, ?, ?)',
    [uid, mode, word, won ? 1 : 0, tries_used || null, time_seconds || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ ok: true, gameId: this.lastID });
    });
});

// Get user stats
app.get('/api/profile/stats', authenticate, (req, res) => {
  const uid = req.userId;
  db.get('SELECT * FROM user_stats WHERE user_id = ?', [uid], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.json({ user_id: uid, total_games: 0, wins: 0, current_streak: 0, best_streak: 0 });
    res.json(row);
  });
});

// Award badge (auto-called after win)
app.post('/api/profile/award-badge', authenticate, (req, res) => {
  const uid = req.userId;
  const { badgeName } = req.body || {};
  if (!badgeName) return res.status(400).json({ error: 'badge name required' });

  db.get('SELECT id FROM badges WHERE name = ?', [badgeName], (err, badge) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!badge) return res.status(404).json({ error: 'Badge not found' });

    db.run('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)', [uid, badge.id], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ ok: true });
    });
  });
});

// Global leaderboard (top wins)
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  db.all(`
    SELECT u.id, u.username, u.display_name, s.wins, s.current_streak, s.best_streak, s.best_time_seconds
    FROM user_stats s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.wins DESC
    LIMIT ?
  `, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Global stats (for dashboard)
app.get('/api/stats', (req, res) => {
  db.get(`
    SELECT 
      COUNT(DISTINCT user_id) as total_users,
      COUNT(*) as total_games,
      SUM(won) as total_wins
    FROM games
  `, [], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(row || { total_users: 0, total_games: 0, total_wins: 0 });
  });
});

// List all users (admin only)
app.get('/api/admin/users', authenticate, (req, res) => {
  if (!isAdminUsername(req.username)) return res.status(403).json({ error: 'Admin only' });
  
  db.all(`
    SELECT u.id, u.username, u.display_name, u.created_at, COUNT(ub.badge_id) as badge_count, s.wins, s.total_games
    FROM users u
    LEFT JOIN user_badges ub ON u.id = ub.user_id
    LEFT JOIN user_stats s ON u.id = s.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Simple status
app.get('/api/status', (req, res) => res.json({ ok: true, db: DB_PATH }));

// Fallback: serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OMSUT server listening on http://localhost:${PORT}`);
});

