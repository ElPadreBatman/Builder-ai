# BuilderAI - Modifications Majeures

## Session actuelle

### Système d'inscription (Self-service + Vendeur)
- [x] OAuth Google et Microsoft ajoutés sur `/login` et `/signup`
- [x] Route `/auth/callback` pour gérer le retour OAuth
- [x] Page `/signup` refaite: self-service avec essai gratuit OU via invitation
- [x] Page `/seller` - Portail vendeur avec:
  - Génération de liens d'invitation (expire 5 jours)
  - Inscription directe de clients
  - Historique des invitations
  - Statistiques (ventes, commissions)
- [x] Migration DB: `sellers`, `sales`, extension de `invitations`
- [x] API `/api/seller/create-client` pour création directe

### Problèmes à corriger
1. [x] Retirer la section abonnement de `/profile` - FAIT
2. [x] Corriger le défilement sur la page vitrine `/` - FAIT (retiré overflow:hidden de globals.css)
3. [x] Ajouter bouton "Paramètres" dans le menu déroulant du dashboard - FAIT
4. [x] `/settings` accessible à tous les utilisateurs connectés, cartes admin masquées aux non-admins - FAIT
5. [x] `/admin/subscription` bloqué aux non-admins (role !== "admin" && role !== "director") - DÉJÀ EN PLACE

### Architecture des rôles
- **Admin**: `profile.role === "admin"` - Peut gérer l'abonnement dans `/admin/subscription`
- **Utilisateur**: `profile.role === "user"` ou autre - Accès standard sans gestion d'abonnement

### Pages clés
- `/` - Page vitrine (landing page publique)
- `/login` - Connexion
- `/signup` - Inscription
- `/pricing` - Tarifs
- `/dashboard` - Tableau de bord (protégé)
- `/chat` - Chat IA (protégé + vérification abonnement)
- `/profile` - Profil utilisateur (infos personnelles uniquement)
- `/settings` - Paramètres (à implémenter)
- `/admin/subscription` - Gestion abonnement (admin uniquement)

### Plans d'abonnement
- **Base**: 39.99$/mois - 1 utilisateur, 20 soumissions/mois
- **Pro**: 69.99$/mois (55.99$/mois annuel, -20%) - 3 utilisateurs, soumissions illimitées

---

## Historique

### Système d'abonnement Stripe
- Intégration Stripe Checkout et Customer Portal
- Webhooks pour synchronisation des statuts
- Essai gratuit 7 jours automatique
- Protection des routes selon l'abonnement

### Nouveau projet avec infos client
- Dialog de création de projet en 3 étapes
- Types de soumission guidés
- Infos client (nom, téléphone, courriel, adresse)
- Message de contexte auto-envoyé à l'agent

### Tour guidé onboarding
- Système de tooltips interactifs type ProductFruits
- Spotlight sur éléments clés
- Navigation étape par étape
