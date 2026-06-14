# Builder AI — Gestion A.F. Construction

Plateforme d'IA pour l'estimation et la gestion de projets en rénovation résidentielle.

---

## Estimateur IA (`/estimateur`)

Tunnel de qualification en 3 étapes propulsé par Claude (Anthropic) :

1. **Mon projet** — le visiteur décrit son projet en langage naturel
2. **Mes coordonnées** — la fourchette est verrouillée derrière la capture du lead
3. **Mes résultats** — révélation de l'estimation + CTA réservation

### Lancer en local

```bash
pnpm install
cp .env.example .env.local
# Remplir les variables dans .env.local
pnpm dev
```

Ouvrir [http://localhost:3000/estimateur](http://localhost:3000/estimateur)

**Mode démo (sans clé API) :** laisser `ANTHROPIC_API_KEY` vide → une fourchette de démonstration s'affiche et le payload lead est loggé dans la console au lieu d'être envoyé au webhook n8n.

### Déploiement Vercel

1. Connecter le dépôt GitHub à Vercel
2. Dans **Settings → Environment Variables**, ajouter :
   - `ANTHROPIC_API_KEY`
   - `N8N_WEBHOOK_URL`
   - `NEXT_PUBLIC_BOOKING_URL`
3. Déployer — le tunnel est accessible à `https://votre-domaine.com/estimateur`

### Où ajuster les paramètres

| Ce que tu veux changer | Fichier | Élément |
|---|---|---|
| Ordres de grandeur de prix | `app/api/estimate/route.ts` | `SYSTEM_PROMPT` (section ORDRES DE GRANDEUR) |
| Types de projets proposés | `components/estimateur/PhaseProjet.tsx` | Tableau `PROJECT_TYPES` |
| URL Microsoft Bookings | Variable d'env | `NEXT_PUBLIC_BOOKING_URL` |
| URL webhook n8n | Variable d'env | `N8N_WEBHOOK_URL` |
| Couleur d'accentuation | Partout | Remplacer `sky-400` / `#38bdf8` par ta couleur |
| Modèle IA | `app/api/estimate/route.ts` | Champ `model` dans le body fetch |

### Architecture des fichiers

```
app/
  estimateur/
    page.tsx              — métadonnées SEO + import client
    layout.tsx            — fond navy + police Barlow Condensed
    EstimateurClient.tsx  — machine d'état 3 phases + orchestration
  api/
    estimate/route.ts     — appel sécurisé API Anthropic (clé serveur)
    lead/route.ts         — proxy webhook n8n (URL serveur)

components/estimateur/
  FunnelProgress.tsx      — indicateur d'étapes
  PhaseProjet.tsx         — formulaire étape 1
  PhaseCoordonnees.tsx    — gate capture + preview flou étape 2
  PhaseResultats.tsx      — révélation résultat + CTA étape 3
```

### Payload webhook n8n

```json
{
  "source": "estimateur_ia_gestion_af",
  "timestamp": "2026-06-13T23:00:00.000Z",
  "lead": {
    "prenom": "Marie",
    "telephone": "+15141234567",
    "ville": "Mascouche"
  },
  "projet": {
    "type": "Ajout / Agrandissement",
    "description": "Ajout d'étage 15×20 au-dessus du garage",
    "delai": "Cette saison"
  },
  "estimation": {
    "bas": 105000,
    "haut": 180000,
    "confiance": "faible",
    "resume_projet": "Ajout d'un étage de 300 pi² au-dessus du garage existant à Mascouche",
    "facteurs_cles": ["Structure portante du garage existant", "Toiture à revoir", "Finition intérieure"]
  }
}
```

---

## App principale Builder AI

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/francos-projects-3d53f4f4/v0-chat-interface-with-open-ai)

Voir `CHANGELOG.md` pour l'historique des fonctionnalités.
