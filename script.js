// Paramètres du jeu
const MIN_WORD_LENGTH = 4;
let WORD_LENGTH = 6; // sera mis à jour dynamiquement selon le mot choisi
const MAX_WORD_LENGTH = 12;
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

let gameMode = localStorage.getItem("omsut_mode") || "daily"; // 'daily' or 'free'

let currentTry = 0;
let isGameOver = false;
let dailyStreak = parseInt(localStorage.getItem("omsut_dailyStreak") || "0", 10) || 0;
let bestStreak = parseInt(localStorage.getItem("omsut_bestDailyStreak") || "0", 10) || 0;
let activeCol = 0;

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

  // no separate input element; grid cells control length

  // Initialiser la grille selon la longueur déterminée
  initGrid();

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

  setMessage(`Essai ${currentTry + 1} sur ${MAX_TRIES}`);
  console.log("Mot secret :", SECRET);
}

// Normalize helper (already performed on load but useful for inputs)
function normalizeWord(s) {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function updateStreakUI() {
  if (dailyStreakEl) dailyStreakEl.textContent = dailyStreak;
  if (bestStreakEl) bestStreakEl.textContent = bestStreak;
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
  // choose new secret according to current mode
  chooseSecretForMode();

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
}

// Mode UI handlers
const modeDailyEl = document.getElementById("mode-daily");
const modeFreeEl = document.getElementById("mode-free");

// keyboard element
const keyboardEl = document.getElementById("keyboard");

function renderKeyboard() {
  if (!keyboardEl) return;
  keyboardEl.innerHTML = "";
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    const k = document.createElement("div");
    k.className = "key";
    k.dataset.letter = ch;
    k.textContent = ch;
    keyboardEl.appendChild(k);
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
  activeCol = Math.max(0, Math.min(col, WORD_LENGTH - 1));
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
    c.classList.add('editable');
    c.tabIndex = 0;
    c.textContent = c.textContent || '';
  }
  activeCol = 0;
  setActiveCol(activeCol);
}

function getCell(row, col) {
  return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
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
  if (/^[a-zA-Z]$/.test(key)) {
    e.preventDefault();
    // place letter at activeCol in current row
    const ch = key.toUpperCase();
    const cell = getCell(currentTry, activeCol);
    if (!cell) return;
    cell.textContent = ch;
    // move right
    if (activeCol < WORD_LENGTH - 1) setActiveCol(activeCol + 1);
    return;
  }

  if (key === 'Backspace') {
    e.preventDefault();
    const cell = getCell(currentTry, activeCol);
    if (cell && cell.textContent) {
      cell.textContent = '';
      return;
    }
    // otherwise move left and clear
    if (activeCol > 0) {
      setActiveCol(activeCol - 1);
      const prev = getCell(currentTry, activeCol);
      if (prev) prev.textContent = '';
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
  gameMode = m;
  localStorage.setItem("omsut_mode", m);
  // reset game when changing mode
  resetGame();
}

if (modeDailyEl && modeFreeEl) {
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
  } else if (currentTry === MAX_TRIES - 1) {
    isGameOver = true;
    setMessage(`Perdu 😅 Le mot était ${SECRET}.`);
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
  } else {
    currentTry++;
    setMessage(`Essai ${currentTry + 1} sur ${MAX_TRIES}`);
    if (currentTryEl) currentTryEl.textContent = currentTry + 1;
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
