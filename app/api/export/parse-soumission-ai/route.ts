// app/api/export/parse-soumission-ai/route.ts
// Parse le contenu markdown d'une conversation en utilisant l'IA
// Utilise structured outputs pour garantir un format JSON valide

import { type NextRequest, NextResponse } from "next/server"
import type { Soumission } from "@/types/soumission"

const PARSE_SYSTEM_PROMPT = `Tu es un extracteur de données de soumission de construction. Tu dois extraire TOUTES les données présentes dans le texte, sans en omettre aucune.

RÈGLES CRITIQUES:
1. Extrais TOUS les items de TOUTES les sections - ne laisse rien de côté
2. NE MODIFIE JAMAIS les prix ou quantités - utilise les valeurs EXACTES du document
3. Le prix unitaire doit être celui indiqué dans la colonne "Prix un." ou "Prix unitaire"
4. La quantité doit être celle de la colonne "Qté" ou "Quantité"
5. Utilise le code MasterFormat (ex: "26 24 13") tel quel
6. Détecte le type: "MO" pour main-d'œuvre (heures, installation), "Mat." pour matériaux
7. Regroupe les items par Division (ex: Division 26 = Électricité)

ATTENTION - Items souvent manqués:
- Items de main-d'œuvre (MO) avec des heures: "32 h", "8 h", etc.
- Items forfaitaires: "Forfait", "Global", "Lot"
- Items avec des descriptions longues qui peuvent être sur plusieurs lignes
- Items dans les sections "DÉTAILS PAR DIVISION"
- TOUS les items de CHAQUE division, pas seulement les premiers

VÉRIFICATION: Compare ton extraction avec les sous-totaux du document. Si ton total ne correspond pas au sous-total indiqué, tu as probablement manqué des items.

FORMAT DE SORTIE JSON:
{
  "projet": {
    "nom": "Nom du projet",
    "client": "Nom du client",
    "adresse": "Adresse"
  },
  "phases": [
    {
      "code": "PH-1",
      "nom": "Nom de la phase",
      "divisions": [
        {
          "code": "26",
          "nom": "Électricité",
          "items": [
            {
              "code": "26 24 13",
              "description": "Description de l'item",
              "type": "Mat.",
              "unite": "u",
              "quantite": 1,
              "prix_unitaire": 2450
            }
          ]
        }
      ]
    }
  ],
  "marges": {
    "overhead": 10,
    "imprevus": 18
  }
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: "Contenu manquant" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Clé API OpenAI manquante" }, { status: 500 })
    }

    // Call OpenAI with structured output
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PARSE_SYSTEM_PROMPT },
          { 
            role: "user", 
            content: `Extrais TOUTES les données de soumission du texte suivant.

INSTRUCTIONS:
1. Extrais CHAQUE item de CHAQUE division - ne laisse RIEN de côté
2. Utilise les prix unitaires EXACTS du document
3. Inclus tous les items MO (main-d'œuvre) ET Mat. (matériaux)
4. Vérifie que ton total correspond aux sous-totaux du document

Si le document mentionne un sous-total de division (ex: "Sous-total Div. 26 = 9 850 $"), assure-toi que la somme de tes items pour cette division égale ce montant.

TEXTE À ANALYSER:
${content}` 
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 8000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", errorText)
      return NextResponse.json({ error: "Erreur API OpenAI" }, { status: 500 })
    }

    const aiResponse = await response.json()
    const jsonContent = aiResponse.choices?.[0]?.message?.content

    if (!jsonContent) {
      return NextResponse.json({ error: "Réponse AI vide" }, { status: 500 })
    }

    let parsedData: any
    try {
      parsedData = JSON.parse(jsonContent)
    } catch (e) {
      console.error("[v0] Failed to parse AI JSON:", jsonContent)
      return NextResponse.json({ error: "JSON invalide de l'AI" }, { status: 500 })
    }

    // Validate and build soumission
    const soumission: Soumission = {
      projet: {
        nom: parsedData.projet?.nom || "Projet sans nom",
        client: parsedData.projet?.client || "Client",
        adresse: parsedData.projet?.adresse || "",
        date: new Date().toISOString().split("T")[0],
        validite: "30 jours",
        rbq: "5806-1391-01",
      },
      phases: (parsedData.phases || []).map((phase: any, pIdx: number) => ({
        code: phase.code || `PH-${pIdx + 1}`,
        nom: phase.nom || `Phase ${pIdx + 1}`,
        divisions: (phase.divisions || []).map((div: any) => ({
          code: div.code || "00",
          nom: div.nom || "Division",
          items: (div.items || []).map((item: any, iIdx: number) => ({
            id: `ai-${pIdx}-${div.code}-${iIdx}`,
            code: item.code || `${div.code}.${String(iIdx + 1).padStart(2, "0")}`,
            description: item.description || "Item",
            type: item.type === "MO" ? "MO" : "Mat.",
            unite: item.unite || "u",
            quantite: Number(item.quantite) || 1,
            prix_unitaire: Number(item.prix_unitaire) || 0,
          })),
        })),
      })),
      marges: {
        overhead: parsedData.marges?.overhead ?? 10,
        imprevus: parsedData.marges?.imprevus ?? 18,
      },
      hypotheses: [],
      inclusions: [],
      exclusions: [],
    }

    // Calculate stats
    const totalItems = soumission.phases?.reduce(
      (sum, p) => sum + p.divisions.reduce((s, d) => s + d.items.length, 0), 0
    ) || 0
    
    const coutsDirect = soumission.phases?.reduce(
      (sum, p) => sum + p.divisions.reduce(
        (ds, d) => ds + d.items.reduce(
          (is, i) => is + (i.quantite * i.prix_unitaire), 0
        ), 0
      ), 0
    ) || 0

    const report = {
      method: "AI",
      totalItems,
      totalPhases: soumission.phases?.length || 0,
      totalDivisions: soumission.phases?.reduce((sum, p) => sum + p.divisions.length, 0) || 0,
      coutsDirect,
      divisions: soumission.phases?.flatMap(p => 
        p.divisions.map(d => ({
          code: d.code,
          nom: d.nom,
          items: d.items.length,
          total: d.items.reduce((s, i) => s + (i.quantite * i.prix_unitaire), 0),
        }))
      ) || [],
    }

    return NextResponse.json({ soumission, report })
  } catch (error) {
    console.error("[v0] AI parsing error:", error)
    return NextResponse.json({
      error: "Erreur lors du parsing AI",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
