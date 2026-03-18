// Subscription Plans Configuration
// Product IDs from Stripe
export const STRIPE_PRODUCTS = {
  BASE: "prod_U8R6j6gu9LQA4Z",
  PRO: "prod_U8R6kEFPl1ptGJ",
} as const

// Price IDs from Stripe
export const STRIPE_PRICES = {
  BASE_MONTHLY: "price_1TAAF1BVkC0EFbPE1lFaEW5H",
  BASE_YEARLY: "price_1TAAF1BVkC0EFbPEXaxOvJKi",
  PRO_MONTHLY: "price_1TAAF1BVkC0EFbPEphs4kFl9",
  PRO_YEARLY: "price_1TAAF1BVkC0EFbPEIYhBu0wG",
} as const

export type PlanType = "free" | "base" | "pro"
export type BillingInterval = "monthly" | "yearly"

export interface PlanFeatures {
  users: number
  projectsPerMonth: number
  soumissionsPerMonth: number
  support: "community" | "email" | "priority"
  features: string[]
}

export interface Plan {
  id: PlanType
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  yearlyDiscount: number
  stripePriceMonthly: string | null
  stripePriceYearly: string | null
  features: PlanFeatures
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Essai Gratuit",
    description: "7 jours pour essayer BuilderAI",
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: 0,
    stripePriceMonthly: null,
    stripePriceYearly: null,
    features: {
      users: 1,
      projectsPerMonth: 3,
      soumissionsPerMonth: 5,
      support: "community",
      features: [
        "1 utilisateur",
        "3 projets",
        "5 soumissions",
        "Support communautaire",
        "Valide 7 jours",
      ],
    },
  },
  {
    id: "base",
    name: "Base",
    description: "Pour les entrepreneurs independants",
    monthlyPrice: 39.99,
    yearlyPrice: 383.90, // 20% off (39.99 * 12 * 0.8)
    yearlyDiscount: 20,
    stripePriceMonthly: STRIPE_PRICES.BASE_MONTHLY,
    stripePriceYearly: STRIPE_PRICES.BASE_YEARLY,
    features: {
      users: 1,
      projectsPerMonth: 30,
      soumissionsPerMonth: 20,
      support: "email",
      features: [
        "1 utilisateur",
        "30 projets",
        "20 soumissions/mois",
        "Support par courriel",
        "Export Excel",
        "Historique des versions",
      ],
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Pour les equipes et entreprises",
    monthlyPrice: 69.99,
    yearlyPrice: 671.90, // 20% off (69.99 * 12 * 0.8)
    yearlyDiscount: 20,
    stripePriceMonthly: STRIPE_PRICES.PRO_MONTHLY,
    stripePriceYearly: STRIPE_PRICES.PRO_YEARLY,
    popular: true,
    features: {
      users: 3,
      projectsPerMonth: -1, // unlimited
      soumissionsPerMonth: -1, // unlimited
      support: "priority",
      features: [
        "Jusqu'a 3 utilisateurs",
        "Projets illimites",
        "Soumissions illimitees",
        "Support prioritaire",
        "Export Excel & PDF",
        "Historique des versions",
        "Personnalisation du logo",
        "API access",
      ],
    },
  },
]

export function getPlanById(id: PlanType): Plan | undefined {
  return PLANS.find((plan) => plan.id === id)
}

export function getPriceId(planId: PlanType, interval: BillingInterval): string | null {
  const plan = getPlanById(planId)
  if (!plan) return null
  return interval === "monthly" ? plan.stripePriceMonthly : plan.stripePriceYearly
}

export function formatPrice(amount: number, currency = "CAD"): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
  }).format(amount)
}

// Trial configuration
export const TRIAL_DAYS = 7
export const GRACE_PERIOD_DAYS = 2 // Days after payment failure before cancellation
