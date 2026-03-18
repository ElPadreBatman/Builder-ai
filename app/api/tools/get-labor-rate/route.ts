import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { trade, region = "montreal" } = body

    if (!trade) {
      return NextResponse.json(
        { error: "trade is required" },
        { status: 400 }
      )
    }

    // Normalize trade name
    const normalizedTrade = trade.toLowerCase().replace(/\s+/g, "-")

    // Try exact match first
    let { data: rateData } = await supabase
      .from("ccq_rates")
      .select("*")
      .eq("trade", normalizedTrade)
      .eq("region", region.toLowerCase())
      .limit(1)

    // If not found with exact region, try montreal as fallback
    if (!rateData?.length && region.toLowerCase() !== "montreal") {
      const { data } = await supabase
        .from("ccq_rates")
        .select("*")
        .eq("trade", normalizedTrade)
        .eq("region", "montreal")
        .limit(1)
      
      rateData = data
    }

    // If not found, try partial match on trade name
    if (!rateData?.length) {
      const { data } = await supabase
        .from("ccq_rates")
        .select("*")
        .ilike("trade", `%${normalizedTrade.split("-")[0]}%`)
        .limit(1)
      
      rateData = data
    }

    // Try alternative spellings
    if (!rateData?.length) {
      const alternatives: Record<string, string[]> = {
        "charpentier": ["charpentier-menuisier", "menuisier"],
        "menuisier": ["charpentier-menuisier", "charpentier"],
        "electricien": ["electricien"],
        "plombier": ["plombier"],
        "peintre": ["peintre"],
        "manoeuvre": ["manoeuvre"],
        "macon": ["briqueteur-maçon", "briqueteur"],
        "briqueteur": ["briqueteur-maçon", "macon"],
        "couvreur": ["couvreur"],
        "soudeur": ["soudeur"],
      }

      const baseWord = normalizedTrade.split("-")[0]
      const alts = alternatives[baseWord] || []
      
      for (const alt of alts) {
        const { data } = await supabase
          .from("ccq_rates")
          .select("*")
          .eq("trade", alt)
          .limit(1)
        
        if (data?.length) {
          rateData = data
          break
        }
      }
    }

    const rate = rateData?.[0]

    if (rate) {
      return NextResponse.json({
        found: true,
        trade: rate.trade,
        trade_code: rate.trade_code,
        hourly_rate: Number(rate.hourly_rate),
        region: rate.region,
        source: rate.source || "CCQ_2025",
        includes: rate.includes || ["salaire", "avantages sociaux", "vacances"],
        effective_date: rate.effective_date,
      })
    }

    // Return not found with list of available trades
    const { data: allTrades } = await supabase
      .from("ccq_rates")
      .select("trade")
      .eq("region", "montreal")

    return NextResponse.json({
      found: false,
      trade,
      message: "Taux horaire non trouve pour ce metier. NE PAS INVENTER.",
      available_trades: allTrades?.map(t => t.trade) || [],
    })
  } catch (error) {
    console.error("Error in get-labor-rate:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
