"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  HardHat, 
  Link as LinkIcon, 
  UserPlus, 
  Copy, 
  Check, 
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  Loader2,
  ExternalLink
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SPECIALTIES, type Specialty } from "@/lib/specialties"

export default function SellerPortalPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [seller, setSeller] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState("")
  const [invitations, setInvitations] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])

  // Form state for invitation link
  const [linkForm, setLinkForm] = useState({
    email: "",
    company: "",
    phone: "",
    plan: "base",
    billingCycle: "monthly",
    notes: "",
    specialty: "general" as Specialty,
  })

  // Form state for direct registration
  const [directForm, setDirectForm] = useState({
    email: "",
    fullName: "",
    company: "",
    phone: "",
    plan: "base",
    billingCycle: "monthly",
    notes: "",
    tempPassword: "",
    specialty: "general" as Specialty,
  })

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      router.push("/login")
      return
    }

    // Check if user is a seller or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .single()

    if (!profile || !["seller", "admin"].includes(profile.role)) {
      router.push("/chat")
      return
    }

    setUser(authUser)

    // Get or create seller record
    let { data: sellerData } = await supabase
      .from("sellers")
      .select("*")
      .eq("user_id", authUser.id)
      .single()

    if (!sellerData && profile.role === "seller") {
      // Create seller record
      const { data: newSeller } = await supabase
        .from("sellers")
        .insert({ user_id: authUser.id })
        .select()
        .single()
      sellerData = newSeller
    }

    setSeller(sellerData)

    // Load invitations
    const { data: invData } = await supabase
      .from("invitations")
      .select("*")
      .eq("seller_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(20)

    setInvitations(invData || [])

    // Load sales
    if (sellerData) {
      const { data: salesData } = await supabase
        .from("sales")
        .select("*")
        .eq("seller_id", sellerData.id)
        .order("created_at", { ascending: false })
        .limit(20)

      setSales(salesData || [])
    }

    setLoading(false)
  }

  const generateInviteLink = async () => {
    if (!linkForm.email || !linkForm.company) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir le courriel et le nom de l'entreprise.",
      })
      return
    }

    setCreating(true)

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days

    const { error } = await supabase.from("invitations").insert({
      email: linkForm.email,
      company: linkForm.company,
      invited_by: user.id,
      seller_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
      selected_plan: linkForm.plan,
      billing_cycle: linkForm.billingCycle,
      client_phone: linkForm.phone,
      notes: linkForm.notes,
      source: "link",
    })

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer le lien d'invitation.",
      })
    } else {
      const link = `${window.location.origin}/signup?invite=${token}`
      setGeneratedLink(link)
      
      // Refresh invitations list
      checkAuthAndLoadData()
      
      toast({
        title: "Lien créé",
        description: "Le lien d'invitation a été généré avec succès.",
      })
    }

    setCreating(false)
  }

  const createDirectAccount = async () => {
    if (!directForm.email || !directForm.fullName || !directForm.company || !directForm.tempPassword) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
      })
      return
    }

    if (directForm.tempPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Mot de passe invalide",
        description: "Le mot de passe doit contenir au moins 8 caractères.",
      })
      return
    }

    setCreating(true)

    try {
      // Create invitation record first
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

      const { data: invitation, error: invError } = await supabase.from("invitations").insert({
        email: directForm.email,
        company: directForm.company,
        invited_by: user.id,
        seller_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
        selected_plan: directForm.plan,
        billing_cycle: directForm.billingCycle,
        client_phone: directForm.phone,
        notes: directForm.notes,
        source: "manual",
        accepted_at: new Date().toISOString(), // Mark as accepted immediately
      }).select().single()

      if (invError) throw invError

      // Create user via API (server-side)
      const response = await fetch("/api/seller/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  email: directForm.email,
  password: directForm.tempPassword,
  fullName: directForm.fullName,
  company: directForm.company,
  phone: directForm.phone,
  plan: directForm.plan,
  billingCycle: directForm.billingCycle,
  specialty: directForm.specialty,
  sellerId: user.id,
  invitationId: invitation.id,
  }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la création du compte")
      }

      toast({
        title: "Compte créé",
        description: `Le compte pour ${directForm.fullName} a été créé avec succès.`,
      })

      // Reset form
      setDirectForm({
        email: "",
        fullName: "",
        company: "",
        phone: "",
        plan: "base",
        billingCycle: "monthly",
        notes: "",
        tempPassword: "",
      })

      // Refresh data
      checkAuthAndLoadData()

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de créer le compte.",
      })
    }

    setCreating(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const planPrices: Record<string, { monthly: number; yearly: number }> = {
    base: { monthly: 39.99, yearly: 31.99 },
    pro: { monthly: 69.99, yearly: 55.99 },
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/chat")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg">Portail Vendeur</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invitations envoyées</p>
                  <p className="text-2xl font-bold">{invitations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ventes converties</p>
                  <p className="text-2xl font-bold">{sales.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commissions totales</p>
                  <p className="text-2xl font-bold">
                    {sales.reduce((sum, s) => sum + (s.commission_amount || 0), 0).toFixed(2)} $
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="link" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="link">
              <LinkIcon className="h-4 w-4 mr-2" />
              Lien
            </TabsTrigger>
            <TabsTrigger value="direct">
              <UserPlus className="h-4 w-4 mr-2" />
              Inscription directe
            </TabsTrigger>
            <TabsTrigger value="history">
              Historique
            </TabsTrigger>
          </TabsList>

          {/* Generate Link Tab */}
          <TabsContent value="link">
            <Card>
              <CardHeader>
                <CardTitle>Générer un lien d'invitation</CardTitle>
                <CardDescription>
                  Créez un lien personnalisé à partager avec votre client. Le lien expire dans 5 jours.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkEmail">Courriel du client *</Label>
                    <Input
                      id="linkEmail"
                      type="email"
                      placeholder="client@entreprise.com"
                      value={linkForm.email}
                      onChange={(e) => setLinkForm({ ...linkForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkCompany">Nom de l'entreprise *</Label>
                    <Input
                      id="linkCompany"
                      placeholder="Construction XYZ Inc."
                      value={linkForm.company}
                      onChange={(e) => setLinkForm({ ...linkForm, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkPhone">Téléphone</Label>
                    <Input
                      id="linkPhone"
                      type="tel"
                      placeholder="514-555-1234"
                      value={linkForm.phone}
                      onChange={(e) => setLinkForm({ ...linkForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select 
                      value={linkForm.plan} 
                      onValueChange={(v) => setLinkForm({ ...linkForm, plan: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base - 39.99$/mois</SelectItem>
                        <SelectItem value="pro">Pro - 69.99$/mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Spécialité</Label>
                    <Select 
                      value={linkForm.specialty} 
                      onValueChange={(v) => setLinkForm({ ...linkForm, specialty: v as Specialty })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une spécialité" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Facturation</Label>
                    <Select 
                      value={linkForm.billingCycle} 
                      onValueChange={(v) => setLinkForm({ ...linkForm, billingCycle: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                        <SelectItem value="yearly">Annuel (-20%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Textarea
                    placeholder="Notes internes sur ce client..."
                    value={linkForm.notes}
                    onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
                  />
                </div>

                <Button 
                  onClick={generateInviteLink} 
                  disabled={creating}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Générer le lien
                    </>
                  )}
                </Button>

                {generatedLink && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">Lien d'invitation généré :</p>
                    <div className="flex gap-2">
                      <Input value={generatedLink} readOnly className="bg-white" />
                      <Button variant="outline" onClick={copyLink}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      Ce lien expire dans 5 jours. Partagez-le avec votre client.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Direct Registration Tab */}
          <TabsContent value="direct">
            <Card>
              <CardHeader>
                <CardTitle>Inscription directe</CardTitle>
                <CardDescription>
                  Créez un compte client directement. Le client recevra un courriel avec ses identifiants.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="directFullName">Nom complet *</Label>
                    <Input
                      id="directFullName"
                      placeholder="Jean Dupont"
                      value={directForm.fullName}
                      onChange={(e) => setDirectForm({ ...directForm, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directEmail">Courriel *</Label>
                    <Input
                      id="directEmail"
                      type="email"
                      placeholder="jean@entreprise.com"
                      value={directForm.email}
                      onChange={(e) => setDirectForm({ ...directForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directCompany">Nom de l'entreprise *</Label>
                    <Input
                      id="directCompany"
                      placeholder="Construction XYZ Inc."
                      value={directForm.company}
                      onChange={(e) => setDirectForm({ ...directForm, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="directPhone">Téléphone</Label>
                    <Input
                      id="directPhone"
                      type="tel"
                      placeholder="514-555-1234"
                      value={directForm.phone}
                      onChange={(e) => setDirectForm({ ...directForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select 
                      value={directForm.plan} 
                      onValueChange={(v) => setDirectForm({ ...directForm, plan: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base - 39.99$/mois</SelectItem>
                        <SelectItem value="pro">Pro - 69.99$/mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Facturation</Label>
                    <Select 
                      value={directForm.billingCycle} 
                      onValueChange={(v) => setDirectForm({ ...directForm, billingCycle: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                        <SelectItem value="yearly">Annuel (-20%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Spécialité</Label>
                    <Select 
                      value={directForm.specialty} 
                      onValueChange={(v) => setDirectForm({ ...directForm, specialty: v as Specialty })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une spécialité" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="directPassword">Mot de passe temporaire *</Label>
                    <Input
                      id="directPassword"
                      type="text"
                      placeholder="Minimum 8 caractères"
                      value={directForm.tempPassword}
                      onChange={(e) => setDirectForm({ ...directForm, tempPassword: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Le client devra changer ce mot de passe à sa première connexion.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Textarea
                    placeholder="Notes internes sur ce client..."
                    value={directForm.notes}
                    onChange={(e) => setDirectForm({ ...directForm, notes: e.target.value })}
                  />
                </div>

                <Button 
                  onClick={createDirectAccount} 
                  disabled={creating}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Créer le compte
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique des invitations</CardTitle>
                <CardDescription>
                  Toutes vos invitations et leur statut.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune invitation envoyée pour le moment.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {invitations.map((inv) => (
                      <div 
                        key={inv.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{inv.company}</p>
                          <p className="text-sm text-muted-foreground">{inv.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(inv.created_at).toLocaleDateString("fr-CA")} - Plan {inv.selected_plan}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inv.accepted_at ? (
                            <Badge className="bg-green-100 text-green-700">Accepté</Badge>
                          ) : new Date(inv.expires_at) < new Date() ? (
                            <Badge variant="secondary">Expiré</Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700">En attente</Badge>
                          )}
                          {!inv.accepted_at && new Date(inv.expires_at) > new Date() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = `${window.location.origin}/signup?invite=${inv.token}`
                                navigator.clipboard.writeText(link)
                                toast({ title: "Lien copié" })
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
