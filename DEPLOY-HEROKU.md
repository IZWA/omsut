# OMSUT - Guide de Déploiement Heroku

## Prérequis
- Git
- Node.js v18+
- npm
- Compte Heroku (gratuit)
- Heroku CLI: `npm install -g heroku`

## Installation rapide

```bash
# 1. Login Heroku
heroku login

# 2. Créer l'app (remplacez 'omsut-game' par un nom unique)
heroku create omsut-game

# 3. Configurer les secrets
heroku config:set OMSUT_JWT_SECRET="votre-clé-secrète-2024" --app omsut-game
heroku config:set OMSUT_ADMINS="admin,alice" --app omsut-game

# 4. Déployer
git push heroku main
# ou: git push heroku master

# 5. Vérifier
heroku logs --tail --app omsut-game
heroku open --app omsut-game
```

## Architecture Heroku

```
┌─────────────────────────────────────┐
│     OMSUT on Heroku (1 dyno)        │
├─────────────────────────────────────┤
│  Node.js + Express                  │
│  ├── Frontend (static files)         │
│  ├── API /api/* (auth, stats, etc)   │
│  ├── SQLite database                │
│  └── Photo uploads (/uploads/)      │
└─────────────────────────────────────┘
```

## Endpoints

```
Production: https://omsut-game.herokuapp.com

GET  /                 → index.html (jeu)
GET  /auth.html        → page login
GET  /profile.html     → profil
GET  /stats.html       → statistiques
GET  /leaderboard.html → classement
GET  /admin.html       → admin panel (admins seulement)

POST /api/register     → créer compte
POST /api/login        → connexion
GET  /api/profile      → profil utilisateur
GET  /api/leaderboard  → classement
```

## Commandes utiles

```bash
# Logs
heroku logs --tail --app omsut-game
heroku logs --app omsut-game | grep error

# Redémarrer
heroku restart --app omsut-game

# Shell
heroku run bash --app omsut-game
heroku run "curl http://localhost:3000/api/status" --app omsut-game

# Configuration
heroku config --app omsut-game
heroku config:set KEY=value --app omsut-game

# Open
heroku open --app omsut-game
```

## Limitations & Upgrades

### SQLite (actuel)
- ✅ Gratuit
- ✅ Pas de setup
- ❌ Données perdues à redémarrage (free dyno = ~1x/jour)
- ❌ Uploads perdus

### Pour production: PostgreSQL
```bash
# Add PostgreSQL (gratuit)
heroku addons:create heroku-postgresql:free --app omsut-game

# DATABASE_URL est créé auto
# Migrer le code vers PostgreSQL (optional)
```

## Sécurité

- ✅ Changez `OMSUT_JWT_SECRET` (random, long)
- ✅ Configurez `OMSUT_ADMINS`
- ✅ HTTPS activé automatiquement
- ✅ `.env` dans `.gitignore`

## Troubleshooting

| Problème | Solution |
|----------|----------|
| "Application error" | `heroku logs --tail` |
| "Cannot find module" | Dépendances manquantes, `git push heroku main` |
| JWT invalide | `OMSUT_JWT_SECRET` mal configuré, `heroku config` |
| Photos ne s'affichent pas | SQLite, redémarrage perdu uploads, utiliser S3 |
| Tokens invalides après redémarrage | Normal avec SQLite (data perdue) |

## Domaine personnalisé

```bash
heroku domains:add omsut.com --app omsut-game
# Configurer DNS selon instructions Heroku
```

## Support

- Logs: `heroku logs --tail --app omsut-game`
- Health: `https://omsut-game.herokuapp.com/api/status`
- Dashboard: `heroku open --app omsut-game`
