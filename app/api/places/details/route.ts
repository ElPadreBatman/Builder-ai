import { NextResponse } from "next/server"

interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

function extractAddressComponents(components: AddressComponent[]) {
  const result: Record<string, string> = {}
  
  for (const component of components) {
    if (component.types.includes("street_number")) {
      result.street_number = component.long_name
    }
    if (component.types.includes("route")) {
      result.route = component.long_name
    }
    if (component.types.includes("locality")) {
      result.city = component.long_name
    }
    if (component.types.includes("administrative_area_level_1")) {
      result.province = component.short_name
    }
    if (component.types.includes("postal_code")) {
      result.postal_code = component.long_name
    }
    if (component.types.includes("country")) {
      result.country = component.long_name
    }
  }
  
  return result
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get("place_id")

  if (!placeId) {
    return NextResponse.json(
      { error: "place_id is required" },
      { status: 400 }
    )
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
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
    url.searchParams.set("place_id", placeId)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("fields", "formatted_address,address_components,geometry")
    url.searchParams.set("language", "fr")

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status === "OK" && data.result) {
      const addressComponents = extractAddressComponents(data.result.address_components || [])
      
      return NextResponse.json({
        formatted_address: data.result.formatted_address,
        ...addressComponents,
        lat: data.result.geometry?.location?.lat,
        lng: data.result.geometry?.location?.lng,
      })
    }

    console.error("Google Places Details API error:", data.status, data.error_message)
    return NextResponse.json(
      { error: data.error_message || "Failed to fetch place details" },
      { status: 500 }
    )
  } catch (error) {
    console.error("Error fetching place details:", error)
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    )
  }
}
