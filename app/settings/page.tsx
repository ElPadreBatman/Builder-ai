"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Users, Bot, ArrowLeft, UserCircle, CreditCard } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function SettingsPage() {
  const t = useTranslations()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isAdminOrDirector, setIsAdminOrDirector] = useState(false)
  const [subscriptionType, setSubscriptionType] = useState<string>("")
  const [loading, setLoading] = useState(true)
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
      .select("role, subscription_type, is_super_admin")
      .eq("id", user.id)
      .single()

    if (profile?.is_super_admin) {
      setIsSuperAdmin(true)
    }

    if (profile?.role === "admin" || profile?.role === "director") {
      setIsAdminOrDirector(true)
    }

    if (profile?.subscription_type) {
      setSubscriptionType(profile.subscription_type)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-muted-foreground">{t.settings.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.push("/chat")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t.settings.title}</h1>
            <p className="text-muted-foreground">{t.settings.subtitle}</p>
          </div>
        </div>

        {subscriptionType && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">{t.settings.currentPlan}</CardTitle>
              <CardDescription className="capitalize">{t.settings.plan ?? "Plan"} {subscriptionType}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {subscriptionType === "base" && "Limite : 1 utilisateur"}
                {subscriptionType === "professionnel" && "Limite : 3 utilisateurs"}
                {subscriptionType === "entreprise" && "Limite : 10 utilisateurs"}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {isAdminOrDirector && (
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => router.push("/admin/subscription")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t.settings.subscription}</CardTitle>
                    <CardDescription>{t.settings.managePlan}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t.settings.subscriptionDesc}
                </p>
              </CardContent>
            </Card>
          )}

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => router.push("/profile")}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <UserCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t.settings.profile}</CardTitle>
                  <CardDescription>{t.settings.profileDesc}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t.profile.personalInfoDesc}
              </p>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => router.push("/admin/agents")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t.settings.agents}</CardTitle>
                    <CardDescription>{t.settings.agentsDesc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t.settings.agentsDesc}
                </p>
              </CardContent>
            </Card>
          )}

          {isAdminOrDirector && (
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => router.push("/admin/users")}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t.settings.team}</CardTitle>
                    <CardDescription>{t.settings.teamDesc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t.settings.teamDesc}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push("/chat")}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t.settings.back}</CardTitle>
                  <CardDescription>{t.chat.newConversation}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t.settings.back}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
