import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { item_code, description, unit, category } = body

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      )
    }

    // Try to find by item_code first if provided
    let result = null
    
    if (item_code) {
      const { data } = await supabase
        .from("construction_prices")
        .select("*")
        .eq("item_code", item_code)
        .limit(1)
        .single()
      
      result = data
    }

    // If not found by code, search by description
    if (!result) {
      let query = supabase
        .from("construction_prices")
        .select("*")
        .textSearch("description", description.replace(/\s+/g, " & "), {
          type: "websearch",
          config: "french"
        })

      if (category) {
        query = query.eq("category", category)
      }
      if (unit) {
        query = query.eq("unit", unit)
      }

      const { data } = await query.limit(1)
      result = data?.[0]
    }

    // If still not found, try a simpler ILIKE search
    if (!result) {
      let query = supabase
        .from("construction_prices")
        .select("*")
        .ilike("description", `%${description}%`)

      if (category) {
        query = query.eq("category", category)
      }
      if (unit) {
        query = query.eq("unit", unit)
      }

      const { data } = await query.limit(1)
      result = data?.[0]
    }

    if (result) {
      return NextResponse.json({
        found: true,
        price: result.price,
        unit: result.unit,
        source: "database",
        item_code: result.item_code,
        description: result.description,
        last_updated: result.last_updated,
        market_range: result.market_min && result.market_max 
          ? { min: result.market_min, max: result.market_max }
          : null,
      })
    }

    // Check market_price_ranges for a fallback range
    const { data: rangeData } = await supabase
      .from("market_price_ranges")
      .select("*")
      .ilike("item_type", `%${description.split(" ")[0]}%`)
      .limit(1)

    const marketRange = rangeData?.[0]

    return NextResponse.json({
      found: false,
      source: "not_found",
      message: "Prix non disponible en base de données. Utiliser une estimation avec validation.",
      market_range: marketRange 
        ? { min: marketRange.min_price, max: marketRange.max_price }
        : null,
    })
  } catch (error) {
    console.error("Error in get-price:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
