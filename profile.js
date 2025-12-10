// Profile page logic

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';

function getToken() {
  return localStorage.getItem('omsut_token');
}

function setToken(token) {
  if (token) localStorage.setItem('omsut_token', token);
  else localStorage.removeItem('omsut_token');
}

// Handle Keycloak OAuth callback
async function handleKeycloakCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    try {
      // Show loading message
      const authCheck = document.getElementById('auth-check');
      if (authCheck) authCheck.innerHTML = '<p style="color: #667eea;">🔄 Authentification en cours...</p>';
      
      // Exchange code for token
      const res = await fetch(API_BASE + '/api/auth/keycloak/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!res.ok) {
        throw new Error('Failed to authenticate with Keycloak');
      }
      
      const data = await res.json();
      
      // Store token
      setToken(data.token);
      
      // Clean URL (remove OAuth parameters)
      window.history.replaceState({}, document.title, '/profile.html');
      
      // Load profile
      await loadProfile();
    } catch (err) {
      console.error('Keycloak callback error:', err);
      const authCheck = document.getElementById('auth-check');
      if (authCheck) authCheck.innerHTML = '<p style="color: #ff6b6b;">❌ Erreur d\'authentification</p><a href="auth-keycloak.html" class="btn btn-primary" style="display: inline-block; margin-top: 12px;">Réessayer</a>';
    }
    return true;
  }
  return false;
}

async function apiFetch(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers, body }));
  return res;
}

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

// Check authentication and load profile
async function loadProfile() {
  const token = getToken();
  const authCheck = document.getElementById('auth-check');
  const profileContent = document.getElementById('profile-content');

  if (!token) {
    if (authCheck) authCheck.innerHTML = '<p style="color: #ff6b6b;">Vous devez être connecté pour accéder à cette page.</p><a href="auth-keycloak.html" class="btn btn-primary" style="display: inline-block; margin-top: 12px;">Aller à la connexion</a>';
    if (profileContent) profileContent.style.display = 'none';
    return;
  }

  try {
    const res = await apiFetch('/api/profile');
    if (!res.ok) throw new Error('Failed to fetch profile');
    const data = await res.json();

    // Hide auth check, show profile
    if (authCheck) authCheck.style.display = 'none';
    if (profileContent) profileContent.style.display = '';

    // Fill profile info
    document.getElementById('username').textContent = data.username;
    document.getElementById('display-name').textContent = data.display_name || '(Non défini)';
    if (data.created_at) {
      const date = new Date(data.created_at).toLocaleDateString('fr-FR');
      document.getElementById('created-at').textContent = date;
    }

    // Load photo
    if (data.photo) {
      document.getElementById('profile-photo').src = API_BASE + data.photo;
    }

    // Load badges
    loadBadges(data.badges || []);

    // Fill edit field
    document.getElementById('edit-display-name').value = data.display_name || '';
  } catch (err) {
    console.error('Profile load error:', err);
    if (authCheck) authCheck.innerHTML = `<p style="color: #ff6b6b;">Erreur: ${err.message}</p><a href="auth-keycloak.html" class="btn btn-primary" style="display: inline-block; margin-top: 12px;">Retour à la connexion</a>`;
    if (profileContent) profileContent.style.display = 'none';
  }
}

function loadBadges(badges) {
  const container = document.getElementById('badges-container');
  if (!container) return;

  if (!badges || badges.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; grid-column: 1/-1;">Aucun badge pour le moment</p>';
    return;
  }

  const badgeEmojis = {
    'First Win': '🏆',
    'Streak 3': '🔥',
    'Explorer': '🗺️',
    'Speed Demon': '⚡',
    'Perfect': '💯'
  };

  container.innerHTML = badges.map(b => `
    <div class="badge-item">
      <div class="badge-icon">${badgeEmojis[b.name] || '⭐'}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.description || ''}</div>
      ${b.earned_at ? `<div style="font-size: 0.75rem; color: #666; margin-top: 6px;">${new Date(b.earned_at).toLocaleDateString('fr-FR')}</div>` : ''}
    </div>
  `).join('');
}

// Update display name
document.getElementById('update-name-btn').addEventListener('click', async () => {
  clearMessage('update-message');
  const displayName = document.getElementById('edit-display-name').value.trim();

  if (!displayName) {
    setMessage('update-message', 'Le nom affiché ne peut pas être vide.', true);
    return;
  }

  try {
    const res = await apiFetch('/api/profile', {
      method: 'PUT',
      body: { display_name: displayName }
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage('update-message', data.error || 'Erreur mise à jour', true);
      return;
    }

    setMessage('update-message', 'Profil mis à jour avec succès!', false);
    // Reload profile to show changes
    setTimeout(() => loadProfile(), 1000);
  } catch (err) {
    console.error(err);
    setMessage('update-message', `Erreur: ${err.message}`, true);
  }
});

// Upload photo
document.getElementById('upload-photo-btn').addEventListener('click', async () => {
  clearMessage('photo-message');
  const file = document.getElementById('photo-file').files[0];

  if (!file) {
    setMessage('photo-message', 'Veuillez choisir une image.', true);
    return;
  }

  const fd = new FormData();
  fd.append('photo', file);

  try {
    const res = await apiFetch('/api/profile/photo', {
      method: 'POST',
      body: fd
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage('photo-message', data.error || 'Erreur téléversement', true);
      return;
    }

    setMessage('photo-message', 'Photo téléversée avec succès!', false);
    // Reload profile to show new photo
    setTimeout(() => loadProfile(), 1000);
  } catch (err) {
    console.error(err);
    setMessage('photo-message', `Erreur: ${err.message}`, true);
  }
});

// Logout from profile page
const logoutBtnProfile = document.getElementById('logout-btn-profile');
if (logoutBtnProfile) {
  logoutBtnProfile.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Remove local token
    localStorage.removeItem('omsut_token');
    
    // Get Keycloak config to logout from SSO
    try {
      const res = await fetch(API_BASE + '/api/auth/keycloak/config');
      const keycloakConfig = await res.json();
      
      if (keycloakConfig && keycloakConfig.url) {
        // Redirect to Keycloak logout endpoint
        const logoutUrl = `${keycloakConfig.url}realms/${keycloakConfig.realm}/protocol/openid-connect/logout`;
        const redirectUri = encodeURIComponent(window.location.origin + '/auth-keycloak.html');
        window.location.href = `${logoutUrl}?redirect_uri=${redirectUri}`;
      } else {
        window.location.href = 'auth-keycloak.html';
      }
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = 'auth-keycloak.html';
    }
  });
}

// Load profile on page load
window.addEventListener('load', async () => {
  // Check if this is a Keycloak callback
  const isCallback = await handleKeycloakCallback();
  
  // If not a callback, load profile normally
  if (!isCallback) {
    loadProfile();
  }
});
