# OMSUT - Nouvelles Fonctionnalités ✨

## Résumé des implémentations

### 1. 🎖️ Système de Badges Automatique

**Fichiers modifiés:**
- `server/db.js` - Nouvelle table `badges`
- `server/index.js` - Endpoint `/api/profile/award-badge`
- `script.js` - Fonction `recordGameAndCheckBadges()`

**Badges attribués automatiquement:**
- **First Win** 🥇 - Première victoire
- **Streak 3** 🔥 - 3 victoires consécutives
- **Streak 5** 🔥🔥 - 5 victoires consécutives  
- **Speed Runner** ⚡ - Victoire en moins de 30 secondes
- **Explorer** 🗺️ - Mode Libre joué

**Fonctionnement:**
1. Après chaque victoire, `script.js` enregistre la partie
2. Vérifie automatiquement les badges à attribuer
3. Envoi POST à `/api/profile/award-badge`
4. Badges apparaissent dans le profil utilisateur

---

### 2. 📊 Page Statistiques Personnelles

**Fichier créé:** `stats.html`

**Affichage:**
- Total parties jouées
- Nombre de victoires
- Streak actuel (mode daily)
- Meilleur streak
- Meilleur temps
- Taux de victoire (%)

**Endpoints utilisés:**
- `GET /api/profile/stats` - Récupère les stats utilisateur

**Lien:** Accessible depuis profile.html et index.html (profil utilisateur)

---

### 3. 🏆 Classement Global (Leaderboard)

**Fichier créé:** `leaderboard.html`

**Affichage:**
- Top 20 meilleurs joueurs
- Medals: 🥇 🥈 🥉
- Victoires, Streak actuel, Meilleur streak

**Endpoints utilisés:**
- `GET /api/leaderboard?limit=20` - Récupère classement

**Tri:** Par nombre de victoires (décroissant)

---

### 4. ⚙️ Admin Panel

**Fichier créé:** `admin.html`

**Fonctionnalités:**
- 📊 Statistiques globales (users, games, wins)
- 🎖️ Attribuer des badges aux joueurs
- 👥 Liste des utilisateurs avec stats
- 🏅 Liste des badges disponibles

**Sécurité:**
- Vérification admin au chargement
- Seuls les admins (env `OMSUT_ADMINS`) peuvent accéder

**Endpoints:**
- `GET /api/stats` - Stats globales
- `GET /api/admin/users` - Liste utilisateurs (admin only)
- `POST /api/users/:id/badges/:badgeId` - Award badge (admin only)

---

### 5. 📈 Backend - Tables de Données

**Nouvelles tables dans SQLite:**

```sql
-- Enregistrement des parties
CREATE TABLE games (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  mode TEXT,              -- 'daily' ou 'free'
  word TEXT,
  won INTEGER,            -- 0 ou 1
  tries_used INTEGER,
  time_seconds INTEGER,   -- temps de jeu
  played_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Stats globales par utilisateur
CREATE TABLE user_stats (
  user_id INTEGER PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  best_time_seconds INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Nouveaux endpoints API:**

```
POST   /api/games                    # Enregistrer une partie
GET    /api/profile/stats            # Stats utilisateur
POST   /api/profile/award-badge      # Attribuer badge
GET    /api/leaderboard              # Classement (public)
GET    /api/stats                    # Stats globales (public)
GET    /api/admin/users              # Liste users (admin)
```

---

### 6. 🚀 Déploiement Heroku

**Fichiers créés:**
- `Procfile` - Commande de démarrage pour Heroku
- `.env.example` - Template des variables d'env
- `DEPLOY-HEROKU.md` - Guide déploiement rapide
- `DEPLOYMENT.md` - Documentation complète

**Configuration:**
- Express sert frontend + backend dans 1 seul dyno
- SQLite stocké localement (perdu au redémarrage)
- PostgreSQL optionnel pour production

**Variables d'env:**
```bash
OMSUT_JWT_SECRET="votre-clé-secrète"
OMSUT_ADMINS="admin,alice"
PORT=3000 (auto Heroku)
```

**Architecture all-in-one:**
```
Heroku Dyno
├── Express.js
│   ├── /api/* (API)
│   ├── /uploads/* (Photos)
│   └── /* (Frontend statique)
└── SQLite database
```

---

## Fichiers Modifiés

| Fichier | Modifications |
|---------|--------------|
| `server/db.js` | Tables `games`, `user_stats`, badges |
| `server/index.js` | 5 nouveaux endpoints, middleware static |
| `script.js` | `recordGameAndCheckBadges()`, timer gameStartTime |
| `index.html` | Liens Stats, Leaderboard, Classement |
| `profile.html` | Liens Stats, Leaderboard |
| `package.json` | Dépendances root + start script |
| `server/package.json` | Nettoyage |

## Fichiers Créés

| Fichier | Rôle |
|---------|------|
| `stats.html` | Page statistiques personnelles |
| `leaderboard.html` | Page classement global |
| `admin.html` | Admin panel |
| `Procfile` | Déploiement Heroku |
| `.env.example` | Template env vars |
| `.gitignore` | Fichiers à ignorer |
| `DEPLOY-HEROKU.md` | Guide déploiement rapide |
| `README.md` | Mise à jour documentation |

---

## Workflow: Enregistrement d'une Victoire

```
1. Joueur gagne → script.js: checkGuess()
   ↓
2. Calcul temps: gameStartTime
   ↓
3. Appel: recordGameAndCheckBadges(true, tries, time)
   ↓
4. POST /api/games → Backend enregistre partie
   ↓
5. Vérification badges:
   - Premier win? → First Win ✓
   - Streak >= 3? → Streak 3 ✓
   - Streak >= 5? → Streak 5 ✓
   - Temps < 30s? → Speed Runner ✓
   ↓
6. POST /api/profile/award-badge pour chaque badge
   ↓
7. Badges apparaissent dans profil utilisateur
```

---

## Testez localement

```bash
# 1. Démarrer backend (port 3000)
npm start

# 2. Démarrer frontend (port 8000, autre terminal)
python -m http.server 8000

# 3. Ouvrir http://localhost:8000

# 4. Tester:
# - Créer compte
# - Jouer quelques parties
# - Voir badges dans profil
# - Vérifier stats
# - Voir leaderboard
```

---

## Déployer sur Heroku

```bash
# 1. Login
heroku login

# 2. Créer app
heroku create omsut-game

# 3. Secrets
heroku config:set OMSUT_JWT_SECRET="secret2024" --app omsut-game
heroku config:set OMSUT_ADMINS="admin" --app omsut-game

# 4. Deploy
git push heroku main

# 5. Vérifier
heroku open --app omsut-game
heroku logs --tail --app omsut-game
```

---

## Prochaines améliorations possibles

- [ ] Achievements (tutoriel, challenges)
- [ ] Système de points XP
- [ ] Multiplayer/Chat
- [ ] Export stats (CSV/PDF)
- [ ] Notifications push
- [ ] Mobile app (React Native)
- [ ] Graphiques stats (Chart.js)
- [ ] Historique détaillé des parties
- [ ] Badges personnalisés
- [ ] Système de guildes/équipes

---

**Réalisé avec ❤️ - Bon jeu! 🎮**
