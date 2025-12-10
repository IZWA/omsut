// Append simplified profile management to game page
// API_BASE configuration - use window to ensure it's global
window.API_BASE = window.API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '');

function getToken() {
  return localStorage.getItem('omsut_token');
}

function setToken(token) {
  if (token) localStorage.setItem('omsut_token', token);
  else localStorage.removeItem('omsut_token');
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

  const res = await fetch(window.API_BASE + path, Object.assign({}, opts, { headers, body }));
  return res;
}

// Show profile or login link
async function updateAuthUI() {
  console.log('[AUTH] updateAuthUI called');
  
  const token = getToken();
  console.log('[AUTH] Token:', token ? 'exists' : 'none');
  
  const userProfileEl = document.getElementById('user-profile');
  const loginLink = document.getElementById('login-link');
  const profileNameSmall = document.getElementById('profile-name-small');
  const profilePhotoSmall = document.getElementById('profile-photo-small');

  console.log('[AUTH] Elements:', {
    userProfileEl: !!userProfileEl,
    loginLink: !!loginLink,
    profileNameSmall: !!profileNameSmall,
    profilePhotoSmall: !!profilePhotoSmall
  });

  if (!token) {
    // Not authenticated: show login link
    if (userProfileEl) userProfileEl.style.display = 'none';
    if (loginLink) loginLink.style.display = 'inline-block';
    console.log('[AUTH] No token, showing login link');
    return;
  }

  // Authenticated: fetch and show profile
  try {
    console.log('[AUTH] Fetching profile...');
    const res = await apiFetch('/api/profile');
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();

    console.log('[AUTH] Profile data:', data);

    if (userProfileEl) {
      userProfileEl.style.display = 'flex';
      console.log('[AUTH] User profile shown');
    }
    if (loginLink) {
      loginLink.style.display = 'none';
      console.log('[AUTH] Login link hidden');
    }
    
    // Set username/display name
    if (profileNameSmall) {
      profileNameSmall.textContent = data.display_name || data.username;
      console.log('Profile name set to:', data.display_name || data.username);
    }
    
    // Set photo or placeholder
    if (profilePhotoSmall) {
      if (data.photo) {
        const photoUrl = API_BASE + data.photo;
        console.log('Setting photo URL:', photoUrl);
        profilePhotoSmall.src = photoUrl;
        profilePhotoSmall.style.display = 'block';
      } else {
        // Generate placeholder with initials
        const initials = (data.display_name || data.username || 'U')
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .substring(0, 2);
        
        console.log('No photo, showing initials:', initials);
        
        // Create SVG data URL for placeholder
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <rect width="40" height="40" fill="#667eea" rx="50%"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="18" font-weight="bold" font-family="system-ui">${initials}</text>
        </svg>`;
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);
        profilePhotoSmall.src = dataUrl;
        profilePhotoSmall.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Profile fetch error:', err);
    setToken(null);
    if (userProfileEl) userProfileEl.style.display = 'none';
    if (loginLink) loginLink.style.display = 'inline-block';
  }
}

// Setup logout button handler
function setupLogoutHandler() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn && !logoutBtn.dataset.handlerAdded) {
    logoutBtn.dataset.handlerAdded = 'true';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[AUTH] Logout clicked');
      
      // Remove local token
      localStorage.removeItem('omsut_token');
      
      // Get Keycloak config to logout from SSO
      try {
        const res = await fetch(window.API_BASE + '/api/auth/keycloak/config');
        const keycloakConfig = await res.json();
        
        if (keycloakConfig && keycloakConfig.url) {
          // Redirect to Keycloak logout endpoint
          const logoutUrl = `${keycloakConfig.url}realms/${keycloakConfig.realm}/protocol/openid-connect/logout`;
          const redirectUri = encodeURIComponent(window.location.origin + '/auth-keycloak.html');
          window.location.href = `${logoutUrl}?redirect_uri=${redirectUri}`;
        } else {
          // Fallback if Keycloak not configured
          window.location.href = 'auth-keycloak.html';
        }
      } catch (err) {
        console.error('[AUTH] Logout error:', err);
        // Fallback on error
        window.location.href = 'auth-keycloak.html';
      }
    });
  }
}

// Initialize auth UI when DOM is ready
function initAuthUI() {
  console.log('[AUTH] Initializing auth UI...');
  setupLogoutHandler();
  updateAuthUI().catch(err => console.error('[AUTH] Update failed:', err));
}

// Multiple initialization strategies to ensure it works
if (document.readyState === 'loading') {
  // DOM still loading
  document.addEventListener('DOMContentLoaded', initAuthUI);
} else {
  // DOM already loaded
  setTimeout(initAuthUI, 0);
}

// Fallback: try again after a short delay
setTimeout(initAuthUI, 200);
