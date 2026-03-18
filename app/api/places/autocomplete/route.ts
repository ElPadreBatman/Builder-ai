import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get("input")

  if (!input || input.length < 3) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY is not configured")
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    )
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json")
    url.searchParams.set("input", input)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("types", "address")
    url.searchParams.set("components", "country:ca") // Canada only
    url.searchParams.set("language", "fr")

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return NextResponse.json({
        predictions: data.predictions || [],
      })
    }

    console.error("Google Places API error:", data.status, data.error_message)
    return NextResponse.json(
      { error: data.error_message || "Failed to fetch predictions" },
      { status: 500 }
    )
  } catch (error) {
    console.error("Error fetching place predictions:", error)
    return NextResponse.json(
      { error: "Failed to fetch address predictions" },
      { status: 500 }
    )
  }
}
