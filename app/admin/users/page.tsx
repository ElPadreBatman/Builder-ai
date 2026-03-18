"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Users, Shield, UserPlus, Mail, Trash2, Circle, Copy, Check, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

type Profile = {
  id: string
  email: string
  is_super_admin: boolean
  role: string
  company: string
  subscription_type: string
  first_name?: string
  last_name?: string
  is_online: boolean
  last_seen_at: string
  created_at: string
}

type Invitation = {
  id: string
  email: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export default function UsersAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [resendingInvitation, setResendingInvitation] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkAdminAndLoad()
    const interval = setInterval(loadUsers, 10000) // Refresh every 10 seconds for online status
    return () => clearInterval(interval)
  }, [])

  const checkAdminAndLoad = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    if (!profile || !["admin", "director"].includes(profile.role)) {
      toast({
        variant: "destructive",
        title: "Accès refusé",
        description: "Vous devez être administrateur ou directeur",
      })
      router.push("/chat")
      return
    }

    setCurrentUser(profile)
    loadUsers(profile.company)
    loadInvitations()
  }

  const loadUsers = async (company?: string) => {
    const comp = company || currentUser?.company
    if (!comp) return

    setLoading(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("company", comp)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setProfiles(data)
    }
    setLoading(false)
  }

  const loadInvitations = async () => {
    const response = await fetch("/api/invitations/list")
    if (response.ok) {
      const { invitations } = await response.json()
      setInvitations(invitations || [])
    }
  }

  const toggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "director" : "admin"
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId)

    if (!error && currentUser) {
      loadUsers(currentUser.company)
    }
  }

  const updateRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId)

    if (!error && currentUser) {
      loadUsers(currentUser.company)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setInviteLoading(true)

    try {
      const response = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          company: currentUser?.company,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setInviteError(data.error || "Erreur lors de l'envoi de l'invitation")
        setInviteLoading(false)
        return
      }

      setInviteSuccess(`Invitation envoyée avec succès à ${inviteEmail}!`)
      setInviteEmail("")
      loadInvitations()
      setTimeout(() => {
        setDialogOpen(false)
        setInviteSuccess(null)
      }, 2000)
    } catch (error) {
      setInviteError("Erreur lors de l'envoi de l'invitation")
    }
    setInviteLoading(false)
  }

  const deleteInvitation = async (invitationId: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", invitationId)

    if (!error) {
      loadInvitations()
    }
  }

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/accept-invitation?token=${token}`
    navigator.clipboard.writeText(link)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const resendInvitation = async (invitationId: string) => {
    setResendingInvitation(invitationId)

    try {
      const response = await fetch("/api/invitations/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: data.error || "Erreur lors du renvoi de l'invitation",
        })
      } else {
        toast({
          title: "Succès",
          description: "Email d'invitation renvoyé avec succès!",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors du renvoi de l'invitation",
      })
    }

    setResendingInvitation(null)
  }

  const getSubscriptionLimit = () => {
    const limits = {
      base: 1,
      professionnel: 3,
      entreprise: 10,
    }
    return limits[currentUser?.subscription_type as keyof typeof limits] || 1
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  const subscriptionLimit = getSubscriptionLimit()
  const remainingSlots = subscriptionLimit - profiles.length

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push("/chat")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestion des Utilisateurs</h1>
              <p className="text-muted-foreground">
                {profiles.length} / {subscriptionLimit} utilisateurs (Plan: {currentUser?.subscription_type})
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={remainingSlots <= 0}>
                <UserPlus className="mr-2 h-4 w-4" />
                Inviter un employé
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un employé</DialogTitle>
                <DialogDescription>
                  Entrez l'adresse email de l'employé. Il recevra un lien pour créer son compte.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Adresse email</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="employe@entreprise.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={inviteLoading}
                  />
                </div>
                {inviteError && (
                  <Alert variant="destructive">
                    <AlertDescription>{inviteError}</AlertDescription>
                  </Alert>
                )}
                {inviteSuccess && (
                  <Alert className="bg-green-50 text-green-900 border-green-200">
                    <AlertDescription>{inviteSuccess}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={inviteLoading}>
                  {inviteLoading ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {remainingSlots <= 0 && (
          <Alert className="mb-6">
            <AlertDescription>
              Limite d'utilisateurs atteinte. Passez à un plan supérieur pour inviter plus d'employés.
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Invitations */}
        {invitations.filter((inv) => !inv.accepted_at).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Invitations en attente</h2>
            <div className="grid gap-4">
              {invitations
                .filter((inv) => !inv.accepted_at)
                .map((invitation) => (
                  <Card key={invitation.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-base">{invitation.email}</CardTitle>
                            <CardDescription>
                              Expire le {new Date(invitation.expires_at).toLocaleDateString("fr-FR")}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id)}
                            disabled={resendingInvitation === invitation.id}
                            title="Renvoyer l'email d'invitation"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${resendingInvitation === invitation.id ? "animate-spin" : ""}`}
                            />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInvitationLink(invitation.token)}
                            title="Copier le lien d'invitation"
                          >
                            {copiedToken === invitation.token ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteInvitation(invitation.id)}
                            title="Supprimer l'invitation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Active Users */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Utilisateurs actifs</h2>
          <div className="grid gap-4">
            {profiles.map((profile) => (
              <Card key={profile.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <Circle
                          className={`absolute bottom-0 right-0 h-3 w-3 ${
                            profile.is_online ? "fill-green-500 text-green-500" : "fill-gray-400 text-gray-400"
                          }`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {profile.first_name && profile.last_name
                            ? `${profile.first_name} ${profile.last_name}`
                            : profile.email}
                        </CardTitle>
                        <CardDescription>
                          {profile.is_online
                            ? "En ligne"
                            : `Vu ${new Date(profile.last_seen_at).toLocaleString("fr-FR")}`}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {profile.role === "admin" && !profile.is_super_admin && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                      {profile.is_super_admin && (
                        <Badge variant="default" className="gap-1 bg-purple-600">
                          <Shield className="h-3 w-3" />
                          Super Admin
                        </Badge>
                      )}
                      {!profile.is_super_admin && (
                        <Select
                          value={profile.role}
                          onValueChange={(value) => updateRole(profile.id, value)}
                          disabled={currentUser?.id === profile.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employé</SelectItem>
                            <SelectItem value="director">Directeur</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Email:</span> {profile.email}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
