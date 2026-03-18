import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { item_type, unit_price, unit, includes_labor = false } = body

    if (!item_type || unit_price === undefined || !unit) {
      return NextResponse.json(
        { error: "item_type, unit_price, and unit are required" },
        { status: 400 }
      )
    }

    // Normalize item_type
    const normalizedType = item_type.toLowerCase().replace(/\s+/g, "_")

    // Search for matching price range
    let { data: rangeData } = await supabase
      .from("market_price_ranges")
      .select("*")
      .eq("item_type", normalizedType)
      .eq("unit", unit)
      .eq("includes_labor", includes_labor)
      .limit(1)

    // If not found, try partial match
    if (!rangeData?.length) {
      const { data } = await supabase
        .from("market_price_ranges")
        .select("*")
        .ilike("item_type", `%${normalizedType.split("_")[0]}%`)
        .eq("includes_labor", includes_labor)
        .limit(1)
      
      rangeData = data
    }

    // If still not found, try without unit constraint
    if (!rangeData?.length) {
      const { data } = await supabase
        .from("market_price_ranges")
        .select("*")
        .ilike("item_type", `%${normalizedType.split("_")[0]}%`)
        .limit(1)
      
      rangeData = data
    }

    const range = rangeData?.[0]

    if (range) {
      const minPrice = Number(range.min_price)
      const maxPrice = Number(range.max_price)
      const price = Number(unit_price)

      const isValid = price >= minPrice && price <= maxPrice
      let suggestedPrice = null
      let message = ""

      if (price < minPrice) {
        suggestedPrice = minPrice
        message = `Prix trop bas. Etait ${price.toFixed(2)}$, ajuste a ${minPrice.toFixed(2)}$ (minimum marche)`
      } else if (price > maxPrice) {
        suggestedPrice = maxPrice
        message = `Prix trop eleve. Etait ${price.toFixed(2)}$, ajuste a ${maxPrice.toFixed(2)}$ (maximum marche)`
      } else {
        message = `Prix valide dans la fourchette marche (${minPrice.toFixed(2)}$ - ${maxPrice.toFixed(2)}$)`
      }

      return NextResponse.json({
        valid: isValid,
        original_price: price,
        market_range: { min: minPrice, max: maxPrice },
        suggested_price: suggestedPrice,
        correction_needed: !isValid,
        message,
      })
    }

    // No range found - cannot validate
    return NextResponse.json({
      valid: true,
      original_price: Number(unit_price),
      market_range: null,
      suggested_price: null,
      correction_needed: false,
      message: "Aucune fourchette de prix trouvee pour cet item. Prix accepte sans validation.",
    })
  } catch (error) {
    console.error("Error in validate-price:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
