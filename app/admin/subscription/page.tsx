"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Check, Users, Loader2, ExternalLink, CreditCard } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PLANS, formatPrice, type BillingInterval, type PlanType } from "@/lib/subscription"
import { createCheckoutSession, createCustomerPortalSession } from "@/app/actions/stripe"

export default function SubscriptionPage() {
  const [isAdminOrDirector, setIsAdminOrDirector] = useState(false)
  const [currentSubscription, setCurrentSubscription] = useState<PlanType>("free")
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [company, setCompany] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, subscription_type, subscription_status, company")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "director")) {
      router.push("/chat")
      return
    }

    setIsAdminOrDirector(true)
    setCurrentSubscription((profile.subscription_type as PlanType) || "free")
    setSubscriptionStatus(profile.subscription_status || null)
    setCompany(profile.company || "")
    setLoading(false)
  }

  const handleSubscribe = async (planId: PlanType) => {
    if (planId === "free") return

    setLoadingPlan(planId)
    setMessage(null)

    try {
      const { url } = await createCheckoutSession(planId as "base" | "pro", billingInterval)
      if (url) {
        window.location.href = url
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erreur lors de la création de la session" })
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    setLoadingPortal(true)
    try {
      const { url } = await createCustomerPortalSession()
      if (url) {
        window.location.href = url
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erreur lors de l'ouverture du portail" })
    } finally {
      setLoadingPortal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent" />
          <p className="mt-4 text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isAdminOrDirector) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Acces refuse</h2>
          <p className="text-gray-500 mb-4">
            Seuls les administrateurs et directeurs peuvent gerer les abonnements.
          </p>
          <Button onClick={() => router.push("/chat")}>Retour au chat</Button>
        </div>
      </div>
    )
  }

  const currentPlan = PLANS.find(p => p.id === currentSubscription)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Gestion de l&apos;abonnement</h1>
            <p className="text-gray-500">Gerez votre abonnement et vos paiements</p>
          </div>
          {subscriptionStatus && currentSubscription !== "free" && (
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={loadingPortal}
            >
              {loadingPortal ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Gerer le paiement
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Current Plan Status */}
        {currentPlan && (
          <Card className="bg-orange-50 border-orange-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-orange-900">Plan actuel: {currentPlan.name}</CardTitle>
                  <CardDescription className="text-orange-700">
                    {currentPlan.description}
                  </CardDescription>
                </div>
                <Badge 
                  variant={subscriptionStatus === "active" ? "default" : "secondary"}
                  className={subscriptionStatus === "active" ? "bg-green-500" : ""}
                >
                  {subscriptionStatus === "active" ? "Actif" : 
                   subscriptionStatus === "trialing" ? "Essai gratuit" :
                   subscriptionStatus === "past_due" ? "Paiement en retard" : "Inactif"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-orange-600">Utilisateurs</span>
                  <p className="font-semibold text-orange-900">{currentPlan.features.users}</p>
                </div>
                <div>
                  <span className="text-orange-600">Soumissions/mois</span>
                  <p className="font-semibold text-orange-900">
                    {currentPlan.features.soumissionsPerMonth === -1 ? "Illimite" : currentPlan.features.soumissionsPerMonth}
                  </p>
                </div>
                <div>
                  <span className="text-orange-600">Prix mensuel</span>
                  <p className="font-semibold text-orange-900">{formatPrice(currentPlan.monthlyPrice)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Label htmlFor="billing" className={billingInterval === "monthly" ? "text-gray-900 font-medium" : "text-gray-500"}>
            Mensuel
          </Label>
          <Switch
            id="billing"
            checked={billingInterval === "yearly"}
            onCheckedChange={(checked) => setBillingInterval(checked ? "yearly" : "monthly")}
          />
          <Label htmlFor="billing" className={billingInterval === "yearly" ? "text-gray-900 font-medium" : "text-gray-500"}>
            Annuel
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">-20%</Badge>
          </Label>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentSubscription
            const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice / 12

            return (
              <Card
                key={plan.id}
                className={`relative transition-all flex flex-col ${
                  plan.popular
                    ? "border-orange-500 border-2 shadow-lg"
                    : isCurrent
                    ? "border-gray-400 shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-orange-500 text-white">Le plus populaire</Badge>
                  </div>
                )}
                {isCurrent && !plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary">Plan actuel</Badge>
                  </div>
                )}
                <CardHeader className="text-center">
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

                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">
                      {plan.features.users} utilisateur{plan.features.users > 1 ? "s" : ""}
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {plan.features.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Plan actif
                    </Button>
                  ) : plan.id === "free" ? (
                    <Button className="w-full" variant="outline" disabled>
                      Essai gratuit
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${plan.popular ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingPlan === plan.id}
                    >
                      {loadingPlan === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Chargement...
                        </>
                      ) : (
                        "Choisir ce plan"
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Help Card */}
        <Card className="bg-gray-100 border-gray-200">
          <CardHeader>
            <CardTitle>Besoin d&apos;aide?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Si vous avez besoin d&apos;un plan personnalise ou de plus d&apos;utilisateurs, contactez-nous pour discuter de vos besoins.
            </p>
            <Button variant="outline">Nous contacter</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
