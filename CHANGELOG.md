# Changelog - SoumissionPro

Ce fichier documente toutes les modifications apportées au projet.

---

## 2026-03-16

### Tools IA pour l'agent Bob Buildr

**Fichiers créés:**
- `app/api/tools/estimation-classifier/index.js` - Tool de classification Type A-D pour estimations

**Fichiers modifiés:**
- `app/api/chat/route.ts` - Intégration des tools estimation_classifier et price_lookup
- `app/api/tools/price-lookup/scraper.js` - Remplacement axios par fetch natif

**Description:**
Ajout de nouveaux tools OpenAI pour l'agent Bob Buildr:

1. **estimation_classifier** - Classification automatique du type de soumission (A, B, C, D) basée sur:
   - Type A: Ordre de grandeur (budget préliminaire, peu d'info)
   - Type B: Budget (plans préliminaires, estimation sommaire)
   - Type C: Soumission (plans complets, devis quantitatif)
   - Type D: Détaillée (plans finaux, quantités précises, prix négociés)

2. **price_lookup** - Recherche de prix matériaux via SerpAPI/Google Shopping:
   - `get_material_prices` - Prix pour matériaux spécifiques
   - `generate_quote` - Génération de devis avec prix actuels
   - `list_materials_by_category` - Liste matériaux par catégorie

**Configuration agent Bob Buildr:**
```
tools_enabled: ["price_lookup", "file_search", "estimation_classifier"]
```

---

### Améliorations extraction artefacts

**Fichiers modifiés:**
- `app/api/ai/extract-artifacts/route.ts` - Ajout catégories Mandat, Divisions DDN, Taux, Soumission
- `components/artifacts-panel.tsx` - Nouvelles catégories avec icônes

**Nouvelles catégories extraites:**
- **Mandat**: resume_projet, objectif_principal, type_intervention, pieces_concernees, travaux_principaux, contraintes, points_attention
- **Divisions DDN**: demolition, plomberie, electricite, revetements, finition, menuiserie
- **Taux horaires**: general, plomberie, electricite, specialise
- **Soumission**: numero, type, date, validite, entrepreneur, entreprise

---

### Fix bug messages dans mauvaise conversation

**Fichiers modifiés:**
- `app/chat/page.tsx` - Correction closure issue dans sendMessage

**Problème:** Lors de la création d'un nouveau projet, le premier message allait dans la conversation précédente au lieu de la nouvelle.

**Solution:** Ajout d'un paramètre `conversationIdOverride` à `sendMessage()` pour contourner le problème de closure avec `useCallback`. L'ID de la nouvelle conversation est maintenant passé directement au lieu de dépendre du state.

---

### APIs IA avec OpenAI au lieu de Vercel AI Gateway

**Fichiers modifiés:**
- `app/api/ai/generate-mandat/route.ts` - Migration vers @ai-sdk/openai
- `app/api/ai/generate-inclusions/route.ts` - Migration vers @ai-sdk/openai
- `app/api/ai/generate-echeancier/route.ts` - Migration vers @ai-sdk/openai

**Description:**
Les APIs de génération IA utilisent maintenant directement OpenAI (gpt-4o-mini) via `@ai-sdk/openai` au lieu du Vercel AI Gateway qui nécessite une carte de crédit.

---

## 2026-03-15

### Vue sommaire client avec generation IA des descriptions

**Fichiers modifies:**
- `components/conversation-views.tsx` - Ajout du composant `SommaireClientView` et toggle
- `app/api/ai/sommaire-divisions/route.ts` - Nouvelle API pour generer les descriptions par division via IA

**Description:**
Le bouton "Sommaire client" est maintenant un **toggle** qui bascule entre la vue detaillee et une vue sommaire simplifiee:
- La vue sommaire affiche chaque division avec une zone de texte editable pour la description
- Un bouton "Regenerer avec IA" appelle l'API Claude pour generer automatiquement des descriptions claires et comprehensibles pour le client
- L'IA analyse les items de chaque division, les inclusions et exclusions pour creer un texte adapte aux non-experts
- Le sommaire inclut: infos projet, description par division, inclusions/exclusions, recapitulatif financier, total TTC
- Bouton de telechargement HTML pour exporter le sommaire

---

### Amelioration lisibilite soumission (TDAH-friendly)

**Fichiers modifies:**
- `components/conversation-views.tsx`

**Description:**
- Textes simplifies et raccourcis pour meilleure lisibilite (condition importante, portee des travaux, conditions generales)
- Saut de page apres la section "Portee des travaux"
- Calendrier preliminaire sur sa propre page avec intro claire et note explicative
- Format en liste a puces pour la portee des travaux

---

### Sommaire client pour la soumission

**Fichiers modifiés:**
- `components/conversation-views.tsx` - Ajout de la fonction `exportSommaireHTML` et du bouton "Sommaire client"

**Description:**
Ajout d'un nouveau bouton "Sommaire client" dans la toolbar de la vue soumission. Ce bouton génère un document HTML simplifié contenant:
- Informations du projet (chantier, client, date, validité)
- Tableau sommaire par division avec: code, nom, brève description des travaux inclus, sous-totaux matériaux et main-d'oeuvre
- Section inclusions/exclusions (si présente)
- Récapitulatif financier (coûts directs, frais généraux, imprévus, taxes)
- Total TTC mis en évidence
- Bloc de signatures

Le document est distinct de l'export HTML détaillé existant et est conçu pour être envoyé directement au client.

---

### Système i18n (Internationalisation)

**Fichiers créés:**
- `lib/i18n/dictionaries/fr.json` - Dictionnaire français
- `lib/i18n/dictionaries/en.json` - Dictionnaire anglais  
- `lib/i18n/dictionaries/es.json` - Dictionnaire espagnol
- `lib/i18n/use-translations.ts` - Hook client-side pour récupérer les traductions

**Fichiers modifiés:**
- `app/login/page.tsx` - Traduction complète
- `app/signup/page.tsx` - Traduction complète
- `app/settings/page.tsx` - Traduction complète
- `app/profile/page.tsx` - Traduction complète
- `app/dashboard/page.tsx` - Traduction partielle (titre, menu, recherche, états vides)

**Fonctionnement:**
- La langue est détectée automatiquement via le header `Accept-Language` du navigateur
- Stockée dans un cookie `NEXT_LOCALE`
- Peut être changée manuellement via le sélecteur dans le header

---

### Corrections RLS (Row Level Security) - Supabase

**Problème:** Les utilisateurs ne voyaient que leurs propres conversations, pas celles de leur entreprise.

**Scripts SQL créés:**
- `scripts/028_fix_company_conversations_rls.sql` - Première tentative de fix RLS
- `scripts/029_debug_company_data.sql` - Debug des données company
- `scripts/030_check_company_nulls.sql` - Vérification des valeurs NULL
- `scripts/031_reset_rls_policies.sql` - Reset complet des policies (échoué)
- `scripts/032_check_current_policies.sql` - Vérification des policies actuelles
- `scripts/033_check_franco_company.sql` - Debug spécifique Franco
- `scripts/034_test_rls_logic.sql` - Test de la logique RLS
- `scripts/035_fix_profiles_rls_for_company.sql` - Fix RLS pour profiles (causait récursion)
- `scripts/036_cleanup_duplicate_policies.sql` - Nettoyage des policies dupliquées
- `scripts/037_upgrade_franco_to_pro.sql` - Upgrade des comptes gestion-af vers plan pro
- `scripts/038_fix_profiles_recursion.sql` - **FIX FINAL** - Création de `get_my_company()` function

**Solution finale:**
- Création d'une fonction `get_my_company()` avec `SECURITY DEFINER` pour éviter la récursion infinie
- Les policies RLS utilisent maintenant cette fonction au lieu de sous-requêtes directes

**Policies actives sur `profiles`:**
- `Users can view company profiles` - Voir son profil + profils de la même entreprise
- `Users can update own profile` - Modifier uniquement son propre profil

**Policies actives sur `conversations`:**
- `Users can view company conversations` - Voir les conversations de l'entreprise
- `Users can insert their own conversations` - Créer ses propres conversations
- `Users can update company conversations` - Modifier les conversations de l'entreprise
- `Users can delete company conversations` - Supprimer les conversations de l'entreprise

---

### Corrections de bugs

**Clés React dupliquées:**
- `components/interactive-question-form.tsx` - Ajout de `formId` et `questionIndex` aux clés pour éviter les duplications

---

### Comptes mis à jour

| Email | Company | Plan | Status |
|-------|---------|------|--------|
| franco@gestion-af.ca | gestion-af | pro | active |
| vincentb@gestion-af.ca | gestion-af | pro | active |
| kevingw@gestion-af.ca | gestion-af | pro | active |

---

## Notes techniques

### Structure de la base de données

**Tables principales:**
- `profiles` - Profils utilisateurs (lié à auth.users)
- `conversations` - Conversations/projets
- `messages` - Messages dans les conversations
- `attachments` - Fichiers attachés
- `agents` - Agents IA configurés

**Colonnes importantes pour RLS:**
- `profiles.company` - Identifiant de l'entreprise (ex: "gestion-af")
- `conversations.user_id` - Propriétaire de la conversation
- `profiles.subscription_type` - Type d'abonnement (free, base, pro)

### Fonction de sécurité

```sql
CREATE OR REPLACE FUNCTION get_my_company()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company FROM profiles WHERE id = auth.uid()
$$;
```

Cette fonction permet de récupérer la company de l'utilisateur courant sans déclencher les policies RLS (évite la récursion infinie).
