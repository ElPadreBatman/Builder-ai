"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Play } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function LoginPage() {
  const t = useTranslations()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://builder-ai.ca/auth/callback?next=/change-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(t.login.resetSuccess + email)
      }
    } catch {
      setError("Une erreur inattendue s'est produite")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    console.log("[v0] Starting login process...")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log("[v0] Login response:", { hasData: !!data, hasError: !!error })

      if (error) {
        console.log("[v0] Login error:", error.message)
        setError(error.message)
        setLoading(false)
        return
      }

      if (data.user) {
        // Check if user needs to change password (created by seller)
        if (data.user.user_metadata?.must_change_password) {
          console.log("[v0] User must change password, redirecting...")
          window.location.href = "/change-password"
          return
        }
        console.log("[v0] Login successful, redirecting to chat...")
        window.location.href = "/chat"
      }
    } catch (err) {
      console.error("[v0] Unexpected error during login:", err)
      setError(t.login.unexpectedError)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{t.login.title}</CardTitle>
          <CardDescription className="text-center">
            {t.login.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.login.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.login.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.login.passwordLabel}</Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-orange-600 hover:underline"
                >
                  {t.login.forgotPassword}
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.login.submitting : t.login.submit}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">{t.login.noAccount} </span>
            <Link href="/signup" className="text-primary hover:underline font-medium">
              {t.login.signupLink}
            </Link>
          </div>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">{t.login.orContinueWith}</span>
            </div>
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
          
          <div className="mt-4">
            <Button 
              variant="outline" 
              className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
              onClick={() => router.push("/demo")}
            >
              <Play className="mr-2 h-4 w-4" />
              {t.login.watchDemo}
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-gray-500 max-w-md">
        {t.login.title === "Sign in" ? "By signing in, you agree to our" : t.login.title === "Iniciar sesión" ? "Al iniciar sesión, acepta nuestros" : "En vous connectant, vous acceptez nos"}{" "}
        <Link href="/conditions-utilisation" className="text-orange-600 hover:underline">
          {t.login.title === "Sign in" ? "terms of use" : t.login.title === "Iniciar sesión" ? "términos de uso" : "conditions d'utilisation"}
        </Link>{" "}
        {t.login.title === "Sign in" ? "and our" : t.login.title === "Iniciar sesión" ? "y nuestra" : "et notre"}{" "}
        <Link href="/politique-confidentialite" className="text-orange-600 hover:underline">
          {t.login.title === "Sign in" ? "privacy policy" : t.login.title === "Iniciar sesión" ? "política de privacidad" : "politique de confidentialité"}
        </Link>
      </p>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t.login.resetTitle}</CardTitle>
              <CardDescription>
                {t.login.resetSubtitle}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t.login.emailLabel}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t.login.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
                {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setError(null)
                      setSuccess(null)
                    }}
                    disabled={loading}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading || !email}>
                    {loading ? t.login.resetSending : t.login.resetSubmit}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
