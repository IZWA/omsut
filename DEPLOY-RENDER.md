# OMSUT - Déploiement Render

## 🚀 Déploiement en 3 minutes

### Option 1: Blueprint (Automatique - Recommandé)

1. **Connectez-vous à Render**: https://render.com
2. **New → Blueprint**
3. **Connectez votre repo GitHub**: `IZWA/omsut`
4. Render détectera automatiquement `render.yaml`
5. **Deploy**

C'est tout! ✅

---

### Option 2: Manuelle

1. **Connectez-vous à Render**: https://render.com

2. **New → Web Service**

3. **Connectez votre repo GitHub**: `IZWA/omsut`

4. **Configuration:**
   ```
   Name: omsut
   Runtime: Node
   Build Command: npm install
   Start Command: node server/index.js
   ```

5. **Variables d'environnement:**
   ```
   OMSUT_JWT_SECRET = [cliquez "Generate" pour valeur aléatoire]
   OMSUT_ADMINS = admin
   NODE_ENV = production
   ```

6. **Create Web Service**

---

## 🌐 Votre URL

Après déploiement:
```
https://omsut.onrender.com
```

ou nom personnalisé que vous choisissez.

---

## ✨ Avantages Render vs Heroku

| Feature | Render | Heroku |
|---------|--------|--------|
| **Prix gratuit** | ✅ 750h/mois | ❌ Plus gratuit depuis 2022 |
| **Sleep après inactivité** | ✅ 15 min | ❌ N/A |
| **Démarrage** | ~30s | ~5s |
| **PostgreSQL gratuit** | ✅ Oui | ❌ Payant |
| **SSL auto** | ✅ | ✅ |
| **Blueprint (IaC)** | ✅ | ❌ |

---

## 📦 Avec PostgreSQL (Optionnel)

Pour ne pas perdre les données:

1. **Dashboard Render → New → PostgreSQL**
   - Name: `omsut-db`
   - Free tier: ✅

2. **Dans Web Service → Environment:**
   ```
   DATABASE_URL = [connectez à omsut-db]
   ```

3. **Migrer le code** (créer `server/db-pg.js` avec support PostgreSQL)

---

## 🔧 Variables d'environnement

| Variable | Valeur | Description |
|----------|--------|-------------|
| `NODE_ENV` | `production` | Environnement |
| `OMSUT_JWT_SECRET` | (généré) | Clé JWT |
| `OMSUT_ADMINS` | `admin,alice` | Admins (comma-separated) |
| `DATABASE_URL` | (optionnel) | PostgreSQL URL |

---

## 📝 render.yaml (Blueprint)

Le fichier `render.yaml` dans votre repo configure automatiquement:
- Web Service Node.js
- Variables d'env
- Health check sur `/api/status`
- Auto-deploy depuis GitHub

---

## 🔄 Déploiements automatiques

**Push vers GitHub = Auto-déploiement**

```bash
git add .
git commit -m "Update features"
git push origin main
```

Render rebuildera automatiquement! 🎉

---

## 📊 Monitoring

Dashboard Render:
- Logs en temps réel
- Metrics (CPU, RAM, Requests)
- Deployment history
- Shell access

---

## 🐛 Troubleshooting

### Service ne démarre pas
```
Logs → Chercher "Error"
Vérifier: Build Command et Start Command
```

### "Application error"
```
Vérifier variables d'env (JWT_SECRET)
Logs → Voir stack trace
```

### Photos ne s'affichent pas
SQLite avec uploads locaux = perdu au redémarrage.
→ Utiliser PostgreSQL + AWS S3 pour prod.

---

## 🎯 Commandes Git pour déployer

```bash
cd s:\MOTUS

# Commit vos changements
git add .
git commit -m "OMSUT: Ready for Render"

# Push vers GitHub
git push origin main

# Render déploiera automatiquement!
```

---

## 💰 Plan Free Render

- ✅ 750 heures/mois
- ✅ SSL automatique
- ✅ Déploiements illimités
- ⚠️ Sleep après 15 min d'inactivité
- ⚠️ Cold start ~30 secondes

---

## 🔗 Liens utiles

- Dashboard: https://dashboard.render.com
- Docs: https://render.com/docs
- Status: https://status.render.com

---

**Votre app sera live en quelques minutes! 🚀**
