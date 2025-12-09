# 🚀 OMSUT - Déploiement Rapide (5 minutes)

## Prérequis
- ✅ Compte GitHub
- ✅ Repo OMSUT poussé sur GitHub
- ✅ Compte Render.com (gratuit)

---

## Étape 1: Push sur GitHub

```bash
cd s:\MOTUS

git add .
git commit -m "OMSUT: Ready for deployment"
git push origin main
```

✅ Votre code est maintenant sur GitHub

---

## Étape 2: Render.com

### Option A: Blueprint (Automatique - Recommandé ⭐)

1. Allez sur **https://render.com**
2. Cliquez **New** → **Blueprint**
3. Connectez votre repo: **`IZWA/omsut`**
4. Render détecte automatiquement `render.yaml`
5. Cliquez **Deploy**

🎉 **C'est tout!** Render configure tout automatiquement.

---

### Option B: Manuelle

1. Allez sur **https://render.com**
2. Cliquez **New** → **Web Service**
3. Connectez repo: **`IZWA/omsut`**
4. Configuration:
   ```
   Name: omsut
   Region: (choisissez le plus proche)
   Branch: main
   Root Directory: (laisser vide)
   Runtime: Node
   Build Command: npm install
   Start Command: node server/index.js
   ```

5. **Advanced** → Variables d'environnement:
   ```
   OMSUT_JWT_SECRET = [cliquez "Generate"]
   OMSUT_ADMINS = admin
   NODE_ENV = production
   ```

6. Instance Type: **Free**

7. Cliquez **Create Web Service**

---

## Étape 3: Attendre le déploiement

- ⏱️ **~3 minutes** pour le premier build
- Suivez les logs en temps réel
- Quand vous voyez "Live" → ✅ Déployé!

---

## Étape 4: Tester

Votre URL:
```
https://omsut.onrender.com
ou
https://omsut-xyz.onrender.com
```

Testez:
- ✅ Page d'accueil: `https://omsut.onrender.com/`
- ✅ API: `https://omsut.onrender.com/api/status`
- ✅ Créer un compte
- ✅ Jouer une partie
- ✅ Vérifier badges

---

## 🎯 C'est tout!

Votre jeu est maintenant en ligne! 🎉

---

## 🔄 Mises à jour futures

Pour déployer des changements:

```bash
git add .
git commit -m "Update: nouvelle feature"
git push origin main
```

Render redéploiera **automatiquement**! 🚀

---

## 📊 Monitoring

Dashboard Render:
- **Logs** en temps réel
- **Metrics**: CPU, RAM, Requêtes
- **Deployments**: Historique
- **Shell**: Accès terminal

---

## ⚠️ Notes importantes

### Cold Start (Plan gratuit)
- Après **15 min** d'inactivité → Service sleep
- Première requête après sleep → **~30s** pour démarrer
- Requêtes suivantes → Instantanées

**Astuce:** Utilisez un service ping gratuit (UptimeRobot) pour garder actif.

### Base de données
- SQLite actuel = **Données perdues** au redémarrage
- **Solution:** Ajouter PostgreSQL gratuit Render (voir DEPLOY-RENDER.md)

---

## 🆘 Problèmes?

### Build échoue
```bash
# Vérifier Render logs
# Chercher "Error" ou "Failed"
# Vérifier package.json a "start": "node server/index.js"
```

### Application error
```bash
# Vérifier variables d'env
# Vérifier OMSUT_JWT_SECRET existe
# Vérifier logs Render
```

### 404 Not Found
```bash
# Vérifier Start Command: node server/index.js
# Vérifier server/index.js existe
```

---

## 📱 Liens utiles

- **Render Dashboard**: https://dashboard.render.com
- **Docs Render**: https://render.com/docs
- **Votre app**: https://omsut.onrender.com

---

**Félicitations! Votre jeu est en ligne! 🎮🚀**
