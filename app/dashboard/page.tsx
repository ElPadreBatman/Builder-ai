"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Search, 
  Plus, 
  Building2, 
  Calendar, 
  DollarSign,
  MessageSquare,
  HardHat,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Archive,
  Send,
  Trophy,
  XCircle,
  LogOut,
  Settings,
  Users,
  UserCircle,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { OnboardingTour } from "@/components/onboarding-tour"
import { dashboardTour } from "@/lib/onboarding-tours"
import { NewProjectDialog, buildProjectContextMessage, type ProjectFormData } from "@/components/new-project-dialog"
import { getPlanById, type PlanType } from "@/lib/subscription"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { FileText } from "lucide-react"
import { useTranslations } from "@/lib/i18n/use-translations"

// ============================================================================
// ANIMATED BACKGROUND COMPONENT (intégré)
// ============================================================================

function AnimatedDashboardBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Array<{
    x: number
    y: number
    size: number
    speedX: number
    speedY: number
    opacity: number
    hue: number
  }>>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initializeParticles()
    }

    const initializeParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / 18000)
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.25,
        speedY: (Math.random() - 0.5) * 0.25,
        opacity: Math.random() * 0.4 + 0.1,
        hue: Math.random() * 30 + 20, // Orange range (20-50)
      }))
    }

    const animate = () => {
      ctx.fillStyle = "rgba(249, 250, 251, 0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${particle.hue}, 90%, 55%, ${particle.opacity})`
        ctx.fill()
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener("resize", resize)
    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-50 via-orange-50/40 to-amber-50/30">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-70"
        style={{ mixBlendMode: "multiply" }}
      />

      {/* Orbes flottantes */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(249,115,22,0.1) 0%, rgba(249,115,22,0) 70%)",
            top: "-15%",
            left: "-10%",
            filter: "blur(80px)",
            animation: "orbFloat1 28s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[450px] h-[450px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0) 70%)",
            top: "35%",
            right: "-8%",
            filter: "blur(60px)",
            animation: "orbFloat2 32s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(251,146,60,0.06) 0%, rgba(251,146,60,0) 70%)",
            bottom: "5%",
            left: "25%",
            filter: "blur(50px)",
            animation: "orbFloat3 24s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[250px] h-[250px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(234,88,12,0.05) 0%, rgba(234,88,12,0) 70%)",
            top: "55%",
            left: "55%",
            filter: "blur(35px)",
            animation: "orbFloat4 20s ease-in-out infinite",
          }}
        />
      </div>

      {/* Grille technique */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(249,115,22,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          animation: "gridSlide 45s linear infinite",
        }}
      />

      {/* Halo lumineux en haut */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[35%] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.7) 0%, transparent 65%)",
        }}
      />

      {/* Texture noise */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <style jsx>{`
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(40px, 25px) scale(1.05); }
          50% { transform: translate(15px, -30px) scale(0.97); }
          75% { transform: translate(-25px, 20px) scale(1.03); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-30px, -25px) scale(1.04); }
          50% { transform: translate(25px, 35px) scale(0.96); }
          75% { transform: translate(18px, -18px) scale(1.02); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(45px, -35px) scale(1.05); }
          66% { transform: translate(-35px, 25px) scale(0.95); }
        }
        @keyframes orbFloat4 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-25px, -18px); }
        }
        @keyframes gridSlide {
          0% { transform: translate(0, 0); }
          100% { transform: translate(80px, 80px); }
        }
      `}</style>
    </div>
  )
}

// ============================================================================
// TYPES
// ============================================================================

type Conversation = {
  id: string
  title: string
  updated_at: string
  created_at: string
  status: string | null
  user_id: string
  agent_id: string | null
  summary?: string
  total_ttc?: number
}

type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  company: string | null
  is_super_admin: boolean | null
  subscription_type: string | null
  subscription_status: string | null
  trial_end_date: string | null
  soumissions_this_month: number | null
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  brouillon: { 
    label: "Brouillon", 
    icon: Clock, 
    color: "text-gray-600", 
    bgColor: "bg-gray-100/80 backdrop-blur-sm" 
  },
  en_cours: { 
    label: "En cours", 
    icon: AlertCircle, 
    color: "text-blue-600", 
    bgColor: "bg-blue-100/80 backdrop-blur-sm" 
  },
  en_attente: { 
    label: "En attente", 
    icon: Clock, 
    color: "text-yellow-600", 
    bgColor: "bg-yellow-100/80 backdrop-blur-sm" 
  },
  revise: { 
    label: "Revisé", 
    icon: CheckCircle2, 
    color: "text-purple-600", 
    bgColor: "bg-purple-100/80 backdrop-blur-sm" 
  },
  envoye: { 
    label: "Envoyé", 
    icon: Send, 
    color: "text-cyan-600", 
    bgColor: "bg-cyan-100/80 backdrop-blur-sm" 
  },
  complete: { 
    label: "Complété", 
    icon: CheckCircle2, 
    color: "text-green-600", 
    bgColor: "bg-green-100/80 backdrop-blur-sm" 
  },
  gagne: { 
    label: "Gagné", 
    icon: Trophy, 
    color: "text-green-600", 
    bgColor: "bg-green-100/80 backdrop-blur-sm" 
  },
  perdu: { 
    label: "Perdu", 
    icon: XCircle, 
    color: "text-red-600", 
    bgColor: "bg-red-100/80 backdrop-blur-sm" 
  },
  archive: { 
    label: "Archivé", 
    icon: Archive, 
    color: "text-gray-500", 
    bgColor: "bg-gray-100/80 backdrop-blur-sm" 
  },
}

// ============================================================================
// PROJECT CARD COMPONENT
// ============================================================================

function ProjectCard({ 
  conversation, 
  onClick 
}: { 
  conversation: Conversation
  onClick: () => void 
}) {
  const status = STATUS_CONFIG[conversation.status || "brouillon"] || STATUS_CONFIG.brouillon
  const StatusIcon = status.icon
  const updatedDate = new Date(conversation.updated_at).toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })

  return (
    <Card 
      className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 hover:border-orange-300 bg-white/70 backdrop-blur-sm border-white/50"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center shadow-sm">
            <Building2 className="h-5 w-5 text-orange-600" />
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-xs font-medium", status.color, status.bgColor, "border-0")}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
        
        <h3 className="font-semibold text-gray-900 mb-1.5 line-clamp-2 group-hover:text-orange-600 transition-colors">
          {conversation.title || "Sans titre"}
        </h3>
        
        {conversation.summary && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
            {conversation.summary}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{updatedDate}</span>
          </div>
          {conversation.total_ttc && (
            <div className="flex items-center gap-1 text-orange-600 font-semibold">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{conversation.total_ttc.toLocaleString("fr-CA")} $</span>
            </div>
          )}
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100/50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
          <span className="text-xs text-orange-500 font-medium">Ouvrir le projet</span>
          <ChevronRight className="h-4 w-4 text-orange-500" />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// STATUS FILTER COMPONENT
// ============================================================================

function StatusFilter({ 
  activeStatus, 
  onStatusChange,
  counts 
}: { 
  activeStatus: string | null
  onStatusChange: (status: string | null) => void
  counts: Record<string, number>
}) {
  const statuses = [
    { key: null, label: "Tous", count: Object.values(counts).reduce((a, b) => a + b, 0) },
    { key: "en_cours", label: "En cours" },
    { key: "brouillon", label: "Brouillon" },
    { key: "envoye", label: "Envoyé" },
    { key: "gagne", label: "Gagné" },
    { key: "perdu", label: "Perdu" },
    { key: "archive", label: "Archivé" },
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {statuses.map(({ key, label }) => {
        const count = key ? (counts[key] || 0) : Object.values(counts).reduce((a, b) => a + b, 0)
        const isActive = activeStatus === key
        
        return (
          <Button
            key={key || "all"}
            variant={isActive ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-9 text-xs whitespace-nowrap transition-all duration-200",
              isActive 
                ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/25 border-0" 
                : "bg-white/60 backdrop-blur-sm hover:bg-white/80 border-gray-200/50"
            )}
            onClick={() => onStatusChange(key)}
          >
            {label}
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-2 h-5 px-1.5 text-[10px] font-semibold",
                isActive ? "bg-white/25 text-white" : "bg-gray-100/80 text-gray-600"
              )}
            >
              {count}
            </Badge>
          </Button>
        )
      })}
    </div>
  )
}

// ============================================================================
// SUBSCRIPTION BADGE COMPONENT
// ============================================================================

function SubscriptionBadge({
  subscriptionType,
  subscriptionStatus,
  trialEndDate,
}: {
  subscriptionType: string | null
  subscriptionStatus: string | null
  trialEndDate: string | null
}) {
  const isTrialing = subscriptionStatus === "trialing"
  const daysLeft = trialEndDate
    ? Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  if (isTrialing && daysLeft > 0) {
    return (
      <span className="text-[10px] font-medium text-amber-600 leading-tight">
        Essai — {daysLeft}j restant{daysLeft > 1 ? "s" : ""}
      </span>
    )
  }

  const planLabels: Record<string, string> = {
    free: "Gratuit",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Entreprise",
  }

  const planColors: Record<string, string> = {
    free: "text-gray-400",
    starter: "text-blue-500",
    pro: "text-orange-500",
    enterprise: "text-purple-500",
  }

  const plan = subscriptionType || "free"
  return (
    <span className={cn("text-[10px] font-medium leading-tight", planColors[plan] || "text-gray-400")}>
      {planLabels[plan] || plan}
    </span>
  )
}

// ============================================================================
// SUBSCRIPTION COUNTER COMPONENT
// ============================================================================

function SubscriptionCounter({ 
  planType, 
  soumissionsUsed, 
  subscriptionStatus,
  trialEndDate 
}: { 
  planType: string | null
  soumissionsUsed: number
  subscriptionStatus: string | null
  trialEndDate: string | null
}) {
  const plan = getPlanById((planType || "free") as PlanType)
  const limit = plan?.features.soumissionsPerMonth || 5
  const isUnlimited = limit === -1
  const remaining = isUnlimited ? 999 : Math.max(0, limit - soumissionsUsed)
  const percentage = isUnlimited ? 0 : Math.min(100, (soumissionsUsed / limit) * 100)
  
  const isTrialing = subscriptionStatus === "trialing"
  const daysLeft = trialEndDate 
    ? Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  const getStatusColor = () => {
    if (isUnlimited) return "text-green-600"
    if (percentage >= 90) return "text-red-600"
    if (percentage >= 70) return "text-orange-600"
    return "text-gray-700"
  }

  const getProgressColor = () => {
    if (isUnlimited) return "bg-green-500"
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 70) return "bg-orange-500"
    return "bg-orange-500"
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/60 backdrop-blur-sm border border-gray-200/50 hover:bg-white/80 transition-colors cursor-default">
            <div className="flex items-center gap-2">
              <FileText className={cn("h-4 w-4", getStatusColor())} />
              <span className={cn("text-sm font-semibold", getStatusColor())}>
                {isUnlimited ? (
                  "Illimite"
                ) : (
                  <>
                    {remaining}/{limit}
                  </>
                )}
              </span>
            </div>
            {!isUnlimited && (
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all", getProgressColor())}
                  style={{ width: `${100 - percentage}%` }}
                />
              </div>
            )}
            {isTrialing && daysLeft > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                Essai: {daysLeft}j
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">Soumissions ce mois-ci</p>
            {isUnlimited ? (
              <p className="text-sm text-muted-foreground">
                Votre plan Pro inclut des soumissions illimitees
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {soumissionsUsed} utilisee(s) sur {limit} disponibles
                </p>
                {remaining <= 5 && remaining > 0 && (
                  <p className="text-xs text-orange-600">
                    Attention: il ne vous reste que {remaining} soumission(s)
                  </p>
                )}
                {remaining === 0 && (
                  <p className="text-xs text-red-600">
                    Limite atteinte! Passez au plan Pro pour continuer
                  </p>
                )}
              </>
            )}
            {isTrialing && (
              <p className="text-xs text-amber-600 mt-2">
                Periode d'essai: {daysLeft} jour(s) restant(s)
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function DashboardPage() {
  const t = useTranslations()
  const [user, setUser] = useState<Profile | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title">("updated")
  const [tourStarted, setTourStarted] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  
  const router = useRouter()
  const supabase = createClient()

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      console.log("[v0] Current session:", session ? "EXISTS" : "NO SESSION")
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        console.log("[v0] No auth user, redirecting to login")
        router.push("/login")
        return
      }
      
      console.log("[v0] Auth user:", { id: authUser.id, email: authUser.email })
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single()
      
      console.log("[v0] User profile:", { id: profile?.id, email: profile?.email, company: profile?.company })
      
      if (profile) {
        setUser(profile)
      }
    }
    checkAuth()
  }, [router, supabase])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) {
      console.log("[v0] No user profile yet, skipping fetch")
      return
    }

    setLoading(true)
    try {
      console.log("[v0] Fetching conversations for user company:", user.company)
      
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, updated_at, created_at, status, user_id, agent_id, summary")
        .order("updated_at", { ascending: false })

      console.log("[v0] Query result:", { 
        count: data?.length,
        error: error?.message,
        errorCode: error?.code,
        userCompany: user.company
      })
      
      if (data && data.length > 0) {
        console.log("[v0] First conversation:", { 
          id: data[0].id, 
          title: data[0].title, 
          userId: data[0].user_id 
        })
      }

      if (error) {
        console.error("[v0] Supabase RLS error:", {
          message: error.message,
          code: error.code,
          hint: error.hint
        })
      } else {
        console.log("[v0] Successfully fetched", data?.length || 0, 'conversations')
        setConversations(data || [])
      }
    } catch (error) {
      console.error("[v0] Fetch error:", error)
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

  useEffect(() => {
    if (user) {
      fetchConversations()
      supabase.from("agents").select("id, name").eq("is_active", true).then(({ data }) => {
        if (data) setAgents(data)
      })
    }
  }, [user, fetchConversations, supabase])

  // Filter and sort
  const filteredConversations = conversations
    .filter(conv => {
      if (activeStatus && conv.status !== activeStatus) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return conv.title?.toLowerCase().includes(query) || conv.summary?.toLowerCase().includes(query)
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "title": return (a.title || "").localeCompare(b.title || "")
        case "created": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

  const statusCounts = conversations.reduce((acc, conv) => {
    const status = conv.status || "brouillon"
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const navigateToChat = (conversationId?: string) => {
    router.push(conversationId ? `/chat?id=${conversationId}` : "/chat")
  }

  const handleCreateProject = async (formData: ProjectFormData) => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const { data, error } = await supabase
      .from("conversations")
      .insert([{ user_id: authUser.id, title: formData.title, agent_id: formData.agentId || null }])
      .select()
      .single()

    if (!error && data) {
      const contextMsg = buildProjectContextMessage(formData)
      const encoded = encodeURIComponent(contextMsg)
      router.push(`/chat?id=${data.id}&firstMessage=${encoded}`)
    }
  }

  // Loading state
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-orange-50/40 to-amber-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-3 border-orange-200 border-t-orange-500 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full bg-orange-500/10 blur-xl animate-pulse" />
          </div>
          <span className="text-sm text-gray-500 font-medium">Chargement...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Background animé */}
      <AnimatedDashboardBackground />

      {/* Header - avec effet glassmorphism */}
      <header className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-gray-900 text-lg">BuilderAI</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Button 
                variant="ghost" 
                className="text-orange-600 bg-orange-100/50 hover:bg-orange-100"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button 
                variant="ghost"
                className="hover:bg-gray-100/50"
                onClick={() => router.push("/chat")}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </Button>
            </nav>

            {/* Subscription Counter */}
            <div className="hidden md:block">
              <SubscriptionCounter 
                planType={user.subscription_type}
                soumissionsUsed={user.soumissions_this_month || 0}
                subscriptionStatus={user.subscription_status}
                trialEndDate={user.trial_end_date}
              />
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 hover:bg-white/50">
                  <Avatar className="h-8 w-8 ring-2 ring-orange-500/20">
                    <AvatarFallback className="bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600 text-xs font-semibold">
                      {user.first_name?.[0] || user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight">
                      {user.first_name || user.email.split("@")[0]}
                    </span>
                    <SubscriptionBadge
                      subscriptionType={user.subscription_type}
                      subscriptionStatus={user.subscription_status}
                      trialEndDate={user.trial_end_date}
                    />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white/90 backdrop-blur-md">
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <UserCircle className="h-4 w-4 mr-2" />
                  {t.dashboard.profile}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t.dashboard.settings}
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <>
                    <DropdownMenuItem onClick={() => router.push("/admin/users")}>
                      <Users className="h-4 w-4 mr-2" />
                      {t.settings.team}
                    </DropdownMenuItem>
                    {user.is_super_admin && (
                      <DropdownMenuItem onClick={() => router.push("/admin/agents")}>
                        <Settings className="h-4 w-4 mr-2" />
                        {t.settings.agents}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t.dashboard.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t.dashboard.title}</h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {conversations.length} {conversations.length !== 1 ? t.dashboard.projects : t.dashboard.project} {t.dashboard.total.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => setNewProjectOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 border-0"
              data-tour="new-project-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.dashboard.newProject}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTourStarted(true)}
              title="Guide d'utilisation"
              className="bg-white/60 backdrop-blur-sm hover:bg-white/80"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters Bar - avec glassmorphism */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg shadow-gray-900/5 p-5 mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md" data-tour="search-bar">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t.dashboard.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white/70 border-gray-200/50 focus:border-orange-300 focus:ring-orange-500/20"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2" data-tour="status-filters">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 bg-white/60 backdrop-blur-sm hover:bg-white/80 border-gray-200/50">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    {t.dashboard.sortDate}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white/90 backdrop-blur-md">
                  <DropdownMenuItem onClick={() => setSortBy("updated")}>
                    {t.dashboard.lastUpdated}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("created")}>
                    {t.dashboard.sortDate}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("title")}>
                    {t.dashboard.title} (A-Z)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-8 w-8 p-0", viewMode === "grid" && "bg-orange-100 text-orange-600")}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-8 w-8 p-0", viewMode === "list" && "bg-orange-100 text-orange-600")}
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Status Filters */}
          <div className="mt-4">
            <StatusFilter
              activeStatus={activeStatus}
              onStatusChange={setActiveStatus}
              counts={statusCounts}
            />
          </div>
        </div>

        {/* Projects Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-3 border-orange-200 border-t-orange-500 animate-spin" />
                <div className="absolute inset-0 h-10 w-10 rounded-full bg-orange-500/10 blur-lg animate-pulse" />
              </div>
              <span className="text-sm text-gray-500">{t.common.loading}</span>
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-500/10">
              <Building2 className="h-10 w-10 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || activeStatus ? t.dashboard.noProjects : t.dashboard.noProjects}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {searchQuery || activeStatus 
                ? t.dashboard.noProjectsDesc
                : t.dashboard.noProjectsDesc
              }
            </p>
            {!searchQuery && !activeStatus && (
              <Button 
                onClick={() => setNewProjectOpen(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t.dashboard.createFirst}
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-tour="projects-grid">
            {filteredConversations.map((conv) => (
              <ProjectCard
                key={conv.id}
                conversation={conv}
                onClick={() => navigateToChat(conv.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg shadow-gray-900/5 divide-y divide-gray-100/50">
            {filteredConversations.map((conv) => {
              const status = STATUS_CONFIG[conv.status || "brouillon"] || STATUS_CONFIG.brouillon
              const StatusIcon = status.icon
              const updatedDate = new Date(conv.updated_at).toLocaleDateString("fr-CA")

              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-4 p-4 hover:bg-white/40 cursor-pointer transition-colors"
                  onClick={() => navigateToChat(conv.id)}
                >
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Building2 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {conv.title || "Sans titre"}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.summary || "Pas de description"}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs flex-shrink-0 font-medium", status.color, status.bgColor, "border-0")}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  <span className="text-sm text-gray-400 flex-shrink-0 hidden md:block">
                    {updatedDate}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Onboarding Tour */}
      {tourStarted && (
        <OnboardingTour
          tour={dashboardTour}
          onClose={() => setTourStarted(false)}
        />
      )}

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        agents={agents}
        defaultAgentId={agents[0]?.id || ""}
        onCreate={handleCreateProject}
      />
    </div>
  )
}
