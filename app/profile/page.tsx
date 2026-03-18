"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Building2, User, Upload, Save, Loader2,
  CheckCircle2, AlertCircle, HardHat, MapPin, Lock, Globe
} from "lucide-react"
import { SPECIALTIES } from "@/lib/specialties"
import { type SupportedLanguage, LANGUAGES } from "@/lib/language-context"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/use-translations"

const CANADIAN_PROVINCES = [
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "AB", label: "Alberta" },
  { value: "SK", label: "Saskatchewan" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "NT", label: "Territoires du Nord-Ouest" },
  { value: "YT", label: "Yukon" },
  { value: "NU", label: "Nunavut" },
]

const US_STATES = [
  { value: "CA", label: "Californie" },
  { value: "NY", label: "New York" },
  { value: "TX", label: "Texas" },
  { value: "FL", label: "Floride" },
]

const COUNTRIES = [
  { value: "Canada", label: "Canada" },
  { value: "États-Unis", label: "États-Unis" },
  { value: "France", label: "France" },
  { value: "Belgique", label: "Belgique" },
  { value: "Suisse", label: "Suisse" },
]

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  specialty: string | null
  company: string | null
  company_name: string | null
  rbq_number: string | null
  company_logo_url: string | null
  city: string | null
  province: string | null
  country: string | null
  preferred_language: SupportedLanguage | null
  subscription_type: string | null
  subscription_status: string | null
  trial_end_date: string | null
}

export default function ProfilePage() {
  const t = useTranslations()
  const router = useRouter()
  const supabase = createClient()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Personal
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [specialty, setSpecialty] = useState("general")
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage>("fr")

  // Company
  const [companyName, setCompanyName] = useState("")
  const [rbqNumber, setRbqNumber] = useState("")
  const [companyLogoUrl, setCompanyLogoUrl] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("QC")
  const [country, setCountry] = useState("Canada")

  // Password
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, specialty, company, company_name, rbq_number, company_logo_url, city, province, country, preferred_language, subscription_type, subscription_status, trial_end_date")
      .eq("id", user.id)
      .single()

    if (error || !data) { router.push("/login"); return }

    setProfile(data)
    setFirstName(data.first_name || "")
    setLastName(data.last_name || "")
    setPhone(data.phone || "")
    setSpecialty(data.specialty || "general")
    setPreferredLanguage(data.preferred_language || "fr")
    setCompanyName(data.company_name || data.company || "")
    setRbqNumber(data.rbq_number || "")
    setCompanyLogoUrl(data.company_logo_url || "")
    setCity(data.city || "")
    setProvince(data.province || "QC")
    setCountry(data.country || "Canada")
    setLoading(false)
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        specialty,
        preferred_language: preferredLanguage,
        company_name: companyName.trim(),
        company: companyName.trim(),
        rbq_number: rbqNumber.trim(),
        company_logo_url: companyLogoUrl,
        city: city.trim(),
        province,
        country,
      })
      .eq("id", profile.id)

    setSaving(false)
    if (error) {
      setError("Erreur lors de la sauvegarde : " + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      setError("PNG, JPG, SVG, WebP only")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2 MB")
      return
    }

    setUploadingLogo(true)
    setError(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("userId", profile.id)

    const res = await fetch("/api/upload/company-logo", { method: "POST", body: formData })
    const json = await res.json()

    setUploadingLogo(false)
    if (json.url) {
      setCompanyLogoUrl(json.url)
    } else {
      setError(t.profile.saveError + ": " + (json.error || "unknown"))
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError(null)
    if (newPassword !== confirmPassword) { setPasswordError("Les mots de passe ne correspondent pas."); return }
    if (newPassword.length < 8) { setPasswordError("Le mot de passe doit contenir au moins 8 caractères."); return }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) {
      setPasswordError("Erreur : " + error.message)
    } else {
      setPasswordSaved(true)
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setPasswordSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) return null

  const daysLeft = profile.trial_end_date
    ? Math.max(0, Math.ceil((new Date(profile.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0
  const isTrialing = profile.subscription_status === "trialing"

  const provinces = country === "États-Unis" ? US_STATES : CANADIAN_PROVINCES

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900">{t.profile.title}</h1>
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          </div>
          {isTrialing && daysLeft > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs shrink-0">
              {t.settings.trial} — {daysLeft} {t.dashboard.days}
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          >
            {saving
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : saved
              ? <CheckCircle2 className="h-4 w-4 mr-2" />
              : <Save className="h-4 w-4 mr-2" />}
            {saved ? t.profile.saved : t.profile.save}
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">{t.common.cancel}</button>
          </div>
        )}

        {/* ── INFORMATIONS PERSONNELLES ── */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{t.profile.personalInfo}</CardTitle>
                <CardDescription className="text-xs">{t.profile.personalInfoDesc}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-medium text-gray-700">{t.profile.firstName}</Label>
                <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Franco" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs font-medium text-gray-700">{t.profile.lastName}</Label>
                <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Guinazu" className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium text-gray-700">{t.profile.phone}</Label>
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (514) 555-0000" className="h-9 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5 text-primary" />
                {t.profile.specialty}
              </Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t.profile.specialty} />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {t.profile.specialtyHint}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                {t.profile.language}
              </Label>
              <Select value={preferredLanguage} onValueChange={(v) => setPreferredLanguage(v as SupportedLanguage)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t.profile.language} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGES).map(([code, { label, flag }]) => (
                    <SelectItem key={code} value={code}>
                      <span className="flex items-center gap-2">
                        <span>{flag}</span>
                        <span className="font-medium">{label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {t.profile.languageHint}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── INFORMATIONS DE LA COMPAGNIE ── */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{t.profile.companyInfo}</CardTitle>
                <CardDescription className="text-xs">
                  {t.profile.companyInfoDesc}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Logo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">{t.profile.logo}</Label>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-16 w-16 rounded-xl border-2 border-dashed flex items-center justify-center bg-gray-50 overflow-hidden shrink-0 transition-colors",
                  companyLogoUrl ? "border-gray-200 bg-white" : "border-gray-300"
                )}>
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt={t.profile.logo} className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <Building2 className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="h-8 text-xs"
                  >
                    {uploadingLogo
                      ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                    {uploadingLogo ? t.profile.uploading : t.profile.uploadLogo}
                  </Button>
                  <p className="text-xs text-gray-400 mt-1">{t.profile.logoDesc}</p>
                  {companyLogoUrl && (
                    <button
                      onClick={() => setCompanyLogoUrl("")}
                      className="text-xs text-red-500 hover:underline mt-0.5 block"
                    >
                      {t.profile.changeLogo}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Nom + RBQ */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-xs font-medium text-gray-700">{t.profile.companyName}</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Construction XYZ Inc."
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rbqNumber" className="text-xs font-medium text-gray-700">
                  {t.profile.rbqNumber}
                </Label>
                <Input
                  id="rbqNumber"
                  value={rbqNumber}
                  onChange={e => setRbqNumber(e.target.value)}
                  placeholder={t.profile.rbqPlaceholder}
                  className="h-9 text-sm font-mono tracking-wide"
                />
                <p className="text-xs text-gray-400">
                  {t.profile.logoDesc}
                </p>
              </div>
            </div>

            <Separator />

            {/* Localisation */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {t.profile.city}
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs text-gray-500">{t.profile.city}</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Montréal"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">{t.profile.province}</Label>
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">{t.profile.country}</Label>
                  <Select value={country} onValueChange={v => { setCountry(v); setProvince("QC") }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {t.profile.companyInfoDesc}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── MOT DE PASSE ── */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{t.profile.changePassword}</CardTitle>
                <CardDescription className="text-xs">{t.profile.passwordMin}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {passwordError && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {passwordError}
              </div>
            )}
            {passwordSaved && (
              <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {t.profile.passwordSaved}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs font-medium text-gray-700">{t.profile.newPassword}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-700">{t.profile.confirmPassword}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasswordChange}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="h-8 text-xs"
            >
              {savingPassword && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {t.profile.updatePassword}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
