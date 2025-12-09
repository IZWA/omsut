// Append simplified profile management to game page
// Note: API_BASE is already defined in script.js

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

  const res = await fetch(API_BASE + path, Object.assign({}, opts, { headers, body }));
  return res;
}

// Show profile or login link
async function updateAuthUI() {
  const token = getToken();
  const userProfileEl = document.getElementById('user-profile');
  const loginLink = document.getElementById('login-link');
  const profileNameSmall = document.getElementById('profile-name-small');
  const profilePhotoSmall = document.getElementById('profile-photo-small');

  if (!token) {
    // Not authenticated: show login link
    if (userProfileEl) userProfileEl.style.display = 'none';
    if (loginLink) loginLink.style.display = 'inline-block';
    return;
  }

  // Authenticated: fetch and show profile
  try {
    const res = await apiFetch('/api/profile');
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();

    console.log('Profile data:', data);

    if (userProfileEl) userProfileEl.style.display = 'flex';
    if (loginLink) loginLink.style.display = 'none';
    
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

if (document.getElementById('logout-btn')) {
  document.getElementById('logout-btn').addEventListener('click', () => {
    setToken(null);
    window.location.reload();
  });
}

// Initialize auth UI when DOM is ready
function initAuthUI() {
  console.log('Initializing auth UI...');
  updateAuthUI();
}

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthUI);
} else {
  // DOM already loaded
  initAuthUI();
}

// Also try with a small delay to be safe
setTimeout(initAuthUI, 100);

// Redirect to auth if user clicks login link but prefers to start from game
document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (!token && location.pathname.endsWith('index.html')) {
    // User can play without auth - that's fine
  }
});
