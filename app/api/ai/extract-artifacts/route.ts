import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXTRACTION_PROMPT = `Tu es un extracteur de données de projet de construction au Québec.
Analyse les messages de conversation pour extraire TOUTES les informations structurées.

CATEGORIES D'EXTRACTION:

1. CLIENT (informations du client):
   - nom_client: Nom complet du client/propriétaire
   - telephone: Numéro de téléphone
   - courriel: Adresse courriel
   - langue: Langue préférée (français, anglais)

2. PROJET (informations du projet):
   - nom: Nom du projet ou titre descriptif
   - adresse: Adresse complète du chantier
   - ville: Ville
   - code_postal: Code postal
   - type: Type (renovation, construction_neuve, agrandissement, etc.)
   - categorie_rbq: Catégorie RBQ (A, B, C, D)
   - date_debut: Date de début souhaitée
   - delai: Délai souhaité (ex: "3 semaines", "2 mois")

3. BUDGET (informations financières):
   - budget_max: Budget maximum du client
   - priorite_budget: Priorité (qualite, prix, delai)
   - mode_paiement: Mode de paiement préféré

4. PIECES (pièces concernées):
   - cuisine: Inclus/détails cuisine
   - salle_de_bain: Inclus/détails sdb
   - salon: Inclus/détails salon
   - chambre: Inclus/détails chambres
   - sous_sol: Inclus/détails sous-sol
   - exterieur: Inclus/détails extérieur

5. DIMENSIONS (mesures physiques):
   - superficie_totale: Surface totale en pi²
   - superficie_cuisine: Surface cuisine
   - superficie_sdb: Surface salle de bain
   - lineaire_armoires: Pieds linéaires d'armoires
   - hauteur_plafond: Hauteur sous plafond
   - lineaire_comptoir: Pieds linéaires de comptoir

6. QUANTITES (éléments dénombrables):
   - prises: Nombre de prises électriques
   - luminaires: Nombre de luminaires
   - interrupteurs: Nombre d'interrupteurs
   - portes: Nombre de portes
   - fenetres: Nombre de fenêtres
   - robinets: Nombre de robinets
   - electromenagers: Nombre d'électroménagers
   - armoires_hautes: Nombre d'armoires hautes
   - armoires_basses: Nombre d'armoires basses
   - tiroirs: Nombre de tiroirs

7. MATERIAUX (types de matériaux):
   - comptoir: Type de comptoir (granite, quartz, stratifie)
   - armoires: Type d'armoires (melamine, bois, thermoplastique)
   - plancher: Type de plancher (ceramique, bois_franc, vinyle)
   - dosseret: Type de dosseret
   - peinture: Type/couleur de peinture
   - robinetterie: Type/gamme robinetterie
   - poignees: Type de poignées

8. ELECTRIQUE (besoins électriques):
   - panneau: Type/capacité panneau (100A, 200A)
   - circuits_dedies: Circuits dédiés requis
   - eclairage_encastre: Nombre de spots encastrés
   - prises_ilot: Prises dans îlot

9. PLOMBERIE (besoins plomberie):
   - deplacement_plomberie: Déplacement requis (oui/non)
   - type_evier: Type d'évier
   - robinet_style: Style de robinet
   - lave_vaisselle: Branchement lave-vaisselle

10. EXISTANT (état actuel):
    - annee_construction: Année de construction du bâtiment
    - etat_existant: État général (bon, moyen, mauvais)
    - travaux_anterieurs: Travaux déjà réalisés
    - problemes_connus: Problèmes identifiés

11. DIVISIONS (divisions de travail DDN - extrais TOUS les items listés):
    - division_demolition: Liste des travaux de démolition (retrait matériaux, nettoyage, etc.)
    - division_plomberie: Liste des travaux de plomberie (toilette, drain, robinetterie, etc.)
    - division_electricite: Liste des travaux électriques (prises, luminaires, câblage, etc.)
    - division_revetements: Liste des travaux de revêtements (plancher, murs, céramique, etc.)
    - division_finition: Liste des travaux de finition (peinture, moulures, etc.)
    - division_menuiserie: Liste des travaux de menuiserie (armoires, portes, etc.)

12. TAUX (taux horaires mentionnés):
    - taux_general: Taux horaire général (ex: "95$/h")
    - taux_plomberie: Taux horaire plomberie (ex: "110$/h")
    - taux_electricite: Taux horaire électricité (ex: "110$/h")
    - taux_specialise: Taux horaire spécialisé

13. SOUMISSION (informations de la soumission):
    - numero_soumission: Numéro de soumission (ex: "SOQ-2025-001")
    - type_soumission: Type (ex: "Type D - Détaillée")
    - date_soumission: Date de la soumission
    - validite: Durée de validité
    - entrepreneur: Nom de l'entrepreneur
    - entreprise: Nom de l'entreprise

14. MANDAT (compréhension du mandat - TRÈS IMPORTANT):
    - resume_projet: Résumé en 2-3 phrases de la compréhension globale du projet
    - objectif_principal: L'objectif principal du client (ex: "Rénover la salle de bain complète")
    - type_intervention: Type d'intervention (rénovation complète, partielle, mise à jour, agrandissement)
    - pieces_concernees: Liste des pièces concernées par les travaux
    - travaux_principaux: Liste des principaux travaux à réaliser (max 5 items clés)
    - contraintes: Contraintes identifiées (budget, délai, accès, occupation)
    - points_attention: Points d'attention ou demandes spéciales du client

RÈGLES IMPORTANTES:
- Extrais UNIQUEMENT les informations explicitement mentionnées dans la conversation
- NE RETOURNE PAS les champs pour lesquels aucune information n'est disponible
- N'invente PAS de valeurs, ne mets PAS "Non spécifié" ou "null" - omet simplement le champ
- Pour chaque extraction, indique un score de confiance (0.5-1.0)
- Utilise les unités appropriées (pi², pi, m², $)
- Si une info est mise à jour dans un message plus récent, utilise la nouvelle valeur
- Le tableau artifacts doit contenir UNIQUEMENT les informations trouvées

RETOURNE UN JSON COMPACT avec ce format:
{
  "artifacts": [
    {
      "category": "client|projet|budget|pieces|dimensions|quantites|materiaux|electrique|plomberie|existant",
      "key": "nom_de_la_cle",
      "value": "valeur_extraite",
      "confidence": 0.95
    }
  ]
}

IMPORTANT: Si aucune information n'est trouvée pour une catégorie, ne l'inclus pas du tout. Retourne un tableau vide si rien n'est trouvé.`

interface Artifact {
  category: string
  key: string
  value: string
  unit?: string
  confidence: number
}

interface ExtractionResult {
  artifacts: Artifact[]
}

export async function POST(request: Request) {
  try {
    const { conversation_id, messages } = await request.json()

    if (!conversation_id) {
      return NextResponse.json({ error: "conversation_id requis" }, { status: 400 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ artifacts: [] })
    }

    // Format messages for extraction
    const conversationText = messages
      .map((m: { role: string; content: string }) => 
        `${m.role === 'user' ? 'CLIENT' : 'AGENT'}: ${m.content}`
      )
      .join('\n\n')

    // Call OpenAI for extraction
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { 
            role: "user", 
            content: `Analyse cette conversation et extrais les informations structurées:\n\n${conversationText}` 
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[extract-artifacts] OpenAI error:", errorData)
      return NextResponse.json({ error: "Erreur extraction AI" }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json({ artifacts: [] })
    }

    let extraction: ExtractionResult
    try {
      extraction = JSON.parse(content)
    } catch {
      console.error("[extract-artifacts] JSON parse error:", content)
      return NextResponse.json({ artifacts: [] })
    }

    const artifacts = extraction.artifacts || []

    // Verify conversation exists before upserting artifacts
    if (artifacts.length > 0) {
      const { data: conversationExists, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversation_id)
        .single()

      if (convError || !conversationExists) {
        console.warn("[extract-artifacts] Conversation not found:", conversation_id)
        return NextResponse.json({ 
          success: true,
          artifacts,
          count: artifacts.length,
          saved: false,
          reason: "Conversation not found in database"
        })
      }

      for (const artifact of artifacts) {
        const { error } = await supabase
          .from("conversation_artifacts")
          .upsert({
            conversation_id,
            category: artifact.category,
            key: artifact.key,
            value: artifact.value,
            unit: artifact.unit || null,
            confidence: artifact.confidence || 1.0,
            source: "ai",
            updated_at: new Date().toISOString()
          }, {
            onConflict: "conversation_id,category,key"
          })

        if (error) {
          console.error("[extract-artifacts] Upsert error:", error)
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      artifacts,
      count: artifacts.length 
    })

  } catch (error) {
    console.error("[extract-artifacts] Error:", error)
    return NextResponse.json(
      { error: "Erreur serveur lors de l'extraction" },
      { status: 500 }
    )
  }
}

// GET: Retrieve artifacts for a conversation
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")

    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id requis" }, { status: 400 })
    }

    const { data: artifacts, error } = await supabase
      .from("conversation_artifacts")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("category", { ascending: true })
      .order("key", { ascending: true })

    if (error) {
      console.error("[extract-artifacts] Fetch error:", error)
      return NextResponse.json({ error: "Erreur récupération artefacts" }, { status: 500 })
    }

    // Group by category
    const grouped = (artifacts || []).reduce((acc, art) => {
      if (!acc[art.category]) {
        acc[art.category] = []
      }
      acc[art.category].push(art)
      return acc
    }, {} as Record<string, typeof artifacts>)

    return NextResponse.json({ artifacts: grouped })

  } catch (error) {
    console.error("[extract-artifacts] Error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PUT: Update a single artifact manually
export async function PUT(request: Request) {
  try {
    const { id, value, unit } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("conversation_artifacts")
      .update({
        value,
        unit,
        source: "manual",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[extract-artifacts] Update error:", error)
      return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 })
    }

    return NextResponse.json({ success: true, artifact: data })

  } catch (error) {
    console.error("[extract-artifacts] Error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
