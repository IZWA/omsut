# OMSUT - Guide de Déploiement

## Prérequis
- Git
- Node.js v18+
- Compte Heroku
- Heroku CLI (`npm install -g heroku`)

## Déploiement sur Heroku

### 1. Préparation
```bash
cd /path/to/MOTUS
git init
git add .
git commit -m "Initial commit: OMSUT word game with auth, profiles, badges, stats, leaderboard, admin panel"
```

### 2. Créer l'app Heroku
```bash
heroku login
heroku create omsut  # Remplacez 'omsut' par votre nom d'app unique
```

### 3. Configurer les variables d'environnement
```bash
# JWT Secret (changez cette valeur!)
heroku config:set OMSUT_JWT_SECRET="votre-secret-jwt-change-2024"

# Admins (pseudo comma-separated)
heroku config:set OMSUT_ADMINS="admin,alice"
```

### 4. Déployer
```bash
git push heroku main
# ou si votre branche principale est master:
# git push heroku master
```

### 5. Vérifier le déploiement
```bash
heroku logs --tail
heroku open
```

## Architecture Heroku

### Frontend
- Serveur statique Node.js inclus dans le Procfile
- Fichiers HTML/CSS/JS servis depuis le répertoire racine

### Backend
- Express.js API sur le port défini par l'env var `PORT` (Heroku: 3000)
- SQLite database (persiste localement avec le dyno)
- Multer pour uploads (stockés localement dans `server/uploads/`)

## Configuration CORS

Pour utiliser l'app deployée:
1. Mettez à jour `API_BASE` dans les fichiers JavaScript si l'URL change
2. Le backend accepte les requêtes CORS de n'importe quelle origine (développement)
3. En production, configurez CORS dans `server/index.js`

## Limitations SQLite & Heroku

**Attention**: SQLite sur Heroku a des limitations:
- La base de données est perdue à chaque redémarrage du dyno
- Les uploads dans `server/uploads/` sont perdus

**Pour une app de production**:
1. Utilisez PostgreSQL (add-on Heroku gratuit disponible)
2. Utilisez AWS S3 pour les uploads

### Migration vers PostgreSQL

```bash
# Ajouter PostgreSQL
heroku addons:create heroku-postgresql:free

# La variable DATABASE_URL sera créée automatiquement
# Installer pg driver
npm --prefix server install pg

# Mettre à jour server/db.js pour utiliser PostgreSQL
```

## Fichiers de déploiement

- `Procfile` - Définit le process web pour Heroku
- `package.json` - Scripts de démarrage
- `.gitignore` - Exclut les fichiers temporaires

## Variables d'environnement

| Clé | Exemple | Description |
|-----|---------|-------------|
| `PORT` | `3000` | Port écoute (défini par Heroku) |
| `OMSUT_JWT_SECRET` | `secret-key-2024` | Clé secrète pour JWT |
| `OMSUT_ADMINS` | `admin,alice` | Pseudos admins séparés par virgule |
| `DATABASE_URL` | `postgres://...` | URL DB PostgreSQL (si utilisé) |

## Commandes utiles

```bash
# Logs en direct
heroku logs --tail

# Redémarrer l'app
heroku restart

# Ouvrir l'app
heroku open

# Configuration
heroku config

# Shell Heroku
heroku run bash

# Voir les dyno metrics
heroku metrics
```

## Troubleshooting

### "Application error" au chargement
```bash
heroku logs --tail
# Cherchez les erreurs de startup
```

### API requête échoue
1. Vérifiez que l'API_BASE dans le frontend pointe vers la bonne URL
2. Vérifiez que le JWT_SECRET est configuré
3. Vérifiez les logs: `heroku logs --tail`

### Base de données vide après redémarrage
C'est normal avec SQLite! Utilisez PostgreSQL pour la production.

## Sécurité

Avant de pousser en production:
- ✅ Changez `OMSUT_JWT_SECRET`
- ✅ Configurez `OMSUT_ADMINS` avec vos admins
- ✅ Configurez CORS si l'app frontend est sur un domaine différent
- ✅ Activez HTTPS (Heroku le fait automatiquement)

## Endpoints API

```
POST   /api/register              # Créer compte
POST   /api/login                 # Connexion
GET    /api/profile               # Profil utilisateur
PUT    /api/profile               # Mettre à jour profil
POST   /api/profile/photo         # Upload photo
GET    /api/profile/stats         # Stats utilisateur
POST   /api/games                 # Enregistrer partie
POST   /api/profile/award-badge   # Attribuer badge
GET    /api/leaderboard           # Classement global
GET    /api/stats                 # Stats globales
GET    /api/admin/users           # Liste utilisateurs (admin)
POST   /api/users/:id/badges/:bid # Award badge (admin)
```

## Support

Pour les questions ou problèmes:
1. Vérifiez `heroku logs --tail`
2. Testez localement: `npm start`
3. Vérifiez les variables d'env: `heroku config`
