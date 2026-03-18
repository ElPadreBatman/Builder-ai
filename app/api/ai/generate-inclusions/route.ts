import { NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

// Generate smart fallback inclusions/exclusions based on project
function generateFallbackInclusionsExclusions(divisions: any[]) {
  const hasMO = divisions.some(d => d.items?.some((it: any) => it.type === "MO"))
  const hasMat = divisions.some(d => d.items?.some((it: any) => it.type === "Mat." || it.type === "Mat"))
  
  const inclusions = [
    hasMO ? "Main-d'oeuvre qualifiee selon les divisions specifiees" : null,
    hasMat ? "Materiaux de qualite selon les specifications" : null,
    "Permis de construction et inspections requises",
    "Nettoyage quotidien du chantier",
    "Protection des surfaces et aires de travail",
    "Coordination des travaux et sous-traitants",
    "Garantie sur les travaux (1 an main-d'oeuvre)",
    "Assurance responsabilite civile du contracteur",
    "Gestion des debris et evacuation",
    "Respect des normes du Code de construction du Quebec",
  ].filter(Boolean) as string[]

  const exclusions = [
    "Travaux imprevus ou caches non visibles lors de la visite",
    "Decontamination (amiante, moisissure, plomb, vermiculite)",
    "Reparations structurales majeures non prevues",
    "Mise a niveau electrique complete du batiment",
    "Travaux de plomberie au-dela de la portee specifiee",
    "Ameublement, decoration et accessoires",
    "Amenagement paysager et travaux exterieurs",
    "Taxes (TPS/TVQ montrees separement)",
  ]

  return { inclusions, exclusions }
}

export async function POST(request: Request) {
  const { projectName, portee_travaux, divisions, existingInclusions, existingExclusions } = await request.json()

  try {
    // Build context from divisions
    const divisionsText = divisions.map((div: any) => {
      const items = div.items?.map((it: any) => `${it.description} (${it.type})`).slice(0, 10).join(", ") || ""
      return `- ${div.nom || div.code}: ${items}`
    }).join("\n")

    const existingInclusionsText = existingInclusions?.length > 0 
      ? `\nINCLUSIONS EXISTANTES (a completer):\n${existingInclusions.join("\n")}`
      : ""
    
    const existingExclusionsText = existingExclusions?.length > 0 
      ? `\nEXCLUSIONS EXISTANTES (a completer):\n${existingExclusions.join("\n")}`
      : ""

    const prompt = `Tu es un expert en estimation de construction au Quebec. Genere les inclusions et exclusions pour une soumission de construction.

PROJET: ${projectName}
PORTEE DES TRAVAUX: ${portee_travaux || "Non specifiee"}

DIVISIONS ET ITEMS:
${divisionsText}
${existingInclusionsText}
${existingExclusionsText}

INSTRUCTIONS:
- Genere 8-12 inclusions pertinentes basees sur les travaux
- Genere 6-10 exclusions typiques pour ce type de projet
- Les inclusions doivent etre specifiques aux travaux decrits
- Les exclusions doivent couvrir les elements couramment omis
- Utilise un langage professionnel et precis
- Chaque item doit etre court (1 ligne max)
- En francais quebecois

REPONDS EN FORMAT JSON UNIQUEMENT:
{
  "inclusions": ["item1", "item2", ...],
  "exclusions": ["item1", "item2", ...]
}`

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 1000,
    })

    // Parse JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json({
        inclusions: parsed.inclusions || [],
        exclusions: parsed.exclusions || [],
      })
    }

    throw new Error("Invalid JSON response")
  } catch (error: any) {
    console.error("Erreur generation inclusions/exclusions (using fallback):", error?.message || error)
    
    // Return smart fallback based on project divisions
    const fallback = generateFallbackInclusionsExclusions(divisions)
    return NextResponse.json({
      ...fallback,
      fallback: true
    })
  }
}
