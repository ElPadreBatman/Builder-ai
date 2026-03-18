import { NextResponse } from "next/server"
import { checkSubscriptionStatus } from "@/lib/subscription-check"

export async function GET() {
  try {
    const status = await checkSubscriptionStatus()
    return NextResponse.json(status)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check subscription status" },
      { status: 500 }
    )
  }
}
