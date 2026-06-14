import "server-only"
import Stripe from "stripe"

let _stripe: Stripe | null = null
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-02-24.acacia",
      })
    }
    return (_stripe as any)[prop as string]
  },
})
