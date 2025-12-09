# OMSUT - Déploiement: Render vs Heroku

## 🏆 Recommandation: **Render**

---

## Comparaison détaillée

| Critère | Render | Heroku |
|---------|--------|--------|
| **Prix gratuit** | ✅ 750h/mois | ❌ Plus gratuit depuis nov 2022 |
| **PostgreSQL gratuit** | ✅ 256MB | ❌ Payant ($5/mois min) |
| **SSL/HTTPS** | ✅ Auto | ✅ Auto |
| **Cold start** | ~30s après 15min inactivité | ~5s (avant, plus gratuit) |
| **Build time** | ~2-3 min | ~1-2 min |
| **Déploiement** | Git push → Auto | Git push heroku main |
| **Infrastructure as Code** | ✅ render.yaml | ❌ |
| **Logs** | ✅ Dashboard | ✅ CLI + Dashboard |
| **Custom domain** | ✅ Gratuit | ✅ Gratuit (avant payant) |
| **Support** | Community | Community + Payant |

---

## 💰 Plans tarifaires

### Render Free
- ✅ **750 heures/mois** (suffisant pour 1 app 24/7)
- ✅ **PostgreSQL 256MB** gratuit
- ✅ **Déploiements illimités**
- ⚠️ Sleep après 15 min inactivité
- ⚠️ Cold start 30s

### Heroku (depuis nov 2022)
- ❌ **Plus de plan gratuit**
- 💰 **Hobby Dyno**: $7/mois
- 💰 **PostgreSQL**: $5/mois minimum
- ✅ Pas de sleep
- ✅ Démarrage rapide

---

## 🚀 Migration Heroku → Render

Si vous aviez Heroku avant:

```bash
# 1. Exporter Heroku config
heroku config --app omsut-game > heroku.env

# 2. Sur Render.com
# - New → Blueprint
# - Connectez votre repo
# - Ajoutez les variables d'env depuis heroku.env

# 3. Deploy
# Render construira et déploiera automatiquement
```

---

## 📊 Cas d'usage

### Utilisez Render si:
- ✅ Vous voulez un service **gratuit**
- ✅ Vous avez besoin de **PostgreSQL gratuit**
- ✅ Cold start de 30s est acceptable
- ✅ App personnelle ou prototype
- ✅ Vous aimez **Infrastructure as Code** (render.yaml)

### Utilisez Heroku si:
- ✅ Vous avez un **budget** ($12+/mois)
- ✅ Vous voulez **zéro sleep**
- ✅ Démarrage instantané requis
- ✅ App professionnelle
- ✅ Vous êtes déjà familier avec Heroku

---

## 🎯 Pour OMSUT (notre jeu)

**Recommandation: Render**

Pourquoi?
- ✅ Gratuit → Parfait pour un jeu personnel
- ✅ PostgreSQL gratuit → Pas de perte de données
- ⚠️ Cold start 30s → Acceptable pour un jeu (pas une API critique)
- ✅ Blueprint → Config versionnée dans le repo

---

## 📝 Fichiers nécessaires

### Render
```
render.yaml          ← Blueprint config
.node-version        ← Version Node
DEPLOY-RENDER.md     ← Guide
package.json         ← start: "node server/index.js"
```

### Heroku
```
Procfile             ← web: node server/index.js
DEPLOY-HEROKU.md     ← Guide
package.json         ← start: "node server/index.js"
```

**Bonus:** Votre repo supporte les deux! 🎉

---

## 🔄 Déploiement côte à côte

Vous pouvez déployer sur **les deux** pour comparer:

```bash
# Render
git push origin main
→ Auto-deploy via render.yaml

# Heroku (si compte payant)
git push heroku main
→ Deploy via Procfile
```

Les deux utilisent le même code source!

---

## ⚡ Performance

### Temps de démarrage (cold start)

| Service | Cold Start | Note |
|---------|-----------|------|
| Render Free | ~30s | Après 15min inactivité |
| Heroku Hobby | ~5s | Plus de free tier |
| VPS (DigitalOcean) | 0s | Toujours actif, $5/mois |

### Temps de build

| Service | Build Time |
|---------|-----------|
| Render | 2-3 min |
| Heroku | 1-2 min |

---

## 🌐 URLs de déploiement

Render:
```
https://omsut.onrender.com
https://omsut-abc123.onrender.com (random)
```

Heroku:
```
https://omsut-game.herokuapp.com
```

---

## 🎓 Conclusion

Pour OMSUT: **Utilisez Render**
- Gratuit ✅
- PostgreSQL inclus ✅
- Perfect pour ce projet ✅

Si budget illimité: Heroku reste excellent (mais payant)

---

**Bon déploiement! 🚀**
