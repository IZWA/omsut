# Configuration Keycloak pour OMSUT

## Prérequis

1. **Serveur Keycloak** : Keycloak doit être installé et accessible
   - URL par défaut : `http://localhost:8080`
   - Téléchargement : https://www.keycloak.org/downloads

2. **Node.js** et dépendances installées (`npm install` dans `server/`)

## Configuration du Realm Keycloak

### 1. Créer un Realm

1. Connectez-vous à la console d'administration Keycloak (`http://localhost:8080/admin`)
2. Créez un nouveau realm nommé `omsut`

### 2. Créer un Client

1. Dans le realm `omsut`, allez dans **Clients** → **Create Client**
2. Configuration :
   - **Client ID** : `omsut-client`
   - **Client Type** : `OpenID Connect`
   - **Client authentication** : OFF (public client)
   - **Standard Flow Enabled** : ON
   - **Direct Access Grants Enabled** : ON
   - **Valid Redirect URIs** :
     - `http://localhost:3000/*`
     - `http://localhost:5500/*` (si vous utilisez Live Server)
     - Ajoutez vos URLs de production
   - **Web Origins** : `*` (développement) ou URLs spécifiques (production)

### 3. Créer des Rôles (optionnel)

1. Dans **Realm Roles**, créez :
   - `user` (rôle par défaut)
   - `admin` (pour les administrateurs)

### 4. Créer des Utilisateurs de Test

1. Allez dans **Users** → **Add user**
2. Créez un utilisateur test
3. Dans l'onglet **Credentials**, définissez un mot de passe
4. Dans l'onglet **Role Mappings**, assignez le rôle `user`

## Configuration du Backend

### Variables d'environnement

Créez un fichier `.env` ou définissez dans PowerShell :

```powershell
$env:KEYCLOAK_URL = 'http://localhost:8080/'
$env:KEYCLOAK_REALM = 'omsut'
$env:KEYCLOAK_CLIENT_ID = 'omsut-client'
```

### Fichier keycloak.json

Le fichier `server/keycloak.json` est déjà configuré avec les valeurs par défaut.
Adaptez-le selon votre configuration Keycloak.

## Démarrage

### 1. Démarrer Keycloak

```powershell
# Si Keycloak est installé localement
cd C:\chemin\vers\keycloak\bin
.\kc.bat start-dev
```

### 2. Démarrer le serveur OMSUT

```powershell
cd S:\MOTUS\server
npm start
```

## Test de l'authentification

1. Ouvrez `http://localhost:3000/auth.html`
2. Cliquez sur "Se connecter avec Keycloak"
3. Vous serez redirigé vers la page de connexion Keycloak
4. Connectez-vous avec vos identifiants
5. Vous serez redirigé vers votre profil

## Migration des utilisateurs existants

Si vous avez déjà des utilisateurs dans la base SQLite :

1. **Option 1** : Exporter et importer manuellement dans Keycloak
2. **Option 2** : Conserver la double authentification (JWT + Keycloak)
3. **Option 3** : Utiliser Keycloak User Storage SPI pour synchroniser avec SQLite

## Dépannage

### Erreur CORS

Vérifiez que les **Web Origins** sont correctement configurés dans le client Keycloak.

### Token invalide

- Vérifiez que l'URL du serveur Keycloak est accessible
- Vérifiez que le realm et le client ID sont corrects

### Redirection échoue

Vérifiez que les **Valid Redirect URIs** incluent votre URL frontend.

## Production

Pour la production :

1. Utilisez HTTPS pour Keycloak (`ssl-required: "all"` dans keycloak.json)
2. Configurez un client **confidential** avec un secret
3. Limitez les **Web Origins** aux domaines spécifiques
4. Activez la vérification d'email et d'autres politiques de sécurité
