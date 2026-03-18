import { NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

export const maxDuration = 60

interface TaskListItem {
  description: string
  type: string
  heures: number
}

interface TaskListDetail {
  nom: string
  items: TaskListItem[]
  heures_mo: number
}

interface DivisionSummary {
  code: string
  nom: string
  heures_mo: number
  nb_items: number
  listes: TaskListDetail[]
  items_sans_liste: TaskListItem[]
}

interface RequestBody {
  projectName: string
  client?: string
  adresse?: string
  dateDebut: string
  divisions: DivisionSummary[]
  portee_travaux: string
}

interface EcheancierItem {
  id: string
  tache: string
  division?: string
  duree_jours: number
  date_debut: string
  date_fin: string
  predecesseur?: string
  responsable?: string
}

// Fallback schedule generator - uses task lists for more detailed schedule
function generateFallbackSchedule(dateDebut: string, divisions: DivisionSummary[]): EcheancierItem[] {
  const items: EcheancierItem[] = []
  let currentDate = new Date(dateDebut)
  let itemId = 1

  // Add mobilization
  const mobilStart = currentDate.toISOString().split("T")[0]
  currentDate.setDate(currentDate.getDate() + 1)
  items.push({
    id: `ECH-${itemId++}`,
    tache: "Mobilisation et preparation du chantier",
    duree_jours: 1,
    date_debut: mobilStart,
    date_fin: currentDate.toISOString().split("T")[0],
  })

  for (const div of divisions) {
    // If division has task lists, create tasks from them
    if (div.listes && div.listes.length > 0) {
      for (const liste of div.listes) {
        const dureeJours = Math.max(1, Math.ceil(liste.heures_mo / 8))
        const dateDebutStr = currentDate.toISOString().split("T")[0]
        currentDate.setDate(currentDate.getDate() + dureeJours)
        const dateFinStr = currentDate.toISOString().split("T")[0]

        items.push({
          id: `ECH-${itemId++}`,
          tache: liste.nom,
          division: div.code,
          duree_jours: dureeJours,
          date_debut: dateDebutStr,
          date_fin: dateFinStr,
          predecesseur: items.length > 0 ? items[items.length - 1].id : undefined,
        })
      }
    } else {
      // No task lists - use division as single task
      const dureeJours = Math.max(1, Math.ceil(div.heures_mo / 8))
      const dateDebutStr = currentDate.toISOString().split("T")[0]
      currentDate.setDate(currentDate.getDate() + dureeJours)
      const dateFinStr = currentDate.toISOString().split("T")[0]

      items.push({
        id: `ECH-${itemId++}`,
        tache: div.nom || `Division ${div.code}`,
        division: div.code,
        duree_jours: dureeJours,
        date_debut: dateDebutStr,
        date_fin: dateFinStr,
        predecesseur: items.length > 0 ? items[items.length - 1].id : undefined,
      })
    }
  }

  // Add cleanup/demobilization
  const cleanupStart = currentDate.toISOString().split("T")[0]
  currentDate.setDate(currentDate.getDate() + 1)
  items.push({
    id: `ECH-${itemId++}`,
    tache: "Nettoyage et demobilisation",
    duree_jours: 1,
    date_debut: cleanupStart,
    date_fin: currentDate.toISOString().split("T")[0],
    predecesseur: items.length > 0 ? items[items.length - 1].id : undefined,
  })

  return items
}

export async function POST(req: Request) {
  try {
    const { projectName, client, adresse, dateDebut, divisions, portee_travaux }: RequestBody = await req.json()

    // Try AI generation
    try {
      // Build detailed summary with task lists and items
      const divisionsSummary = divisions.map(div => {
        let summary = `\n## Division ${div.code} - ${div.nom} (${div.heures_mo}h MO total, ${div.nb_items} items)`
        
        if (div.listes && div.listes.length > 0) {
          for (const liste of div.listes) {
            summary += `\n  ### Liste: ${liste.nom} (${liste.heures_mo}h MO)`
            if (liste.items && liste.items.length > 0) {
              for (const item of liste.items.slice(0, 8)) {
                summary += `\n    - ${item.description} (${item.type}${item.heures > 0 ? `, ${item.heures}h` : ""})`
              }
              if (liste.items.length > 8) {
                summary += `\n    - ... et ${liste.items.length - 8} autres items`
              }
            }
          }
        }
        
        if (div.items_sans_liste && div.items_sans_liste.length > 0) {
          summary += `\n  ### Items sans liste:`
          for (const item of div.items_sans_liste.slice(0, 5)) {
            summary += `\n    - ${item.description} (${item.type}${item.heures > 0 ? `, ${item.heures}h` : ""})`
          }
        }
        
        return summary
      }).join("\n")

      const prompt = `Tu es un chef de chantier experimente au Quebec. Genere un echeancier de travaux detaille et realiste pour ce projet de renovation/construction.

=== INFORMATIONS DU PROJET ===
PROJET: ${projectName}
${client ? `CLIENT: ${client}` : ""}
${adresse ? `ADRESSE: ${adresse}` : ""}
DATE DEBUT SOUHAITEE: ${dateDebut}
${portee_travaux ? `\nPORTEE DES TRAVAUX:\n${portee_travaux}` : ""}

=== DETAIL DES TRAVAUX PAR DIVISION ===
${divisionsSummary}

=== INSTRUCTIONS POUR L'ECHEANCIER ===
1. Analyse les listes de taches et items pour comprendre la sequence logique des travaux
2. Cree des taches basees sur les listes de taches existantes (ex: "Electricite", "Revetements", "Finitions")
3. Respecte l'ordre logique d'un chantier:
   - Demolition/Preparation en premier
   - Travaux structurels et mecaniques (plomberie, electricite rough-in)
   - Isolation, gypse, finitions
   - Peinture et revetements en dernier
4. Ajoute les taches essentielles: mobilisation, inspections si necessaires, nettoyage final
5. Calcule des durees realistes (8h/jour par ouvrier)
6. Ne pas chevaucher les taches - sequence lineaire

Reponds UNIQUEMENT en JSON valide avec ce format exact:
{
  "echeancier": [
    {
      "id": "ECH-1",
      "tache": "Description claire de la tache",
      "division": "CODE_DIVISION ou null",
      "duree_jours": 2,
      "date_debut": "YYYY-MM-DD",
      "date_fin": "YYYY-MM-DD",
      "predecesseur": "ECH-X ou null",
      "responsable": ""
    }
  ]
}

IMPORTANT: 
- Les dates doivent etre consecutives et calculees correctement
- Genere entre 8 et 20 taches selon la complexite
- Utilise les noms des listes de taches comme base pour les taches de l'echeancier
- Ne mets AUCUN texte avant ou apres le JSON`

      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
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
      // AI unavailable - use fallback
      console.log("AI unavailable for echeancier, using fallback:", aiError)
      const fallbackSchedule = generateFallbackSchedule(dateDebut, divisions)
      return NextResponse.json({ 
        echeancier: fallbackSchedule,
        fallback: true
      })
    }

  } catch (error) {
    console.error("Erreur generation echeancier:", error)
    return NextResponse.json(
      { error: "Erreur lors de la generation de l'echeancier" },
      { status: 500 }
    )
  }
}
