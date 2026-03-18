"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { HardHat, Check, Loader2, CreditCard, Mail, Shield } from "lucide-react"
import { createCheckoutSessionAfterSignup } from "@/app/actions/stripe"
import type { PlanType, BillingInterval } from "@/lib/subscription"
import { PLANS } from "@/lib/subscription"
import { SPECIALTIES, type Specialty } from "@/lib/specialties"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/lib/i18n/use-translations"

function SignUpPageContent() {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const inviteToken = searchParams.get("invite")
  const planParam = (searchParams.get("plan") || "free") as PlanType
  const intervalParam = (searchParams.get("interval") || "monthly") as BillingInterval
  
  const selectedPlan = PLANS.find((p) => p.id === planParam) || PLANS[0]
  const isPaidPlan = planParam !== "free"
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [company, setCompany] = useState("")
  const [phone, setPhone] = useState("")
  const [specialty, setSpecialty] = useState<Specialty>("general")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const [loadingInvite, setLoadingInvite] = useState(!!inviteToken)

  useEffect(() => {
    if (inviteToken) {
      loadInvitation()
    }
  }, [inviteToken])

  // Email validation is handled by Supabase Auth during signup
  // If an email already exists, Supabase will return a user with empty identities array

  const loadInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("token", inviteToken)
        .gt("expires_at", new Date().toISOString())
        .is("accepted_at", null)
        .single()

      if (error || !data) {
        setError(t.signup.invalidInvite)
      } else {
        setInviteData(data)
        setEmail(data.email || "")
        setCompany(data.company || "")
        setPhone(data.client_phone || "")
      }
    } catch {
      setError(t.signup.inviteError)
    }
    setLoadingInvite(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!termsAccepted) {
      setError(t.signup.acceptTerms)
      return
    }

    if (password !== confirmPassword) {
      setError(t.signup.passwordMismatch)
      return
    }

    if (password.length < 8) {
      setError(t.signup.passwordTooShort)
      return
    }

    setLoading(true)

    try {
      // Split full name for metadata
      const nameParts = fullName.trim().split(" ")
      const firstName = nameParts[0] || ""
      const lastName = nameParts.slice(1).join(" ") || ""

      // Signup with metadata - the database trigger will create the profile automatically
      // emailRedirectTo tells Supabase where to redirect after email confirmation
      const redirectUrl = `${window.location.origin}/auth/callback`
      console.log("[v0] Attempting signup with email:", email, "redirectTo:", redirectUrl)
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            first_name: firstName,
            last_name: lastName,
            company,
            phone,
            specialty,
            role: inviteData ? "employee" : "admin",
            plan: inviteData?.selected_plan || planParam,
          },
        },
      })

      console.log("[v0] Signup response:", { user: authData?.user?.id, session: !!authData?.session, error: authError })

      if (authError) {
        console.log("[v0] Signup error:", authError.message)
        setError(authError.message)
        setLoading(false)
        return
      }

      // Check if user already exists (Supabase returns user but no session for existing unconfirmed users)
      if (authData.user && !authData.session && authData.user.identities?.length === 0) {
        setError("Un compte avec cette adresse courriel existe déjà. Veuillez vous connecter ou réinitialiser votre mot de passe.")
        setLoading(false)
        return
      }

      if (authData.user) {
        console.log("[v0] User created successfully:", authData.user.id)
        // Profile is created automatically by database trigger

        if (inviteData) {
          await supabase
            .from("invitations")
            .update({ accepted_at: new Date().toISOString() })
            .eq("id", inviteData.id)

          if (inviteData.seller_id) {
            const { data: seller } = await supabase
              .from("sellers")
              .select("id, commission_rate")
              .eq("user_id", inviteData.seller_id)
              .single()

            if (seller) {
              const planPrices: Record<string, number> = {
                base: 39.99,
                pro: inviteData.billing_cycle === "yearly" ? 55.99 : 69.99,
              }
              const amount = planPrices[inviteData.selected_plan] || 0
              const commission = amount * (seller.commission_rate / 100)

              await supabase.from("sales").insert({
                seller_id: seller.id,
                invitation_id: inviteData.id,
                client_user_id: authData.user.id,
                plan_sold: inviteData.selected_plan,
                billing_cycle: inviteData.billing_cycle,
                amount,
                commission_amount: commission,
                status: "pending",
              })
            }
          }
          // Show confirmation email message for invite signups too
          setSuccess(true)
          setLoading(false)
          return
        }

        // For paid plans, redirect to Stripe Checkout (no email confirmation needed before payment)
        if (isPaidPlan) {
          const { url } = await createCheckoutSessionAfterSignup(
            authData.user.id,
            email,
            fullName,
            planParam,
            intervalParam
          )
          if (url) {
            window.location.href = url
            return
          }
        }

        // Free plan: show confirmation email message
        setSuccess(true)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || t.login.unexpectedError)
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: "google" | "azure") => {
    if (!termsAccepted) {
      setError(t.signup.acceptTerms)
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    if (inviteToken) params.set("invite", inviteToken)
    if (planParam !== "free") {
      params.set("plan", planParam)
      params.set("interval", intervalParam)
    }
    const query = params.toString() ? `?${params.toString()}` : ""
    const redirectUrl = `${window.location.origin}/auth/callback${query}`
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { 
        redirectTo: redirectUrl,
        scopes: provider === "azure" ? "email profile openid" : undefined
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  if (loadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 px-8">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <Mail className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.signup.checkEmail}</h2>
            <p className="text-gray-600 mb-2 leading-relaxed">
              {t.signup.checkEmailDesc}
            </p>
            <p className="font-semibold text-orange-600 mb-6">{email}</p>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              {t.signup.confirmInstruction}{" "}
              {t.signup.noEmailReceived} {t.signup.checkSpam}
            </p>
            <Link href="/login">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                {t.auth.login.submit}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500">
              <HardHat className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {inviteData ? t.signup.title : t.signup.title}
          </CardTitle>
          <CardDescription className="text-center">
            {inviteData ? (
              <span>{t.signup.invitedBy} <strong>{inviteData.company}</strong></span>
            ) : isPaidPlan ? (
              t.signup.subtitle
            ) : (
              t.signup.subtitle
            )}
          </CardDescription>

          {/* Plan badge */}
          {!inviteData && (
            <div className="flex justify-center pt-2 gap-2">
              <Badge className={isPaidPlan ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-gray-100 text-gray-700 border-gray-200"}>
                {selectedPlan.name}
                {isPaidPlan && ` — ${intervalParam === "yearly" ? "Annuel" : "Mensuel"}`}
              </Badge>
              {isPaidPlan && (
                <Badge variant="outline" className="text-xs gap-1">
                  <CreditCard className="h-3 w-3" />
                  Paiement apres inscription
                </Badge>
              )}
            </div>
          )}

          {inviteData?.selected_plan && (
            <div className="flex justify-center pt-2">
              <Badge className="bg-orange-100 text-orange-700">
                Plan {inviteData.selected_plan === "pro" ? "Pro" : "Base"} - {inviteData.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Terms acceptance block shown above OAuth buttons too */}
          <div className={`rounded-lg border p-4 ${termsAccepted ? "border-green-200 bg-green-50" : "border-orange-100 bg-orange-50"}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-orange-500 cursor-pointer"
                disabled={loading}
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                {t.signup.termsAccept}{" "}
                <Link href="/conditions-utilisation" target="_blank" className="text-orange-600 hover:underline font-medium">
                  {t.signup.terms}
                </Link>{" "}
                {t.signup.and}{" "}
                <Link href="/politique-confidentialite" target="_blank" className="text-orange-600 hover:underline font-medium">
                  {t.signup.privacy}
                </Link>
              </span>
            </label>
            {!termsAccepted && (
              <p className="mt-2 text-xs text-orange-700">{t.signup.acceptTerms}</p>
            )}
            {termsAccepted && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
                <Shield className="h-3 w-3" />
                {t.common.success}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="w-full opacity-50 cursor-not-allowed"
              disabled={true}
              title={t.login.comingSoon}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full opacity-50 cursor-not-allowed"
              disabled={true}
              title={t.login.comingSoon}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Microsoft
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">{t.login.orContinueWith}</span>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t.signup.fullName}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t.signup.fullNamePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">{t.signup.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.signup.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !!inviteData?.email}
              />
            </div>

            {!inviteData && (
              <div className="space-y-2">
                <Label htmlFor="company">{t.signup.company}</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder={t.signup.companyPlaceholder}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">{t.signup.phone}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t.signup.phonePlaceholder}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">{t.signup.specialty}</Label>
              <Select value={specialty} onValueChange={(val) => setSpecialty(val as Specialty)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={t.signup.specialty} />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {t.profile.specialtyHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.signup.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t.signup.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.signup.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t.signup.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading || !termsAccepted}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.signup.submitting}
                </>
              ) : isPaidPlan ? (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t.signup.submit}
                </>
              ) : (
                t.signup.submit
              )}
            </Button>
          </form>

          {!inviteData && !isPaidPlan && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                <Check className="h-4 w-4" />
                {t.landing.cta.subtitle}
              </div>
              <p className="text-green-600 text-xs">
                {t.landing.cta.subtitle}
              </p>
            </div>
          )}

          {isPaidPlan && !inviteData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                <CreditCard className="h-4 w-4" />
                {t.signup.selectedPlan}
              </div>
              <p className="text-blue-600 text-xs">
                {t.signup.submitting}
              </p>
            </div>
          )}

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t.signup.hasAccount} </span>
            <Link href="/login" className="text-orange-600 hover:underline font-medium">
              {t.signup.loginLink}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent" />
      </div>
    }>
      <SignUpPageContent />
    </Suspense>
  )
}
