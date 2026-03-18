import { NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

// Generate a smart fallback mandat based on project details
function generateFallbackMandat(projectName: string, client: string | undefined, adresse: string | undefined, divisions: any[]): string {
  const divisionNames = divisions.map(d => d.nom || d.code).filter(Boolean)
  const taskLists = divisions.flatMap(d => d.taskLists || []).filter(Boolean)
  
  const workDescription = taskLists.length > 0 
    ? taskLists.join(", ")
    : divisionNames.join(", ")

  return `Le present mandat vise la realisation des travaux de renovation${projectName ? ` pour le projet "${projectName}"` : ""}${adresse ? ` situe au ${adresse}` : ""}. 

Les travaux comprennent: ${workDescription || "les divisions specifiees dans cette soumission"}. L'ensemble des travaux seront executes conformement aux normes en vigueur au Quebec, au Code de construction et aux regles de l'art.

Le contracteur s'engage a fournir la main-d'oeuvre qualifiee, les materiaux de qualite et l'equipement necessaire pour mener a bien ce projet dans les delais convenus. Une attention particuliere sera portee a la protection des lieux et au respect des occupants.`
}

export async function POST(request: Request) {
  const { projectName, client, adresse, divisions } = await request.json()

  try {
    // Build context from divisions
    const divisionsText = divisions.map((div: any) => {
      const itemsList = div.items?.slice(0, 8).join(", ") || ""
      const taskListsText = div.taskLists?.length > 0 ? ` (Listes: ${div.taskLists.join(", ")})` : ""
      return `- ${div.nom || div.code}${taskListsText}: ${itemsList}`
    }).join("\n")

    const prompt = `Tu es un expert en estimation de construction au Quebec. Genere un texte de mandat/portee des travaux professionnel pour une soumission.

PROJET: ${projectName}
CLIENT: ${client || "Non specifie"}
ADRESSE: ${adresse || "Non specifiee"}

DIVISIONS ET TRAVAUX INCLUS:
${divisionsText}

INSTRUCTIONS:
- Redige un texte de 3-5 paragraphes decrivant la portee des travaux
- Utilise un ton professionnel et precis
- Mentionne les principales divisions de travaux
- Inclus les objectifs generaux du projet
- Le texte doit etre en francais quebecois
- Ne pas utiliser de puces ou listes, seulement des paragraphes fluides
- Commence directement avec le contenu, sans titre

MANDAT:`

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 800,
    })

    return NextResponse.json({ mandat: result.text.trim() })
  } catch (error: any) {
    console.error("Erreur generation mandat (using fallback):", error?.message || error)
    
    // Return smart fallback response based on project data
    return NextResponse.json({
      mandat: generateFallbackMandat(projectName, client, adresse, divisions),
      fallback: true
    })
  }
}
