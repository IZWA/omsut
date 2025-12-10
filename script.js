// Paramètres du jeu
const MIN_WORD_LENGTH = 4;
let WORD_LENGTH = 6; // sera mis à jour dynamiquement selon le mot choisi
const MAX_WORD_LENGTH = 10;
const MAX_TRIES = 6;

// Liste de mots et mot secret (sera chargé depuis words.txt)
let WORDS = [];
let SECRET = "";
// Migration helper: copy old motus_* keys to omsut_* on first run
function migrateOldKeys() {
  const mapping = {
    motus_mode: 'omsut_mode',
    motus_dailyStreak: 'omsut_dailyStreak',
    motus_bestDailyStreak: 'omsut_bestDailyStreak',
    motus_lastDailyPlayed: 'omsut_lastDailyPlayed'
  };
  Object.keys(mapping).forEach((oldKey) => {
    try {
      const newKey = mapping[oldKey];
      const val = localStorage.getItem(oldKey);
      const existsNew = localStorage.getItem(newKey);
      if (val !== null && (existsNew === null || existsNew === undefined)) {
        localStorage.setItem(newKey, val);
      }
      // remove old key to avoid future confusion
      if (val !== null) localStorage.removeItem(oldKey);
    } catch (err) {
      // ignore storage errors
      console.warn('Migration storage error', err);
    }
  });
}

// Run migration before reading any omsut_ keys
migrateOldKeys();

// Check if mode is forced by the page (daily.html or free.html)
let gameMode = window.FORCED_MODE || localStorage.getItem("omsut_mode") || "daily"; // 'daily' or 'free'
// If mode is forced, save it to localStorage
if (window.FORCED_MODE) {
  localStorage.setItem("omsut_mode", window.FORCED_MODE);
}

let currentTry = 0;
let isGameOver = false;
let dailyStreak = parseInt(localStorage.getItem("omsut_dailyStreak") || "0", 10) || 0;
let bestStreak = parseInt(localStorage.getItem("omsut_bestDailyStreak") || "0", 10) || 0;
// active column starts at 1 because column 0 is fixed (first letter)
let activeCol = 1;
// track which positions have been discovered as correct; true => auto-prefill on each new row
let discoveredPositions = [];
// Track game start time for speed badges
let gameStartTime = null;

const gridElement = document.getElementById("grid");
// no separate input element: typing is done directly in the grid
const messageEl = document.getElementById("message");
const wordLengthEl = document.getElementById("word-length");
const currentTryEl = document.getElementById("current-try");
const maxTriesEl = document.getElementById("max-tries");
const dailyStreakEl = document.getElementById("daily-streak");
const bestStreakEl = document.getElementById("best-streak");

// no submit button to disable

// --- Initialisation de la grille ---
function initGrid() {
  // vider la grille existante
  gridElement.innerHTML = "";
  for (let row = 0; row < MAX_TRIES; row++) {
    for (let col = 0; col < WORD_LENGTH; col++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.row = row;
      cell.dataset.col = col;
      // make cells focusable for direct typing (will be enabled for current row)
      cell.tabIndex = -1;
      // if this is the first column, prefill the letter and lock it
      if (col === 0) {
        cell.classList.add('fixed');
        cell.textContent = SECRET ? SECRET[0] : '';
        cell.tabIndex = -1;
      }
      cell.addEventListener('click', () => {
        // only allow clicking into the active row
        if (parseInt(cell.dataset.row, 10) === currentTry && !isGameOver) {
          setActiveCol(parseInt(cell.dataset.col, 10));
        }
      });
      gridElement.appendChild(cell);
    }
  }
}

// Message initial
setMessage("Chargement de la liste de mots...");

// Charge words.txt et initialise WORDS + SECRET
async function loadWords() {
  try {
    const res = await fetch("words.txt");
    if (!res.ok) throw new Error("fetch failed");
    const text = await res.text();
    const arr = text
      .split(/\r?\n/)
      .map((w) => w.trim())
      .map((w) => {
        // Normaliser : majuscules, retirer accents/diacritiques
        const up = w.toUpperCase();
        const cleaned = up.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cleaned;
      })
      .filter((w) => w.length >= MIN_WORD_LENGTH && w.length <= MAX_WORD_LENGTH)
      .filter((w) => /^[A-Z]+$/.test(w));
    WORDS = Array.from(new Set(arr));
  } catch (err) {
    // Fallback minimal list si fetch échoue
    WORDS = [
      "ORAGES",
      "POMMES",
      "AVIONS",
      "CAMION",
      "JARDIN",
      "PLAGES",
    ];
    console.warn("Impossible de charger words.txt, utilisation d'une liste de secours.", err);
  }

  if (!WORDS || WORDS.length === 0) {
    WORDS = ["ORAGES", "POMMES", "AVIONS", "CAMION", "JARDIN", "PLAGES"];
  }

  // Choisir le mot selon le mode (daily/free)
  chooseSecretForMode();

  // initialize discovered positions so first letter is known and others will be filled when discovered
  discoveredPositions = new Array(WORD_LENGTH).fill(false);
  if (WORD_LENGTH > 0) discoveredPositions[0] = true;

  // no separate input element; grid cells control length

  // Initialiser la grille selon la longueur déterminée
  initGrid();

  // enable typing in the current row (prefill discovered letters)
  setEditableRow(currentTry);

  // render keyboard (neutral keys) - do not dim letters here
  renderKeyboard();

  // Définir la variable CSS pour que la grille s'adapte en CSS
  if (gridElement && gridElement.style) {
    gridElement.style.setProperty("--word-length", WORD_LENGTH);
  }

  // no submit button to enable
  // Mettre à jour les éléments d'état affichés
  if (wordLengthEl) wordLengthEl.textContent = WORD_LENGTH;
  if (maxTriesEl) maxTriesEl.textContent = MAX_TRIES;
  if (currentTryEl) currentTryEl.textContent = currentTry + 1;

  // update streak UI immediately
  updateStreakUI();

  // If daily and already played today, block play
  checkDailyPlayed();
  // show/hide 'Nouveau mot' according to mode on initial load
  showNewWordButton(gameMode === 'free');

  setMessage(`Essai ${currentTry + 1} sur ${MAX_TRIES}`);
  console.log("Mot secret :", SECRET);
}


// Debug : pour vérifier en console
console.log("Mot secret :", SECRET);

// Normalize helper (already performed on load but useful for inputs)
function normalizeWord(s) {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function updateStreakUI() {
  // Check if user is logged in
  const token = (typeof getToken === 'function') ? getToken() : localStorage.getItem('omsut_token');
  if (!token) {
    // Not logged in, show 0
    if (dailyStreakEl) dailyStreakEl.textContent = '0';
    if (bestStreakEl) bestStreakEl.textContent = '0';
    return;
  }
  
  try {
    const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
    const res = await fetch(API_BASE + '/api/profile/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!res.ok) throw new Error('Failed to fetch stats');
    const stats = await res.json();
    
    // Display streak based on current mode
    if (gameMode === 'daily') {
      if (dailyStreakEl) dailyStreakEl.textContent = stats.daily_current_streak || 0;
      if (bestStreakEl) bestStreakEl.textContent = stats.daily_best_streak || 0;
    } else {
      if (dailyStreakEl) dailyStreakEl.textContent = stats.free_current_streak || 0;
      if (bestStreakEl) bestStreakEl.textContent = stats.free_best_streak || 0;
    }
  } catch (err) {
    console.warn('Error loading streak stats:', err);
    if (dailyStreakEl) dailyStreakEl.textContent = '0';
    if (bestStreakEl) bestStreakEl.textContent = '0';
  }
}

function checkDailyPlayed() {
  if (gameMode !== "daily") {
    return false;
  }
  const last = localStorage.getItem("omsut_lastDailyPlayed") || "";
  const today = getTodayStr();
  if (last === today) {
    isGameOver = true;
    setMessage("Vous avez déjà joué aujourd'hui, revenez demain !", true);
    updateStreakUI();
    return true;
  }
  // not played today
  isGameOver = false;
  return false;
}

function chooseSecretForMode() {
  if (!WORDS || WORDS.length === 0) return;

  if (gameMode === "daily") {
    // Deterministic index based on date (days since epoch)
    const epoch = new Date(Date.UTC(2022, 0, 1));
    const today = new Date();
    const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - epoch.getTime()) / 86400000);
    // Use a sorted stable list so everyone gets the same daily word
    const pool = WORDS.slice().sort();
    const idx = days % pool.length;
    SECRET = pool[idx];
  } else {
    // free mode: pick random
    SECRET = WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  WORD_LENGTH = SECRET.length;
}

function resetGame(preserveMode = true) {
  // reset state
  currentTry = 0;
  isGameOver = false;
  gameStartTime = Date.now(); // Start timer for speed badge
  // choose new secret according to current mode
  chooseSecretForMode();

  // reset discovered positions (first letter is always revealed)
  discoveredPositions = new Array(WORD_LENGTH).fill(false);
  if (WORD_LENGTH > 0) discoveredPositions[0] = true;

  // update UI (no separate input element)

  // rebuild grid and css var
  initGrid();
  if (gridElement && gridElement.style) gridElement.style.setProperty("--word-length", WORD_LENGTH);

  // render keyboard (neutral keys)
  renderKeyboard();

  // enable typing in the current row
  setEditableRow(currentTry);

  // update status
  if (wordLengthEl) wordLengthEl.textContent = WORD_LENGTH;
  if (maxTriesEl) maxTriesEl.textContent = MAX_TRIES;
  if (currentTryEl) currentTryEl.textContent = currentTry + 1;

  // update streak UI
  updateStreakUI();

  setMessage(`Essai ${currentTry + 1} sur ${MAX_TRIES}`);
  console.log("Mot secret :", SECRET);

  // If daily and already played today, block play
  checkDailyPlayed();

  // hide replay button when a new game starts
  showReplayButton(false);

  // show/hide new-word button depending on current mode
  showNewWordButton(gameMode === 'free');
}

// Mode UI handlers
const modeDailyEl = document.getElementById("mode-daily");
const modeFreeEl = document.getElementById("mode-free");

// keyboard element
const keyboardEl = document.getElementById("keyboard");
const replayBtn = document.getElementById('replay-btn');
const newWordBtn = document.getElementById('new-word-btn');

function showReplayButton(show) {
  if (!replayBtn) return;
  replayBtn.style.display = show ? 'inline-block' : 'none';
}

function showNewWordButton(show) {
  if (!newWordBtn) return;
  newWordBtn.style.display = show ? 'inline-block' : 'none';
}

if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    // ensure we're in free mode and start a new free game
    gameMode = 'free';
    localStorage.setItem('omsut_mode', 'free');
    resetGame();
    showReplayButton(false);
  });
}

if (newWordBtn) {
  newWordBtn.addEventListener('click', async () => {
    if (gameMode !== 'free') {
      setMessage('Bouton "Nouveau mot" disponible uniquement en mode Libre.', true);
      return;
    }
    // ask for confirmation before resetting the current free game
    const ok = window.confirm('Voulez-vous vraiment changer de mot ? Votre progression actuelle et votre streak seront réinitialisés.');
    if (!ok) return;
    
    // Reset free mode streak on server
    const token = (typeof getToken === 'function') ? getToken() : localStorage.getItem('omsut_token');
    if (token) {
      try {
        const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
        await fetch(API_BASE + '/api/profile/reset-free-streak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });
      } catch (err) {
        console.warn('Failed to reset free streak:', err);
      }
    }
    
    // start a fresh free game with a new secret
    resetGame();
    setMessage('Nouveau mot généré — bonne chance !');
    showReplayButton(false);
  });
}

function renderKeyboard() {
  if (!keyboardEl) return;
  keyboardEl.innerHTML = "";
  
  // Ajouter les lettres A-Z
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    const k = document.createElement("div");
    k.className = "key";
    k.dataset.letter = ch;
    k.textContent = ch;
    
    // Gérer les clics/touches sur le clavier virtuel
    k.addEventListener('click', (e) => {
      e.preventDefault();
      handleVirtualKeyPress(ch);
    });
    
    // Améliorer le feedback tactile
    k.addEventListener('touchstart', (e) => {
      e.preventDefault();
      k.style.opacity = '0.7';
    });
    
    k.addEventListener('touchend', (e) => {
      e.preventDefault();
      k.style.opacity = '1';
      handleVirtualKeyPress(ch);
    });
    
    keyboardEl.appendChild(k);
  }
  
  // Ajouter le bouton Backspace
  const backspaceKey = document.createElement("div");
  backspaceKey.className = "key key-special";
  backspaceKey.textContent = "⌫";
  backspaceKey.style.gridColumn = "span 2";
  backspaceKey.addEventListener('click', (e) => {
    e.preventDefault();
    handleVirtualBackspace();
  });
  backspaceKey.addEventListener('touchstart', (e) => {
    e.preventDefault();
    backspaceKey.style.opacity = '0.7';
  });
  backspaceKey.addEventListener('touchend', (e) => {
    e.preventDefault();
    backspaceKey.style.opacity = '1';
    handleVirtualBackspace();
  });
  keyboardEl.appendChild(backspaceKey);
  
  // Ajouter le bouton Enter
  const enterKey = document.createElement("div");
  enterKey.className = "key key-special";
  enterKey.textContent = "✓";
  enterKey.style.gridColumn = "span 2";
  enterKey.style.background = "#2d5016";
  enterKey.addEventListener('click', (e) => {
    e.preventDefault();
    handleVirtualEnter();
  });
  enterKey.addEventListener('touchstart', (e) => {
    e.preventDefault();
    enterKey.style.opacity = '0.7';
  });
  enterKey.addEventListener('touchend', (e) => {
    e.preventDefault();
    enterKey.style.opacity = '1';
    handleVirtualEnter();
  });
  keyboardEl.appendChild(enterKey);
}

// Gérer les touches du clavier virtuel
function handleVirtualKeyPress(ch) {
  if (isGameOver) return;
  if (gameMode === 'daily') {
    const last = localStorage.getItem('omsut_lastDailyPlayed') || '';
    if (last === getTodayStr()) return;
  }
  
  const cell = getCell(currentTry, activeCol);
  if (!cell) return;
  cell.textContent = ch;
  
  const next = nextEditableCol(currentTry, activeCol);
  if (next !== null) setActiveCol(next);
}

function handleVirtualBackspace() {
  if (isGameOver) return;
  if (gameMode === 'daily') {
    const last = localStorage.getItem('omsut_lastDailyPlayed') || '';
    if (last === getTodayStr()) return;
  }
  
  const cell = getCell(currentTry, activeCol);
  
  // Si la cellule actuelle a du texte, la vider (y compris préremplies)
  if (cell && cell.textContent) {
    cell.textContent = '';
    // Restaurer les préremplies après un court délai si la ligne est vide
    setTimeout(() => restorePrefilledLetters(currentTry), 50);
    return;
  }
  
  // Sinon, aller à gauche et vider
  const prevCol = prevEditableCol(currentTry, activeCol);
  if (prevCol !== null) {
    setActiveCol(prevCol);
    const prev = getCell(currentTry, prevCol);
    if (prev) {
      prev.textContent = '';
      // Restaurer les préremplies après un court délai
      setTimeout(() => restorePrefilledLetters(currentTry), 50);
    }
  }
}

function handleVirtualEnter() {
  if (isGameOver) return;
  if (gameMode === 'daily') {
    const last = localStorage.getItem('omsut_lastDailyPlayed') || '';
    if (last === getTodayStr()) return;
  }
  
  const guess = getRowText(currentTry);
  if (guess.length !== WORD_LENGTH) {
    setMessage(`Le mot doit faire ${WORD_LENGTH} lettres.`, true);
    return;
  }
  if (WORDS.length > 0 && !WORDS.includes(normalizeWord(guess))) {
    setMessage('Mot inconnu dans la liste de mots.', true);
    return;
  }
  
  checkGuess(guess);
  if (!isGameOver) {
    setEditableRow(currentTry);
  }
}

function updateKeyboard() {
  // Intentionally left blank: we don't dim keys globally on load.
  // Letters will be marked only when the user guesses (see markKeyboardFromGuess).
  return;
}

function markKeyboardFromGuess(guess, result) {
  // result is array of 'correct'|'present'|'absent'
  if (!keyboardEl) return;
  for (let i = 0; i < guess.length; i++) {
    const L = guess[i].toUpperCase();
    const key = keyboardEl.querySelector(`.key[data-letter="${L}"]`);
    if (!key) continue;
    key.classList.remove("dim");
    if (result[i] === "correct") {
      key.classList.remove("present", "absent");
      key.classList.add("correct");
    } else if (result[i] === "present") {
      // only upgrade to present if not already correct
      if (!key.classList.contains("correct")) {
        key.classList.remove("absent");
        key.classList.add("present");
      }
    } else if (result[i] === "absent") {
      if (!key.classList.contains("correct") && !key.classList.contains("present")) {
        key.classList.add("absent");
      }
    }
  }
}

function setActiveCol(col) {
  // move focus/active column within current row
  const prev = getCell(currentTry, activeCol);
  if (prev) prev.classList.remove('focused');
  // never allow activeCol to be 0 (fixed first letter)
  activeCol = Math.max(1, Math.min(col, WORD_LENGTH - 1));
  const cell = getCell(currentTry, activeCol);
  if (cell) {
    cell.classList.add('focused');
    cell.tabIndex = 0;
    cell.focus();
  }
}

function setEditableRow(row) {
  // disable all cells first
  if (!gridElement) return;
  gridElement.querySelectorAll('.cell').forEach((c) => {
    c.classList.remove('editable', 'focused');
    c.tabIndex = -1;
  });
  // enable the given row
  for (let col = 0; col < WORD_LENGTH; col++) {
    const c = getCell(row, col);
    if (!c) continue;
    // keep the first column fixed and prefilled with secret's first letter
    if (col === 0) {
      c.classList.add('fixed');
      c.tabIndex = -1;
      c.textContent = SECRET ? SECRET[0] : c.textContent || '';
      continue;
    }
    // if this position has been discovered previously, prefill it in every new row
    if (discoveredPositions[col]) {
      c.classList.add('prefilled');
      c.classList.add('editable');
      c.tabIndex = 0;
      c.textContent = SECRET ? SECRET[col] : c.textContent || '';
      continue;
    }
    c.classList.add('editable');
    c.tabIndex = 0;
    c.textContent = c.textContent || '';
  }
  // start editing at the first editable (non-fixed) column
  // Prefer the first editable AND empty cell; otherwise pick the first editable cell
  let firstEditable = null;
  // 1) find first non-fixed empty cell
  for (let cc = 0; cc < WORD_LENGTH; cc++) {
    const cx = getCell(row, cc);
    if (!cx) continue;
    if (!cx.classList.contains('fixed') && (!cx.textContent || cx.textContent.trim() === '')) {
      firstEditable = cc;
      break;
    }
  }
  // 2) if none empty, pick first non-fixed cell
  if (firstEditable === null) {
    for (let cc = 0; cc < WORD_LENGTH; cc++) {
      const cx = getCell(row, cc);
      if (!cx) continue;
      if (!cx.classList.contains('fixed')) {
        firstEditable = cc;
        break;
      }
    }
  }
  // 3) fallback to last column if still null
  if (firstEditable === null) firstEditable = Math.max(0, WORD_LENGTH - 1);
  activeCol = Math.max(1, firstEditable);
  setActiveCol(activeCol);
}

function getCell(row, col) {
  return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

// find the next editable column (to the right) in a row, skipping fixed cells
function nextEditableCol(row, fromCol, requireEmpty = true) {
  for (let c = fromCol + 1; c < WORD_LENGTH; c++) {
    const cell = getCell(row, c);
    if (!cell) continue;
    if (cell.classList.contains('fixed')) continue;
    // if requireEmpty is false, accept any editable cell
    if (!requireEmpty) return c;
    // otherwise only consider empty cells
    if (!cell.textContent || cell.textContent.trim() === '') return c;
  }
  return null;
}

// find the previous editable column (to the left) in a row, skipping fixed cells
function prevEditableCol(row, fromCol) {
  for (let c = fromCol - 1; c >= 0; c--) {
    const cell = getCell(row, c);
    if (!cell) continue;
    if (!cell.classList.contains('fixed')) return c;
  }
  return null;
}

// Restore prefilled letters for discovered positions
function restorePrefilledLetters(row) {
  for (let col = 0; col < WORD_LENGTH; col++) {
    if (discoveredPositions[col]) {
      const cell = getCell(row, col);
      if (cell && (!cell.textContent || cell.textContent.trim() === '')) {
        cell.textContent = SECRET ? SECRET[col] : '';
      }
    }
  }
}

function getRowText(row) {
  let s = '';
  for (let col = 0; col < WORD_LENGTH; col++) {
    const c = getCell(row, col);
    s += (c && c.textContent) ? c.textContent : '';
  }
  return s;
}

// handle keyboard events for typing directly into the grid
document.addEventListener('keydown', (e) => {
  if (isGameOver) return;
  // if daily mode and already played, ignore
  if (gameMode === 'daily') {
    const last = localStorage.getItem('omsut_lastDailyPlayed') || '';
    if (last === getTodayStr()) return;
  }

  const key = e.key;
  
  // Navigation avec flèches gauche/droite
  if (key === 'ArrowLeft') {
    e.preventDefault();
    const prevCol = prevEditableCol(currentTry, activeCol);
    if (prevCol !== null) setActiveCol(prevCol);
    return;
  }
  
  if (key === 'ArrowRight') {
    e.preventDefault();
    const next = nextEditableCol(currentTry, activeCol, false);
    if (next !== null) setActiveCol(next);
    return;
  }
  
  if (/^[a-zA-Z]$/.test(key)) {
    e.preventDefault();
    // place letter at activeCol in current row
    const ch = key.toUpperCase();
    const cell = getCell(currentTry, activeCol);
    if (!cell) return;
    cell.textContent = ch;
    // move right to next empty cell if possible
    const next = nextEditableCol(currentTry, activeCol);
    if (next !== null) setActiveCol(next);
    return;
  }

  if (key === 'Backspace') {
    e.preventDefault();
    const cell = getCell(currentTry, activeCol);
    
    // Si la cellule actuelle a du texte, la vider (y compris préremplies)
    if (cell && cell.textContent) {
      cell.textContent = '';
      // Restaurer les préremplies après un court délai si la ligne est vide
      setTimeout(() => restorePrefilledLetters(currentTry), 50);
      return;
    }
    
    // Sinon, aller à gauche et vider
    const prevCol = prevEditableCol(currentTry, activeCol);
    if (prevCol !== null) {
      setActiveCol(prevCol);
      const prev = getCell(currentTry, prevCol);
      if (prev) {
        prev.textContent = '';
        // Restaurer les préremplies après un court délai
        setTimeout(() => restorePrefilledLetters(currentTry), 50);
      }
    }
    return;
  }

  if (key === 'Enter') {
    e.preventDefault();
    // submit current row if filled
    const guess = getRowText(currentTry);
    if (guess.length !== WORD_LENGTH) {
      setMessage(`Le mot doit faire ${WORD_LENGTH} lettres.`, true);
      return;
    }
    if (WORDS.length > 0 && !WORDS.includes(normalizeWord(guess))) {
      setMessage('Mot inconnu dans la liste de mots.', true);
      return;
    }
    // run check
    checkGuess(guess);
    // if game not over, prepare next row
    if (!isGameOver) {
      setEditableRow(currentTry);
    }
    return;
  }
});

function setMode(m) {
  // Don't allow mode changes if mode is forced by the page
  if (window.FORCED_MODE) {
    return;
  }
  gameMode = m;
  localStorage.setItem("omsut_mode", m);
  // reset game when changing mode
  resetGame();
}

// Only show mode toggles if mode is not forced
if (modeDailyEl && modeFreeEl && !window.FORCED_MODE) {
  // initialize mode UI from saved mode
  if (gameMode === "daily") modeDailyEl.checked = true;
  else modeFreeEl.checked = true;

  modeDailyEl.addEventListener("change", () => {
    if (modeDailyEl.checked) setMode("daily");
  });
  modeFreeEl.addEventListener("change", () => {
    if (modeFreeEl.checked) setMode("free");
  });
}

// debug reset removed

// Lancer le chargement (asynchrone)
loadWords();

// --- Affiche un message ---
function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#ff6b6b" : "#f5f5f5";
}

// --- Record game result and award badges ---
async function recordGameAndCheckBadges(won, triesUsed, timeSeconds) {
  try {
    // Check if user is logged in via auth-helper
    const token = (typeof getToken === 'function') ? getToken() : localStorage.getItem('omsut_token');
    if (!token) return; // Not logged in, no need to record
    
    const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
    
    // Record the game
    const gameRes = await fetch(API_BASE + '/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        mode: gameMode,
        word: SECRET,
        won: won ? 1 : 0,
        tries_used: triesUsed,
        time_seconds: timeSeconds
      })
    });
    
    if (!gameRes.ok) return;
    
    // Get updated stats from response
    const gameData = await gameRes.json();
    const updatedStats = gameData.stats;
    
    // Update streak display in the UI
    if (updatedStats) {
      await updateStreakUI();
    }
    
    // If won, check for badge eligibility and award them
    if (won) {
      const badgesToAward = [];
      
      // First Win badge
      const statsRes = await fetch(API_BASE + '/api/profile/stats', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (stats.wins === 0) badgesToAward.push('First Win');
      }
      
      // Streak badges - use the correct streak based on mode
      const dailyStreak = updatedStats ? updatedStats.daily_current_streak : 0;
      if (dailyStreak >= 3) badgesToAward.push('Streak 3');
      if (dailyStreak >= 5) badgesToAward.push('Streak 5');
      
      // Speed Runner badge
      if (timeSeconds && timeSeconds < 30) badgesToAward.push('Speed Runner');
      
      // Award all badges
      for (const badgeName of badgesToAward) {
        await fetch(API_BASE + '/api/profile/award-badge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ badgeName })
        }).catch(err => console.warn('Badge award failed', err));
      }
    }
  } catch (err) {
    console.warn('Record game error', err);
  }
}

// --- Vérifie et colorie une proposition ---
function checkGuess(guess) {
  const upperGuess = normalizeWord(guess);
  const upperSecret = SECRET.toUpperCase();

  const result = new Array(WORD_LENGTH).fill("absent");
  const secretLetters = upperSecret.split("");

  // 1. Marquer les lettres correctes (bien placées)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (upperGuess[i] === upperSecret[i]) {
      result[i] = "correct";
      secretLetters[i] = null; // on "retire" cette lettre
    }
  }

  // 2. Marquer les lettres présentes mais mal placées
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const indexInSecret = secretLetters.indexOf(upperGuess[i]);
    if (indexInSecret !== -1) {
      result[i] = "present";
      secretLetters[indexInSecret] = null;
    }
  }

  // 3. Mise à jour de la grille pour la ligne actuelle
  for (let col = 0; col < WORD_LENGTH; col++) {
    const cell = document.querySelector(
      `.cell[data-row="${currentTry}"][data-col="${col}"]`
    );
    cell.textContent = upperGuess[col];
    cell.classList.add(result[col]);
  }

  // Update keyboard visual from this guess
  markKeyboardFromGuess(upperGuess, result);

  // 4. Gérer fin de partie
  if (upperGuess === upperSecret) {
    isGameOver = true;
    setMessage(`Bravo ! Le mot était bien ${SECRET}.`);
    // afficher l'essai courant (l'utilisateur vient de réussir cet essai)
    if (currentTryEl) currentTryEl.textContent = currentTry + 1;
    
    // Record win and award badges
    const endTime = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : null;
    recordGameAndCheckBadges(true, currentTry + 1, endTime).catch(err => console.warn('Badge award error', err));
    
    // daily mode: update streak and mark as played today
    if (gameMode === "daily") {
      const today = getTodayStr();
      // increment streak
      dailyStreak = (parseInt(localStorage.getItem("omsut_dailyStreak") || "0", 10) || 0) + 1;
      localStorage.setItem("omsut_dailyStreak", String(dailyStreak));
      // update best
      bestStreak = Math.max(dailyStreak, parseInt(localStorage.getItem("omsut_bestDailyStreak") || "0", 10) || 0);
      localStorage.setItem("omsut_bestDailyStreak", String(bestStreak));
      // mark played today
      localStorage.setItem("omsut_lastDailyPlayed", today);
      updateStreakUI();
      // block further input via isGameOver
      isGameOver = true;
    }
    // show replay button for free-mode games
    if (isGameOver && gameMode === 'free') showReplayButton(true);
  } else if (currentTry === MAX_TRIES - 1) {
    isGameOver = true;
    setMessage(`Perdu 😅 Le mot était ${SECRET}.`);
    
    // Record loss
    const endTime = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : null;
    recordGameAndCheckBadges(false, MAX_TRIES, endTime).catch(err => console.warn('Game record error', err));
    
    // dernier essai
    if (currentTryEl) currentTryEl.textContent = MAX_TRIES;
    // daily mode: reset streak and mark as played today
    if (gameMode === "daily") {
      const today = getTodayStr();
      dailyStreak = 0;
      localStorage.setItem("omsut_dailyStreak", String(dailyStreak));
      // best stays as is
      localStorage.setItem("omsut_lastDailyPlayed", today);
      updateStreakUI();
      // block further input via isGameOver
      isGameOver = true;
    }
    if (isGameOver && gameMode === 'free') showReplayButton(true);
  } else {
    currentTry++;
    setMessage(`Essai ${currentTry + 1} sur ${MAX_TRIES}`);
    if (currentTryEl) currentTryEl.textContent = currentTry + 1;
  }
  // Record discovered correct positions so they are prefilled on every subsequent row
  for (let col = 0; col < WORD_LENGTH; col++) {
    if (result[col] === 'correct') discoveredPositions[col] = true;
  }

  // If there are correct letters, ensure they will be prefilled in the next row(s)
  if (!isGameOver && currentTry < MAX_TRIES) {
    const nextRow = currentTry; // after increment above, currentTry points to next row
    for (let col = 0; col < WORD_LENGTH; col++) {
      if (discoveredPositions[col]) {
        const c = getCell(nextRow, col);
        if (!c) continue;
        c.classList.add('prefilled');
        c.textContent = upperSecret[col];
      }
    }
  }
}

// --- Quand on clique sur "Valider" ---
function onSubmit() {
  if (isGameOver) return;
  const guess = getRowText(currentTry);
  if (guess.length !== WORD_LENGTH) {
    setMessage(`Le mot doit faire ${WORD_LENGTH} lettres.`, true);
    return;
  }
  // Vérifier que le mot fait bien partie de la bibliothèque (facultatif)
  if (WORDS.length > 0 && !WORDS.includes(normalizeWord(guess))) {
    setMessage("Mot inconnu dans la liste de mots.", true);
    return;
  }

  checkGuess(guess);
  // prepare next row if not game over
  if (!isGameOver) setEditableRow(currentTry);
}

// submit button removed — Enter in grid submits

// Debug : pour vérifier en console
console.log("Mot secret :", SECRET);
