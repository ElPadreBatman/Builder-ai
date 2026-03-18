import { generateText } from "ai"
import { NextResponse } from "next/server"

export const maxDuration = 60

interface DivisionData {
  code: string
  nom: string
  items: Array<{
    description: string
    quantite: number
    unite: string
    type: string
  }>
}

interface RequestBody {
  divisions: DivisionData[]
  projectName: string
  inclusions: string[]
  exclusions: string[]
}

// Fallback: generate simple descriptions from items without AI
function generateFallbackDescriptions(divisions: DivisionData[]): Record<string, string> {
  const result: Record<string, string> = {}
  
  for (const div of divisions) {
    // Get unique material items (not MO)
    const materialItems = div.items
      .filter(item => item.type !== "MO" && item.description)
      .slice(0, 5)
    
    // Get labor items
    const laborItems = div.items.filter(item => item.type === "MO")
    
    let description = ""
    
    if (materialItems.length > 0) {
      const materials = materialItems
        .map(item => `${item.description} (${item.quantite} ${item.unite})`)
        .join(", ")
      description += `Fourniture et installation: ${materials}.`
    }
    
    if (laborItems.length > 0) {
      const totalHours = laborItems.reduce((sum, item) => sum + item.quantite, 0)
      description += ` Main-d'oeuvre: ${totalHours.toFixed(1)} heures.`
    }
    
    if (!description) {
      description = `Travaux de ${div.nom.toLowerCase()} selon devis.`
    }
    
    result[div.code] = description.trim()
  }
  
  return result
}

export async function POST(req: Request) {
  try {
    const { divisions, projectName, inclusions, exclusions }: RequestBody = await req.json()

    // Try AI generation first, fallback to simple descriptions if unavailable
    try {
      // Build a concise prompt for each division
      const divisionsPrompt = divisions.map(div => {
        const itemsSummary = div.items
          .slice(0, 10)
          .map(item => `- ${item.description} (${item.quantite} ${item.unite})`)
          .join("\n")
        
        return `Division ${div.code} - ${div.nom}:
${itemsSummary}${div.items.length > 10 ? `\n... et ${div.items.length - 10} autres items` : ""}`
      }).join("\n\n")

      const prompt = `Tu es un estimateur en construction au Québec. Génère une description sommaire CLAIRE et SIMPLE pour chaque division de ce projet de construction.

PROJET: ${projectName}

DIVISIONS ET LEURS ITEMS:
${divisionsPrompt}

${inclusions.length > 0 ? `INCLUSIONS: ${inclusions.join(", ")}` : ""}
${exclusions.length > 0 ? `EXCLUSIONS: ${exclusions.join(", ")}` : ""}

INSTRUCTIONS:
- Écris en français simple, phrases courtes (max 15 mots par phrase)
- Utilise des listes à puces quand approprié
- Décris les travaux de façon compréhensible pour un client non-expert
- 2-4 phrases par division maximum
- Mentionne les matériaux principaux
- Sois précis mais accessible

Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "divisions": {
    "CODE_DIVISION": "Description claire des travaux pour cette division...",
    ...
  }
}

Ne mets AUCUN texte avant ou après le JSON.`

      const { text } = await generateText({
        model: "anthropic/claude-sonnet-4-20250514",
        prompt,
        maxTokens: 2000,
      })

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("Invalid AI response format")
      }

      const result = JSON.parse(jsonMatch[0])
      return NextResponse.json(result)

    } catch (aiError) {
      // AI unavailable - use fallback descriptions
      console.log("AI unavailable, using fallback descriptions:", aiError)
      const fallbackResult = generateFallbackDescriptions(divisions)
      return NextResponse.json({ 
        divisions: fallbackResult,
        fallback: true // Indicate that fallback was used
      })
    }

  } catch (error) {
    console.error("Erreur génération sommaire:", error)
    return NextResponse.json(
      { error: "Erreur lors de la génération du sommaire" },
      { status: 500 }
    )
  }
}
