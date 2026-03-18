// app/api/ai/auto-organize/route.ts
// AI-powered organization of items into task lists within a division

import { NextResponse } from "next/server"
import { DIVISIONS_MASTERFORMAT } from "@/types/soumission"

interface Item {
  id?: string
  code?: string
  description: string
  type: string
  quantite: number
  unite: string
  prix_unitaire: number
  task_list_id?: string
  order?: number
}

interface OrganizeRequest {
  divisionCode: string
  divisionName: string
  items: Item[]
  existingLists: Array<{ id: string; name: string }>
}

interface OrganizedResult {
  task_lists: Array<{
    id: string
    name: string
    color: string
    order: number
  }>
  items: Array<Item & { task_list_id: string; order: number }>
}

// Predefined colors for task lists
const LIST_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
]

export async function POST(request: Request) {
  try {
    const body: OrganizeRequest = await request.json()
    const { divisionCode, divisionName, items, existingLists } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "La cle API OpenAI n'est pas configuree" },
        { status: 500 }
      )
    }

    if (items.length === 0) {
      return NextResponse.json({ task_lists: [], items: [] })
    }

    const systemPrompt = `Tu es un expert en organisation de projets de construction. Tu organises les items d'une division en groupes logiques (listes de taches).

Regles:
1. Cree 2 a 5 listes de taches pertinentes pour la division
2. Chaque liste doit avoir un nom court et descriptif (ex: "Charpente", "Finition", "Structure")
3. Assigne chaque item a une liste appropriee
4. Si un item ne correspond a aucune categorie, mets-le dans "Autres"
5. Ordonne les items logiquement dans chaque liste (preparation avant installation, etc.)

Reponds UNIQUEMENT avec un JSON valide selon ce format:
{
  "lists": [
    { "name": "Nom de la liste", "item_indices": [0, 2, 5] }
  ]
}

Les indices correspondent a la position de l'item dans le tableau fourni (commence a 0).`

    const itemsList = items.map((item, idx) => 
      `${idx}. [${item.type}] ${item.description} (${item.quantite} ${item.unite})`
    ).join("\n")

    const userPrompt = `Organise ces items de la division ${divisionCode} - ${divisionName || DIVISIONS_MASTERFORMAT[divisionCode] || ""}:

${itemsList}

${existingLists.length > 0 ? `
Listes existantes a reutiliser si pertinent:
${existingLists.map(l => `- ${l.name}`).join("\n")}
` : ""}`

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
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", errorText)
      // Fallback: put all in "Autres"
      return NextResponse.json(createFallbackOrganization(items))
    }

    const data = await response.json()
    const aiContent = data.choices?.[0]?.message?.content || "{}"

    // Parse AI response
    let parsed: { lists: Array<{ name: string; item_indices: number[] }> }
    try {
      let jsonStr = aiContent
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      parsed = JSON.parse(jsonStr.trim())
    } catch (e) {
      console.error("[v0] Failed to parse AI organization:", e)
      return NextResponse.json(createFallbackOrganization(items))
    }

    // Build result
    const result: OrganizedResult = {
      task_lists: [],
      items: [],
    }

    // Track which items have been assigned
    const assignedIndices = new Set<number>()

    // Create task lists and assign items
    parsed.lists?.forEach((list, listIdx) => {
      const listId = existingLists.find(l => l.name.toLowerCase() === list.name.toLowerCase())?.id 
        || `list-${Date.now()}-${listIdx}`
      
      result.task_lists.push({
        id: listId,
        name: list.name,
        color: LIST_COLORS[listIdx % LIST_COLORS.length],
        order: listIdx,
      })

      list.item_indices?.forEach((itemIdx, orderInList) => {
        if (itemIdx >= 0 && itemIdx < items.length && !assignedIndices.has(itemIdx)) {
          assignedIndices.add(itemIdx)
          result.items.push({
            ...items[itemIdx],
            task_list_id: listId,
            order: orderInList,
          })
        }
      })
    })

    // Add unassigned items to "Autres"
    const unassignedItems = items.filter((_, idx) => !assignedIndices.has(idx))
    if (unassignedItems.length > 0) {
      const autresId = existingLists.find(l => l.name.toLowerCase() === "autres")?.id 
        || `list-${Date.now()}-autres`
      
      if (!result.task_lists.find(l => l.name.toLowerCase() === "autres")) {
        result.task_lists.push({
          id: autresId,
          name: "Autres",
          color: "#6B7280", // gray
          order: result.task_lists.length,
        })
      }

      unassignedItems.forEach((item, idx) => {
        result.items.push({
          ...item,
          task_list_id: autresId,
          order: idx,
        })
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Auto-organize API error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'organisation automatique" },
      { status: 500 }
    )
  }
}

function createFallbackOrganization(items: Item[]): OrganizedResult {
  const listId = `list-${Date.now()}-autres`
  return {
    task_lists: [{
      id: listId,
      name: "Autres",
      color: "#6B7280",
      order: 0,
    }],
    items: items.map((item, idx) => ({
      ...item,
      task_list_id: listId,
      order: idx,
    })),
  }
}
