import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DivisionItem {
  code: string
  description: string
  type: "Mat." | "MO" | "Loc." | "ST"
  unit: string
  quantity: number
  unit_price: number
  price_source: "database" | "estimation"
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { division_code, division_name, items } = body

    if (!division_code || !division_name || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "division_code, division_name, and items array are required" },
        { status: 400 }
      )
    }

    // Get checklist for this division type to validate
    const normalizedDivisionName = division_name.toLowerCase().replace(/\s+/g, "_")
    const { data: checklist } = await supabase
      .from("assembly_checklists")
      .select("minimum_lines, required_items")
      .ilike("assembly_type", `%${normalizedDivisionName.split("_")[0]}%`)
      .limit(1)

    const minimumRequired = checklist?.[0]?.minimum_lines || 5
    const requiredItems = checklist?.[0]?.required_items || []

    // Build markdown table
    let markdown = `### ${division_code} - ${division_name}\n\n`
    markdown += `| Code | Description | Type | Unite | Qte | Prix un. | Total |\n`
    markdown += `|------|-------------|------|-------|-----|----------|-------|\n`

    let subtotal = 0
    const missingItems: string[] = []

    for (const item of items as DivisionItem[]) {
      const total = item.quantity * item.unit_price
      subtotal += total

      // Mark estimations
      const priceDisplay = item.price_source === "estimation"
        ? `${item.unit_price.toFixed(2)}$ *`
        : `${item.unit_price.toFixed(2)}$`

      markdown += `| ${item.code} | ${item.description} | ${item.type} | ${item.unit} | ${item.quantity} | ${priceDisplay} | ${total.toFixed(2)}$ |\n`
    }

    markdown += `\n**Sous-total ${division_code}:** ${subtotal.toFixed(2)}$\n`

    // Check if estimation items exist
    const hasEstimations = (items as DivisionItem[]).some(i => i.price_source === "estimation")
    if (hasEstimations) {
      markdown += `\n_* Prix estime - non disponible en base de donnees_\n`
    }

    // Validate against checklist
    const meetsMinimum = items.length >= minimumRequired

    // Check for missing required categories
    if (requiredItems.length > 0) {
      const itemDescriptions = (items as DivisionItem[]).map(i => i.description.toLowerCase())
      
      for (const req of requiredItems as Array<{ category: string; items: string[]; mandatory: boolean }>) {
        if (req.mandatory) {
          const hasCategoryItem = req.items.some(reqItem => 
            itemDescriptions.some(desc => desc.includes(reqItem.toLowerCase().split(" ")[0]))
          )
          if (!hasCategoryItem) {
            missingItems.push(`${req.category}: ${req.items.join(", ")}`)
          }
        }
      }
    }

    return NextResponse.json({
      markdown,
      subtotal: Math.round(subtotal * 100) / 100,
      line_count: items.length,
      validation: {
        meets_minimum: meetsMinimum,
        minimum_required: minimumRequired,
        missing_items: missingItems.length > 0 ? missingItems : undefined,
        has_estimations: hasEstimations,
      },
    })
  } catch (error) {
    console.error("Error in generate-division:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
