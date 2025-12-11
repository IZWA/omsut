const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const https = require('https');
const http = require('http');

const { db, init, DB_PATH } = require('./db');

const JWT_SECRET = process.env.OMSUT_JWT_SECRET || 'change_this_secret';
const PORT = process.env.PORT || 3000;

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://omsut.fun/';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'omsut';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'omsut-client';

const app = express();

// Session store for Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Initialize Keycloak
const keycloakConfig = {
  'realm': KEYCLOAK_REALM,
  'auth-server-url': KEYCLOAK_URL,
  'ssl-required': 'external',
  'resource': KEYCLOAK_CLIENT_ID,
  'public-client': true,
  'confidential-port': 0
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// Use built-in express JSON parser
app.use(express.json());

// Basic CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Keycloak middleware
app.use(keycloak.middleware());

// prepare uploads directory
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });
app.use('/uploads', express.static(UPLOADS));

// Serve static frontend files
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
    const userId = req.kauth?.grant?.access_token?.content?.sub || req.userId || 'anon';
    cb(null, `${userId}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// init DB
init();

// Helper: authenticate with Keycloak or legacy JWT
function authenticate(req, res, next) {
  // Try Keycloak first
  if (req.kauth && req.kauth.grant) {
    const token = req.kauth.grant.access_token;
    req.keycloakUserId = token.content.sub;
    req.keycloakUsername = token.content.preferred_username;
    req.keycloakEmail = token.content.email;
    
    // Sync or get user from DB
    syncKeycloakUser(req, (err, userId) => {
      if (err) return res.status(500).json({ error: 'User sync error' });
      req.userId = userId;
      req.username = req.keycloakUsername;
      next();
    });
    return;
  }
  
  // Fallback to legacy JWT authentication
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

// Helper: sync Keycloak user to local DB
function syncKeycloakUser(req, callback) {
  const kcId = req.keycloakUserId;
  const username = req.keycloakUsername;
  const email = req.keycloakEmail;
  
  db.get('SELECT id FROM users WHERE keycloak_id = ?', [kcId], (err, row) => {
    if (err) return callback(err);
    if (row) return callback(null, row.id);
    
    // Create new user from Keycloak
    const stmt = db.prepare('INSERT INTO users (username, keycloak_id, display_name, password_hash) VALUES (?, ?, ?, ?)');
    stmt.run(username, kcId, username, '', function(err2) {
      if (err2) return callback(err2);
      callback(null, this.lastID);
    });
  });
}

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

function isAdminUsername(username) {
  const raw = process.env.OMSUT_ADMINS || '';
  if (!raw) return false;
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  return arr.includes(username);
}

// Keycloak login endpoint (redirects to Keycloak)
app.get('/api/auth/keycloak/login', keycloak.protect(), (req, res) => {
  res.json({ message: 'Authenticated with Keycloak', user: req.kauth.grant.access_token.content });
});

// Keycloak callback (handled by keycloak-connect middleware)
app.get('/api/auth/keycloak/callback', (req, res) => {
  res.redirect('/profile.html');
});

// Keycloak logout
app.get('/api/auth/keycloak/logout', (req, res) => {
  req.logout();
  res.redirect('/auth-keycloak.html');
});

// Get Keycloak config for frontend
app.get('/api/auth/keycloak/config', (req, res) => {
  res.json({
    url: KEYCLOAK_URL,
    realm: KEYCLOAK_REALM,
    clientId: KEYCLOAK_CLIENT_ID
  });
});

// Exchange Keycloak authorization code for JWT token
app.post('/api/auth/keycloak/exchange', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Authorization code required' });

  try {
    // Exchange code for Keycloak token
    const tokenUrl = `${KEYCLOAK_URL}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const redirectUri = `${req.protocol}://${req.get('host')}/profile.html`;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_CLIENT_ID,
      code: code,
      redirect_uri: redirectUri
    });

    const postData = params.toString();

    // Make HTTP request to Keycloak
    const tokenData = await new Promise((resolve, reject) => {
      const url = new URL(tokenUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const request = protocol.request(options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Invalid JSON response from Keycloak'));
            }
          } else {
            console.error('Keycloak token exchange failed:', response.statusCode, data);
            reject(new Error(`Keycloak returned ${response.statusCode}: ${data}`));
          }
        });
      });

      request.on('error', (e) => {
        console.error('Request to Keycloak failed:', e);
        reject(e);
      });

      request.write(postData);
      request.end();
    });
    
    // Decode the access token to get user info
    const accessToken = tokenData.access_token;
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    
    const username = payload.preferred_username || payload.sub;
    const email = payload.email;
    const displayName = payload.name || payload.preferred_username;

    console.log('Keycloak user authenticated:', username, displayName);

    // Check if user exists in our database, create if not
    let user = await new Promise((resolve, reject) => {
      db.get('SELECT id, username, display_name, photo_path FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      // Create new user from Keycloak data
      const insertResult = await new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)');
        stmt.run(username, displayName, '', function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, username, display_name: displayName });
        });
      });
      user = insertResult;
      console.log('New user created:', username);
    } else {
      console.log('Existing user logged in:', username);
    }

    // Generate our own JWT token for the user
    const jwtToken = generateToken({ id: user.id, username: user.username });
    
    res.json({ 
      token: jwtToken, 
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        photo: user.photo_path
      }
    });
  } catch (err) {
    console.error('Keycloak exchange error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Legacy Register (JWT)
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

// Legacy Login (JWT)
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

// Award badge to user
app.post('/api/users/:id/badges/:badgeId', authenticate, (req, res) => {
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

// Record game result (rest of the endpoints remain the same)
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
      
      db.get('SELECT * FROM user_stats WHERE user_id = ?', [uid], (err2, stats) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        
        if (!stats) {
          const initial = {
            user_id: uid,
            games_played: 1,
            games_won: won ? 1 : 0,
            current_streak: won ? 1 : 0,
            max_streak: won ? 1 : 0
          };
          db.run('INSERT INTO user_stats (user_id, games_played, games_won, current_streak, max_streak) VALUES (?, ?, ?, ?, ?)',
            [uid, 1, won ? 1 : 0, won ? 1 : 0, won ? 1 : 0],
            (err3) => {
              if (err3) return res.status(500).json({ error: 'DB error' });
              res.json({ ok: true, game_id: this.lastID });
            }
          );
        } else {
          const newStreak = won ? stats.current_streak + 1 : 0;
          const newMax = Math.max(stats.max_streak, newStreak);
          db.run('UPDATE user_stats SET games_played = games_played + 1, games_won = games_won + ?, current_streak = ?, max_streak = ? WHERE user_id = ?',
            [won ? 1 : 0, newStreak, newMax, uid],
            (err3) => {
              if (err3) return res.status(500).json({ error: 'DB error' });
              res.json({ ok: true, game_id: this.lastID });
            }
          );
        }
      });
    }
  );
});

// Get user stats
app.get('/api/stats/:userId', (req, res) => {
  const uid = parseInt(req.params.userId, 10);
  db.get('SELECT * FROM user_stats WHERE user_id = ?', [uid], (err, stats) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(stats || { user_id: uid, games_played: 0, games_won: 0, current_streak: 0, max_streak: 0 });
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  db.all(`
    SELECT u.id, u.username, u.display_name, u.photo_path, s.games_played, s.games_won, s.max_streak
    FROM user_stats s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.games_won DESC, s.max_streak DESC
    LIMIT ?
  `, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const results = rows.map(r => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      photo: r.photo_path ? `/uploads/${path.basename(r.photo_path)}` : null,
      games_played: r.games_played,
      games_won: r.games_won,
      max_streak: r.max_streak
    }));
    res.json(results);
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ ok: true, db: DB_PATH, keycloak: keycloakConfig });
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OMSUT server listening on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Keycloak: ${KEYCLOAK_URL} (realm: ${KEYCLOAK_REALM})`);
});
