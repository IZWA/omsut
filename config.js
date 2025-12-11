// Configuration de l'application OMSUT
// Modifiez cette URL pour pointer vers votre serveur backend

const CONFIG = {
  // URL du backend API
  // En local : laissez vide pour utiliser localhost:3000
  // En production : mettez l'URL complète de votre serveur (ex: 'https://omsut-api.onrender.com')
  API_URL: '', // Laissez vide pour auto-détection
  
  // Auto-détection basée sur l'environnement
  getApiUrl() {
    if (this.API_URL) {
      return this.API_URL;
    }
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal ? `${window.location.protocol}//localhost:3000` : '';
  }
};

// Export pour utilisation globale
window.CONFIG = CONFIG;
