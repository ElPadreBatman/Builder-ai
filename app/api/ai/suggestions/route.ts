// app/api/ai/suggestions/route.ts
// Generates AI-powered item suggestions based on project context, division, and existing items

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DIVISIONS_MASTERFORMAT } from "@/types/soumission"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SuggestionRequest {
  prompt: string
  divisionCode: string
  divisionName: string
  projectName: string
  projectCategory: string
  existingItems: Array<{ description: string; type: string; code?: string }>
  taskListName?: string
  allProjectPhases?: Array<{ nom: string; divisions: Array<{ code: string; nom: string; itemCount: number }> }>
}

interface SuggestedItem {
  code: string
  description: string
  type: "MO" | "Mat."
  unite: string
  quantite: number
  prix_unitaire: number
  confidence: "high" | "medium" | "low"
  source: "database" | "ai"
}

export async function POST(request: Request) {
  try {
    const body: SuggestionRequest = await request.json()
    const { prompt, divisionCode, divisionName, projectName, existingItems, taskListName, projectCategory, allProjectPhases } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "La cle API OpenAI n'est pas configuree" },
        { status: 500 }
      )
    }

    // 1. First, search the material_prices database for relevant items
    const divisionPrefix = divisionCode.substring(0, 2)
    const { data: dbItems } = await supabase
      .from("material_prices")
      .select("*")
      .or(`category.ilike.%${divisionCode}%,category.ilike.%${divisionPrefix}%,material_name.ilike.%${divisionName}%`)
      .limit(20)

    // 2. Build context from existing items to avoid duplicates
    const existingDescriptions = existingItems.map(i => i.description.toLowerCase())

    // 3. Filter DB items that aren't already in the division
    const relevantDbItems: SuggestedItem[] = (dbItems || [])
      .filter(item => !existingDescriptions.some(desc => 
        desc.includes(item.material_name?.toLowerCase() || "") ||
        (item.material_name?.toLowerCase() || "").includes(desc)
      ))
      .slice(0, 5)
      .map(item => ({
        code: item.material_code || divisionCode,
        description: item.material_name,
        type: item.category?.toLowerCase().includes("mo") ? "MO" as const : "Mat." as const,
        unite: item.unit || "unité",
        quantite: 1,
        prix_unitaire: item.unit_price || 0,
        confidence: "high" as const,
        source: "database" as const,
      }))

    // 4. Generate AI suggestions
    const systemPrompt = `Tu es un expert en estimation de construction au Quebec. Tu generes des items de soumission detailles pour des projets de construction.

Pour chaque item, fournis:
- code: Code MasterFormat (ex: "06 11 10")
- description: Description complete de l'item
- type: "MO" pour main-d'oeuvre, "Mat." pour materiel
- unite: Unite de mesure (h, pi.li., pi², m², unité, etc.)
- quantite: Quantite suggeree (estimation raisonnable)
- prix_unitaire: Prix unitaire en dollars CAD (taux CCQ pour MO, prix marche pour Mat.)

Reponds UNIQUEMENT avec un tableau JSON valide. Pas de texte avant ou apres.`

    const userPrompt = `${prompt}

Contexte complet du projet:
- Nom: ${projectName}
- Categorie RBQ: ${projectCategory || "B"}
- Division cible: ${divisionCode} - ${divisionName || DIVISIONS_MASTERFORMAT[divisionCode] || ""}
${taskListName ? `- Liste de taches: ${taskListName}` : ""}
${allProjectPhases && allProjectPhases.length > 0 ? `
Toutes les phases et divisions du projet (pour coherence et eviter les doublons inter-phases):
${allProjectPhases.map(p => `  Phase "${p.nom}": ${p.divisions.map(d => `Div.${d.code} - ${DIVISIONS_MASTERFORMAT[d.code] || d.nom} (${d.itemCount} items)`).join(", ")}`).join("\n")}
` : ""}
Items existants dans cette division (NE PAS repeter):
${existingItems.map(i => `- ${i.description}`).join("\n") || "Aucun item existant"}

Genere 5 a 10 items SPECIFIQUES et REALISTES pour cette division, coherents avec l'ensemble du projet. Pour la main-d'oeuvre, utilise les taux CCQ (environ 85-105$/h selon le metier). Tiens compte des autres phases/divisions pour suggerer des items complementaires et non redundants.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", errorText)
      // Return just DB items if AI fails
      return NextResponse.json({ items: relevantDbItems })
    }

    const data = await response.json()
    const aiContent = data.choices?.[0]?.message?.content || "[]"

    // Parse AI response
    let aiItems: SuggestedItem[] = []
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = aiContent
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      
      const parsed = JSON.parse(jsonStr.trim())
      aiItems = (Array.isArray(parsed) ? parsed : []).map((item: any) => ({
        code: item.code || divisionCode,
        description: item.description || "",
        type: item.type === "MO" ? "MO" : "Mat.",
        unite: item.unite || "unité",
        quantite: Number(item.quantite) || 1,
        prix_unitaire: Number(item.prix_unitaire) || 0,
        confidence: "medium" as const,
        source: "ai" as const,
      }))
    } catch (e) {
      console.error("[v0] Failed to parse AI suggestions:", e)
    }

    // Combine DB items (high confidence) with AI items (medium confidence)
    const allItems = [...relevantDbItems, ...aiItems]
      // Remove duplicates
      .filter((item, index, self) => 
        index === self.findIndex(i => 
          i.description.toLowerCase() === item.description.toLowerCase()
        )
      )

    return NextResponse.json({ items: allItems })
  } catch (error) {
    console.error("[v0] Suggestions API error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la generation des suggestions" },
      { status: 500 }
    )
  }
}
