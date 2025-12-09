// Auth page logic

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Show active tab content
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');
  });
});

// Helper functions
function setMessage(elementId, text, isError = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + (isError ? 'error' : 'success');
}

function clearMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.className = 'message';
}

async function apiFetch(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  const token = localStorage.getItem('omsut_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers, body }));
  return res;
}

// Login handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage('login-message');

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    setMessage('login-message', 'Pseudo et mot de passe requis.', true);
    return;
  }

  try {
    const res = await apiFetch('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage('login-message', data.error || 'Erreur de connexion.', true);
      return;
    }

    // Save token
    localStorage.setItem('omsut_token', data.token);
    setMessage('login-message', 'Connexion réussie ! Redirection...', false);

    // Redirect to profile after 1 second
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1000);
  } catch (err) {
    console.error(err);
    setMessage('login-message', 'Erreur réseau ou serveur indisponible.', true);
  }
});

// Register handler
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage('register-message');

  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const displayName = document.getElementById('reg-display').value.trim();

  if (!username || !password) {
    setMessage('register-message', 'Pseudo et mot de passe requis.', true);
    return;
  }

  if (password.length < 4) {
    setMessage('register-message', 'Le mot de passe doit avoir au moins 4 caractères.', true);
    return;
  }

  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: { username, password, displayName: displayName || null }
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage('register-message', data.error || 'Erreur d\'inscription.', true);
      return;
    }

    // Save token
    localStorage.setItem('omsut_token', data.token);
    setMessage('register-message', 'Compte créé ! Redirection...', false);

    // Redirect to profile after 1 second
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1000);
  } catch (err) {
    console.error('Register error:', err);
    setMessage('register-message', `Erreur: ${err.message}`, true);
  }
});

// On page load, check if already authenticated
window.addEventListener('load', () => {
  const token = localStorage.getItem('omsut_token');
  if (token) {
    // Already authenticated, redirect to game
    window.location.href = 'index.html';
  }
});
