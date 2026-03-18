"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Sparkles, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PLANS, formatPrice, type BillingInterval } from "@/lib/subscription"
import { createCheckoutSession } from "@/app/actions/stripe"
import { createClient } from "@/lib/supabase/client"

function PricingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  
  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")
  const expired = searchParams.get("expired")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email || "" })
        // Fetch current subscription
        supabase
          .from("profiles")
          .select("subscription_type")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            setCurrentPlan(data?.subscription_type || "free")
          })
      }
    })
  }, [])

  const handleSubscribe = async (planId: string) => {
    // Not logged in — redirect to signup with selected plan (same as landing page)
    if (!user) {
      if (planId === "free") {
        router.push("/signup?plan=free")
      } else {
        router.push(`/signup?plan=${planId}&interval=${billingInterval}`)
      }
      return
    }

    if (planId === "free") {
      router.push("/chat")
      return
    }

    setLoadingPlan(planId)
    try {
      const { url } = await createCheckoutSession(planId as "base" | "pro", billingInterval)
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-xl">BuilderAI</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      {/* Success/Cancel Messages */}
      {success && (
        <div className="bg-green-50 border-b border-green-200 p-4">
          <div className="container mx-auto text-center text-green-800">
            Felicitations! Votre abonnement a ete active avec succes. Votre essai gratuit de 7 jours commence maintenant.
          </div>
        </div>
      )}
      {canceled && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-4">
          <div className="container mx-auto text-center text-yellow-800">
            Le paiement a ete annule. Vous pouvez reessayer a tout moment.
          </div>
        </div>
      )}
      {expired && (
        <div className="bg-red-50 border-b border-red-200 p-4">
          <div className="container mx-auto text-center text-red-800 font-medium">
            Votre essai gratuit a expire. Choisissez un plan pour continuer a utiliser BuilderAI.
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="py-16 text-center">
        <div className="container mx-auto px-4">
          <Badge variant="secondary" className="mb-4">Essai gratuit de 7 jours</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Commencez avec un essai gratuit de 7 jours. Annulez a tout moment.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <Label htmlFor="billing" className={billingInterval === "monthly" ? "text-gray-900" : "text-gray-500"}>
              Mensuel
            </Label>
            <Switch
              id="billing"
              checked={billingInterval === "yearly"}
              onCheckedChange={(checked) => setBillingInterval(checked ? "yearly" : "monthly")}
            />
            <Label htmlFor="billing" className={billingInterval === "yearly" ? "text-gray-900" : "text-gray-500"}>
              Annuel
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">-20%</Badge>
            </Label>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PLANS.map((plan) => {
              const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice / 12
              const isCurrentPlan = currentPlan === plan.id
              const isPopular = plan.popular
              
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    isPopular
                      ? "border-orange-500 border-2 shadow-lg scale-105"
                      : "border-gray-200"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-orange-500 text-white">Le plus populaire</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatPrice(price)}
                      </span>
                      {plan.id !== "free" && (
                        <span className="text-gray-500">/mois</span>
                      )}
                      {billingInterval === "yearly" && plan.id !== "free" && (
                        <p className="text-sm text-green-600 mt-1">
                          {formatPrice(plan.yearlyPrice)} facture annuellement
                        </p>
                      )}
                    </div>
                    <ul className="space-y-3">
                      {plan.features.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={`w-full ${
                        isPopular
                          ? "bg-orange-500 hover:bg-orange-600"
                          : plan.id === "free"
                          ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                          : ""
                      }`}
                      variant={isPopular ? "default" : plan.id === "free" ? "secondary" : "outline"}
                      disabled={isCurrentPlan || loadingPlan === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Chargement...
                        </>
                      ) : isCurrentPlan ? (
                        "Plan actuel"
                      ) : plan.id === "free" ? (
                        "Commencer gratuitement"
                      ) : (
                        "Choisir ce plan"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ or Features */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Questions frequentes</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
            <div>
              <h3 className="font-semibold mb-2">Comment fonctionne l&apos;essai gratuit?</h3>
              <p className="text-gray-600">
                Vous avez 7 jours pour tester toutes les fonctionnalites. Aucune carte de credit requise pour commencer.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Puis-je annuler a tout moment?</h3>
              <p className="text-gray-600">
                Oui, vous pouvez annuler votre abonnement a tout moment depuis votre profil. Pas de frais caches.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Que se passe-t-il si je ne paie pas?</h3>
              <p className="text-gray-600">
                Vous avez 2 jours de grace apres l&apos;echeance. Passe ce delai, votre abonnement sera suspendu.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Puis-je changer de plan?</h3>
              <p className="text-gray-600">
                Oui, vous pouvez passer a un plan superieur ou inferieur a tout moment. Le changement sera proratise.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// Wrapper with Suspense for useSearchParams
export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent" />
      </div>
    }>
      <PricingPageContent />
    </Suspense>
  )
}
