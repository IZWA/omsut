// Auth page logic with Keycloak support

// Détection automatique de l'environnement
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_BASE = isLocal ? `${window.location.protocol}//localhost:3000` : 'https://omsut-backend.onrender.com'; // Remplacez par votre URL backend

let keycloakConfig = null;

// Load Keycloak config from server
async function loadKeycloakConfig() {
  try {
    const res = await fetch(API_BASE + '/api/auth/keycloak/config');
    keycloakConfig = await res.json();
    
    // Show Keycloak button if configured
    if (keycloakConfig && keycloakConfig.url) {
      document.getElementById('keycloak-login-section').style.display = 'block';
    }
  } catch (err) {
    console.warn('Keycloak not configured:', err);
  }
}

loadKeycloakConfig();

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
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

// Keycloak login
document.getElementById('keycloak-login-btn')?.addEventListener('click', () => {
  if (!keycloakConfig) {
    alert('Keycloak non configuré');
    return;
  }
  
  // Build OAuth2 authorization URL
  const redirectUri = window.location.origin + '/profile.html';
  const clientId = keycloakConfig.clientId;
  const realm = keycloakConfig.realm;
  const authUrl = keycloakConfig.url;
  
  const authEndpoint = `${authUrl}realms/${realm}/protocol/openid-connect/auth`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email'
  });
  
  window.location.href = `${authEndpoint}?${params.toString()}`;
});

// Legacy Login handler
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

    localStorage.setItem('omsut_token', data.token);
    setMessage('login-message', 'Connexion réussie ! Redirection...', false);

    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1000);
  } catch (err) {
    console.error(err);
    setMessage('login-message', 'Erreur réseau ou serveur indisponible.', true);
  }
});

// Legacy Register handler
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

  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: { username, password, displayName: displayName || username }
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage('register-message', data.error || 'Erreur lors de l\'inscription.', true);
      return;
    }

    localStorage.setItem('omsut_token', data.token);
    setMessage('register-message', 'Inscription réussie ! Redirection...', false);

    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1000);
  } catch (err) {
    console.error(err);
    setMessage('register-message', 'Erreur réseau ou serveur indisponible.', true);
  }
});
