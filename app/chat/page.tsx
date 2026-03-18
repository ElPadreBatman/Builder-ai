"use client"

import { AvatarFallback } from "@/components/ui/avatar"
import { Avatar } from "@/components/ui/avatar"
import type React from "react"
import { Suspense } from "react"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  PlusCircle, 
  Paperclip, 
  LogOut, 
  Trash2, 
  ImageIcon, 
  File, 
  Settings, 
  Users, 
  UserCircle, 
  Menu, 
  X,
  HardHat,
  Building2,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MoreHorizontal,
  Tag,
  Eye,
  FileText,
  Download,
  ExternalLink,
  LayoutDashboard,
  Layers,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MarkdownMessage } from "@/components/markdown-message"
import { ChatInput } from "@/components/chat-input"
import { useToast } from "@/components/ui/use-toast"
import { ViewTabsBar, ConversationViewContent, type ViewTab } from "@/components/conversation-views"
import { ArtifactsPanel } from "@/components/artifacts-panel"
import { NewProjectDialog, buildProjectContextMessage, type ProjectFormData } from "@/components/new-project-dialog"

type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  attachments?: Attachment[]
}

type Attachment = {
  id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
}

type Conversation = {
  id: string
  title: string
  updated_at: string
  agent_id: string | null
  status: string | null
}

type Agent = {
  id: string
  name: string
  description: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
}

type OnlineUser = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  is_online: boolean
  last_seen_at: string
  current_conversation_id: string | null
  is_typing: boolean
}

const CONV_STATUSES = [
  { value: "en_cours", label: "En cours", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "en_attente", label: "En attente", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "revise", label: "Revise", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "envoye", label: "Envoye", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "gagne", label: "Gagne", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "perdu", label: "Perdu", color: "bg-red-100 text-red-700 border-red-200" },
] as const

function getStatusStyle(status: string | null) {
  return CONV_STATUSES.find(s => s.value === status) || CONV_STATUSES[0]
}

function ChatSubscriptionBadge({
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

  const planLabels: Record<string, string> = { free: "Gratuit", starter: "Starter", pro: "Pro", enterprise: "Entreprise" }
  const planColors: Record<string, string> = { free: "text-gray-400", starter: "text-blue-500", pro: "text-orange-500", enterprise: "text-purple-500" }
  const plan = subscriptionType || "free"
  return (
    <span className={`text-[10px] font-medium leading-tight ${planColors[plan] || "text-gray-400"}`}>
      {planLabels[plan] || plan}
    </span>
  )
}
function ChatPageContent() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [newConvDialogOpen, setNewConvDialogOpen] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [artifactsPanelOpen, setArtifactsPanelOpen] = useState(false)
  const [artifactsCount, setArtifactsCount] = useState(0)
  const [activeView, setActiveView] = useState<ViewTab>("chat")
  const [showAttachments, setShowAttachments] = useState(false)
  const [convAttachments, setConvAttachments] = useState<Attachment[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{
    first_name: string | null
    email: string
    subscription_type: string | null
    subscription_status: string | null
    trial_end_date: string | null
  } | null>(null)

  // Check for saved soumissions in DB
  const [hasSavedSoumission, setHasSavedSoumission] = useState(false)
  
  useEffect(() => {
    if (!currentConversationId) {
      setHasSavedSoumission(false)
      return
    }
    const checkSaved = async () => {
      try {
        const res = await fetch(`/api/soumissions?conversationId=${currentConversationId}`)
        if (res.ok) {
          const json = await res.json()
          setHasSavedSoumission(json.soumissions?.length > 0)
        }
      } catch {
        // ignore
      }
    }
    checkSaved()
  }, [currentConversationId])

  const hasSoumissionData = useMemo(() => {
    // Always true if we have saved soumission in DB
    if (hasSavedSoumission) return true
    
    return messages.some(m => {
      const content = m.content
      let match

      // Pattern 1: Raw markdown ```json:soumission or ```json
      const mdRegex = /```(?:json:soumission|json)\s*\n([\s\S]*?)\n```/g
      while ((match = mdRegex.exec(content)) !== null) {
        try {
          const parsed = JSON.parse(match[1])
          if (parsed.projet && parsed.phases) return true
        } catch { /* continue */ }
      }

      // Pattern 2: HTML-rendered <pre><code class="language-json:soumission">
      const htmlRegex = /<pre><code[^>]*class="language-json(?::soumission)?"[^>]*>([\s\S]*?)<\/code><\/pre>/g
      while ((match = htmlRegex.exec(content)) !== null) {
        try {
          const decoded = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          const parsed = JSON.parse(decoded)
          if (parsed.projet && parsed.phases) return true
        } catch { /* continue */ }
      }

      // Pattern 3: Inline JSON with "projet" and "phases" keys
      const inlineRegex = /(\{[\s\S]*?"projet"\s*:\s*\{[\s\S]*?"phases"\s*:\s*\[[\s\S]*?\][\s\S]*?\})/g
      while ((match = inlineRegex.exec(content)) !== null) {
        try {
          const parsed = JSON.parse(match[1])
          if (parsed.projet && parsed.phases) return true
        } catch { /* continue */ }
      }

      // Pattern 4: Markdown tables with soumission keywords (can be parsed server-side)
      const hasTable = content.includes("|") && content.includes("---")
      const hasKeywords = /soumission|estimation|devis|relev|division\s+\d{2}|relevé|materiaux|main.?d.?oeuvre/i.test(content)
      if (hasTable && hasKeywords) return true

      return false
    })
  }, [messages, hasSavedSoumission])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)
  const prevMessagesLengthRef = useRef(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { toast } = useToast()
  const firstMessageParam = searchParams.get("firstMessage")

  useEffect(() => {
    const handleResize = () => {
      const isKeyboard = window.visualViewport 
        ? window.visualViewport.height < window.innerHeight * 0.75
        : false
      setIsKeyboardOpen(isKeyboard)
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      return () => window.visualViewport?.removeEventListener('resize', handleResize)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior })
    }
  }, [])

  useEffect(() => {
    if (isKeyboardOpen) {
      setTimeout(() => scrollToBottom('smooth'), 100)
    }
  }, [isKeyboardOpen, scrollToBottom])

  useEffect(() => {
    const initializeChat = async () => {
      const authCheck = await checkAuth()
      if (authCheck) {
        await Promise.all([loadConversations(), loadAgents(), checkIfAdmin(), loadOnlineUsers()])
      }
      setIsInitializing(false)
    }

    initializeChat()
  }, [])

  // Auto-send firstMessage from URL (set when creating a project from dashboard)
  const firstMessageSentRef = useRef(false)
  useEffect(() => {
    if (
      firstMessageParam &&
      currentConversationId &&
      messages.length === 0 &&
      !loading &&
      !isInitializing &&
      !firstMessageSentRef.current
    ) {
      firstMessageSentRef.current = true
      const decoded = decodeURIComponent(firstMessageParam)
      sendMessage(decoded, [])
      // Clean URL param without reloading
      const url = new URL(window.location.href)
      url.searchParams.delete("firstMessage")
      window.history.replaceState({}, "", url.toString())
    }
  }, [firstMessageParam, currentConversationId, messages.length, loading, isInitializing])

  useEffect(() => {
    if (currentConversationId) {
      isInitialLoadRef.current = true
      setActiveView("chat")
      loadMessages(currentConversationId)
    }
  }, [currentConversationId])

  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (messages.length > 0) {
        isInitialLoadRef.current = false
        prevMessagesLengthRef.current = messages.length
        setTimeout(() => scrollToBottom('auto'), 50)
      }
    } else if (messages.length > prevMessagesLengthRef.current) {
      const container = scrollContainerRef.current
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200

        if (isNearBottom) {
          scrollToBottom('smooth')
        }
      }
      prevMessagesLengthRef.current = messages.length
    }
  }, [messages, scrollToBottom])

  useEffect(() => {
    const updatePresence = async () => {
      try {
        await fetch("/api/presence/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: currentConversationId }),
        })
      } catch {
        // Presence update is non-critical, silently ignore errors
      }
      await loadOnlineUsers()
    }

    updatePresence()
    const interval = setInterval(updatePresence, 30000)

    return () => {
      clearInterval(interval)
      fetch("/api/presence/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline: true }),
      }).catch(() => {})
    }
  }, [currentConversationId])

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return false
    }

    return true
  }

  const checkIfAdmin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin, role, first_name, email, subscription_type, subscription_status, trial_end_date")
      .eq("id", user.id)
      .single()

    if (profile) {
      setUserProfile({
        first_name: profile.first_name,
        email: profile.email || user.email || "",
        subscription_type: profile.subscription_type,
        subscription_status: profile.subscription_status,
        trial_end_date: profile.trial_end_date,
      })
    }

    if (profile?.is_super_admin) {
      setIsSuperAdmin(true)
    }

    if (profile?.role === "director" || profile?.role === "admin") {
      setIsAdmin(true)
    }
  }

  const loadAgents = async () => {
    const { data, error } = await supabase.from("agents").select("*").eq("is_active", true).order("name")

    if (!error && data) {
      setAgents(data)
    }
  }

  const loadOnlineUsers = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setUserId(user.id)

    const { data: profile } = await supabase.from("profiles").select("company").eq("id", user.id).single()

    if (!profile?.company) return

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, is_online, last_seen_at, current_conversation_id, is_typing")
      .eq("company", profile.company)
      .eq("is_online", true)
      .neq("id", user.id)
      .order("email")

    if (!error && data) {
      setOnlineUsers(data)
    }
  }

  const loadConversations = async () => {
    const { data, error } = await supabase.from("conversations").select("*").order("updated_at", { ascending: false })

    if (error) {
      console.error("Error loading conversations:", error)
      return
    }

    if (data) {
      setConversations(data)
      if (data.length > 0 && !currentConversationId) {
        setCurrentConversationId(data[0].id)
      }
    }
  }

  const loadMessages = async (conversationId: string) => {
    const { data: messagesData, error } = await supabase
      .from("messages")
      .select(`
        *,
        attachments (*)
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error loading messages:", error)
      return
    }

    if (messagesData) {
      setMessages(messagesData)
      // Collect all attachments for the panel
      const allAttachments: Attachment[] = []
      for (const msg of messagesData) {
        if (msg.attachments?.length) allAttachments.push(...msg.attachments)
      }
      setConvAttachments(allAttachments)
    }
  }

  const updateConversationStatus = async (convId: string, status: string) => {
    const { error } = await supabase
      .from("conversations")
      .update({ status })
      .eq("id", convId)

    if (!error) {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, status } : c))
    }
  }

  const handleTyping = useCallback(() => {
    if (!currentConversationId) return
    fetch("/api/presence/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: currentConversationId, isTyping: true }),
    })
  }, [currentConversationId])

  // Users currently viewing this conversation
  const usersInConversation = useMemo(() => {
    if (!currentConversationId) return []
    return onlineUsers.filter(u => u.current_conversation_id === currentConversationId)
  }, [onlineUsers, currentConversationId])

  const openNewConversationDialog = () => {
    setNewConvDialogOpen(true)
  }

  const createNewConversation = async (formData: ProjectFormData) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

  console.log("[v0] Creating conversation with agentId:", formData.agentId, "agents available:", agents.length)
  
  const { data, error } = await supabase
  .from("conversations")
  .insert([{ user_id: user.id, title: formData.title, agent_id: formData.agentId || null }])
  .select()
  .single()

    if (!error && data) {
      // IMPORTANT: Update state BEFORE sending message to ensure consistency
      const newConversationId = data.id
      console.log("[v0] New conversation created with ID:", newConversationId)
      
      setConversations([data, ...conversations])
      setCurrentConversationId(newConversationId)
      setMessages([])
      setNewConvDialogOpen(false)

      // Auto-send the context message as the first user message with attachments
      // Pass data.id directly to GUARANTEE we use the new conversation ID
      // The conversationIdOverride parameter bypasses any stale closure/state issues
      const contextMsg = buildProjectContextMessage(formData)
      const attachmentFiles = formData.attachments?.map(att => att.file) || []
      
      // Use requestAnimationFrame + setTimeout to ensure React has flushed state updates
      requestAnimationFrame(() => {
        setTimeout(() => {
          console.log("[v0] Sending initial message to conversation:", newConversationId)
          sendMessage(contextMsg, attachmentFiles, newConversationId)
        }, 100)
      })
    }
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const { error } = await supabase.from("conversations").delete().eq("id", id)

    if (!error) {
      setConversations(conversations.filter((c) => c.id !== id))
      if (currentConversationId === id) {
        setCurrentConversationId(conversations[0]?.id || null)
        setMessages([])
      }
    }
  }

  // Remplace la fonction uploadFiles dans chat-page.tsx

const uploadFiles = async (messageId: string, files: File[]): Promise<Attachment[]> => {
  const uploadedAttachments: Attachment[] = []

  for (const file of files) {
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        // ✅ NE PAS mettre Content-Type ici — le browser le set automatiquement
        // avec le bon boundary pour FormData. Si tu le forces en application/json
        // c'est ça qui cause "Request En... is not valid JSON"
      })

      // ✅ Vérifier que la réponse est OK avant de parser le JSON
      const text = await response.text()

      if (!response.ok) {
        console.error(`[upload] HTTP ${response.status} pour ${file.name}:`, text)
        toast({
          variant: "destructive",
          title: "Erreur upload",
          description: `${file.name}: ${response.status} ${response.statusText}`,
        })
        continue
      }

      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        console.error(`[upload] Réponse non-JSON pour ${file.name}:`, text)
        continue
      }

      if (!data?.url) {
        console.error(`[upload] Pas d'URL dans la réponse pour ${file.name}:`, data)
        continue
      }

      const { data: attachment, error } = await supabase
        .from("attachments")
        .insert([{
          message_id: messageId,
          file_name: file.name,
          file_url: data.url,
          file_type: file.type,
          file_size: file.size,
        }])
        .select()
        .single()

      if (error) {
        console.error(`[upload] Supabase insert error pour ${file.name}:`, error)
        continue
      }

      if (attachment) {
        uploadedAttachments.push(attachment)
      }

    } catch (err) {
      console.error(`[upload] Erreur inattendue pour ${file.name}:`, err)
    }
  }

  return uploadedAttachments
}

 // ✅ VERSION CORRIGÉE - remplacer la fonction sendMessage dans chat-page.tsx
  // Note: conversationIdOverride allows bypassing closure issues when called right after creating a conversation
  const sendMessage = useCallback(async (text: string, files: File[], conversationIdOverride?: string) => {
    const targetConversationId = conversationIdOverride || currentConversationId
    if ((!text.trim() && files.length === 0) || !targetConversationId || loading) return

    setLoading(true)
    const userMessage = text

    try {
      // Verify conversation exists AND get agent_id from DB (not state, which may be stale for new convos)
      const { data: convCheck, error: convCheckError } = await supabase
        .from("conversations")
        .select("id, agent_id")
        .eq("id", targetConversationId)
        .single()

      if (convCheckError || !convCheck) {
        throw new Error("La conversation n'existe pas ou n'est pas accessible")
      }
      
      const agentId = convCheck.agent_id
      console.log("[v0] sendMessage - conversationId:", targetConversationId, "agentId:", agentId)

      const { data: userMsgData, error: userMsgError } = await supabase
        .from("messages")
        .insert([
          {
            conversation_id: targetConversationId,
            role: "user",
            content: userMessage || "(piece jointe)",
          },
        ])
        .select()
        .single()

      if (userMsgError) throw userMsgError

      // ✅ CORRIGÉ: try/finally garantit que uploading repasse à false même en cas d'erreur
      let attachments: Attachment[] = []
      if (files.length > 0) {
        setUploading(true)
        try {
          attachments = await uploadFiles(userMsgData.id, files)
        } finally {
          setUploading(false)
        }
      }

      setMessages(prev => [...prev, { ...userMsgData, attachments }])

      // ✅ CORRIGÉ: Mettre à jour le panel latéral avec les nouvelles pièces jointes
      if (attachments.length > 0) {
        setConvAttachments(prev => [...prev, ...attachments])
      }

      setTimeout(() => scrollToBottom('smooth'), 50)

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", targetConversationId)

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: targetConversationId,
          message: userMessage,
          attachments: attachments.map((a) => ({ url: a.file_url, type: a.file_type, name: a.file_name })),
          agentId: agentId,
          userId: userId, // Pour charger la spécialité de l'utilisateur
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        const errorMsg = responseData.error || "Erreur inconnue du serveur"
        throw new Error(errorMsg)
      }

      const aiMessage = responseData.message

      const { data: aiMsgData, error: aiMsgError } = await supabase
        .from("messages")
        .insert([
          {
            conversation_id: targetConversationId,
            role: "assistant",
            content: aiMessage,
          },
        ])
        .select()
        .single()

      if (aiMsgError) throw aiMsgError

      setMessages((prev) => [...prev, aiMsgData])
    } catch (error: any) {
      console.error("Error in sendMessage:", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error?.message || "Erreur lors de l'envoi du message",
      })
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, conversations, messages])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleQuestionSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!currentConversationId || loading) return
    const formattedAnswers = answers.formatted
    sendMessage(formattedAnswers, [])
  }, [currentConversationId, loading, sendMessage])

  const renderAttachment = useCallback((attachment: Attachment) => {
    const isImage = attachment.file_type.startsWith("image/")

    if (isImage) {
      return (
        <div key={attachment.id} className="mt-2">
          <img
            src={attachment.file_url || "/placeholder.svg"}
            alt={attachment.file_name}
            className="max-w-full sm:max-w-xs rounded-lg border border-gray-200"
          />
          <p className="text-xs text-gray-500 mt-1">{attachment.file_name}</p>
        </div>
      )
    }

    return (
      <a
        key={attachment.id}
        href={attachment.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors max-w-full sm:max-w-xs"
      >
        <File className="h-4 w-4 flex-shrink-0 text-orange-500" />
        <span className="text-sm truncate text-gray-700">{attachment.file_name}</span>
      </a>
    )
  }, [])

  const messageListMemo = useMemo(() => {
    return messages.map((message) => (
      <div
        key={message.id}
        className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"} mb-4`}
      >
        {/* Avatar */}
        {message.role === "assistant" ? (
          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <HardHat className="h-4 w-4 text-white" />
          </div>
        ) : (
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">U</AvatarFallback>
          </Avatar>
        )}
        {/* Message bubble */}
        <div
          className={`rounded-2xl py-3 px-4 ${
            message.role === "user"
              ? "bg-gray-900 text-white max-w-md ml-auto"
              : "bg-white border border-gray-200 max-w-2xl shadow-sm"
          }`}
        >
          {message.role === "assistant" ? (
            <MarkdownMessage
              content={message.content}
              messageId={message.id}
              onQuestionSubmit={handleQuestionSubmit}
              onNavigateTableur={() => setActiveView("tableur")}
              userId={userId || undefined}
            />
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-2 mt-2">{message.attachments.map(renderAttachment)}</div>
          )}
        </div>
      </div>
    ))
  }, [messages, handleQuestionSubmit, renderAttachment])

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center mx-auto">
            <HardHat className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="mt-4 text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  // Sidebar expanded content
  const SidebarExpanded = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <HardHat className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-800">BuilderAI</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarCollapsed(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <Button 
          onClick={() => { openNewConversationDialog(); setMobileMenuOpen(false); }} 
          className="w-full bg-orange-500 hover:bg-orange-600 text-white h-9"
          size="sm"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Nouvelle conversation
        </Button>
        <Button
          onClick={() => router.push("/dashboard")}
          variant="outline"
          className="w-full h-9 mt-2 text-gray-600 border-gray-200 hover:bg-gray-50"
          size="sm"
        >
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs font-medium text-gray-400 uppercase px-2 mb-2">Conversations</p>
        <div className="space-y-1">
          {conversations.map((conv) => {
            const statusInfo = getStatusStyle(conv.status)
            const viewersCount = onlineUsers.filter(u => u.current_conversation_id === conv.id).length
            return (
              <div
                key={conv.id}
                className={`group flex flex-col gap-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  currentConversationId === conv.id 
                    ? "bg-orange-50 text-orange-700" 
                    : "hover:bg-gray-50 text-gray-700"
                }`}
                onClick={() => { setCurrentConversationId(conv.id); setMobileMenuOpen(false); }}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className={`h-4 w-4 flex-shrink-0 ${
                    currentConversationId === conv.id ? "text-orange-500" : "text-gray-400"
                  }`} />
                  <span className="text-sm truncate flex-1">{conv.title}</span>
                  {viewersCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-green-600" title={`${viewersCount} utilisateur(s) actif(s)`}>
                      <Eye className="h-3 w-3" />
                      {viewersCount}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 bg-transparent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {CONV_STATUSES.map(s => (
                        <DropdownMenuItem 
                          key={s.value}
                          onClick={(e) => { e.stopPropagation(); updateConversationStatus(conv.id, s.value) }}
                        >
                          <Tag className="h-3 w-3 mr-2" />
                          {s.label}
                          {conv.status === s.value && <span className="ml-auto text-orange-500 text-xs font-bold">*</span>}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={(e) => deleteConversation(conv.id, e as any)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1 pl-6">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            )
          })}
          {conversations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Aucune conversation</p>
          )}
        </div>
      </div>

      {/* Online Users */}
      {onlineUsers.length > 0 && (
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-gray-500">{onlineUsers.length} en ligne</span>
          </div>
          <div className="flex -space-x-2">
            {onlineUsers.slice(0, 5).map((user) => (
              <Avatar key={user.id} className="h-7 w-7 border-2 border-white">
                <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                  {user.email.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {onlineUsers.length > 5 && (
              <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                <span className="text-xs text-gray-500">+{onlineUsers.length - 5}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="border-t border-gray-100 p-2 space-y-1">
        <Button 
          onClick={() => { router.push("/profile"); setMobileMenuOpen(false); }} 
          variant="ghost" 
          className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9"
          size="sm"
        >
          <UserCircle className="mr-2 h-4 w-4" />
          Profil
        </Button>
        
        {(isAdmin || isSuperAdmin) && (
          <>
            <Button
              onClick={() => { router.push("/settings"); setMobileMenuOpen(false); }}
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9"
              size="sm"
            >
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </Button>
            {isSuperAdmin && (
              <Button
                onClick={() => { router.push("/admin/agents"); setMobileMenuOpen(false); }}
                variant="ghost"
                className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9"
                size="sm"
              >
                <Sparkles className="mr-2 h-4 w-4 text-orange-500" />
                Agents
              </Button>
            )}
            <Button
              onClick={() => { router.push("/admin/users"); setMobileMenuOpen(false); }}
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-9"
              size="sm"
            >
              <Users className="mr-2 h-4 w-4" />
              Utilisateurs
            </Button>
          </>
        )}
        
        <Button 
          onClick={handleLogout} 
          variant="ghost" 
          className="w-full justify-start text-gray-400 hover:text-red-600 hover:bg-red-50 h-9"
          size="sm"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>

        {/* User info + subscription badge */}
        {userProfile && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 px-1">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="bg-orange-100 text-orange-600 text-xs font-semibold">
                {userProfile.first_name?.[0] || userProfile.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-700 truncate">
                {userProfile.first_name || userProfile.email.split("@")[0]}
              </span>
              <ChatSubscriptionBadge
                subscriptionType={userProfile.subscription_type}
                subscriptionStatus={userProfile.subscription_status}
                trialEndDate={userProfile.trial_end_date}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Sidebar collapsed content
  const SidebarCollapsed = () => (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full bg-white border-r border-gray-200 items-center py-4">
        {/* Logo + Expand */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 mb-4"
              onClick={() => setSidebarCollapsed(false)}
            >
              <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
                <HardHat className="h-4 w-4 text-white" />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Ouvrir le menu</TooltipContent>
        </Tooltip>

        {/* New Conversation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-orange-500 hover:bg-orange-50"
              onClick={openNewConversationDialog}
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Nouvelle conversation</TooltipContent>
        </Tooltip>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto w-full px-2 mt-4">
          <div className="space-y-1">
            {conversations.slice(0, 10).map((conv) => (
              <Tooltip key={conv.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 ${
                      currentConversationId === conv.id 
                        ? "bg-orange-50 text-orange-600" 
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                    onClick={() => setCurrentConversationId(conv.id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{conv.title}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Online indicator */}
        {onlineUsers.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative mb-2">
                <Users className="h-5 w-5 text-gray-400" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{onlineUsers.length} en ligne</TooltipContent>
          </Tooltip>
        )}

        {/* Bottom Actions */}
        <div className="space-y-1 mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-gray-400 hover:text-gray-600"
                onClick={() => router.push("/profile")}
              >
                <UserCircle className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Profil</TooltipContent>
          </Tooltip>

          {(isAdmin || isSuperAdmin) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-gray-400 hover:text-gray-600"
                  onClick={() => router.push("/settings")}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Paramètres</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-gray-400 hover:text-red-500"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Déconnexion</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )

  return (
    <div className="fixed-viewport flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col h-full flex-shrink-0 transition-all duration-300 ${
        sidebarCollapsed ? "w-16" : "w-64"
      }`}>
        {sidebarCollapsed ? <SidebarCollapsed /> : <SidebarExpanded />}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Menu de navigation</SheetDescription>
              <SidebarExpanded />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-orange-500" />
            <span className="font-medium text-gray-800 truncate max-w-[180px]">
              {conversations.find(c => c.id === currentConversationId)?.title || "BuilderAI"}
            </span>
          </div>
          <div className="w-9" />
        </div>
        {currentConversationId && (
          <div className="md:hidden px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
            <ViewTabsBar
              activeView={activeView}
              onViewChange={setActiveView}
              hasData={hasSoumissionData}
            />
          </div>
        )}

        {/* Chat Content + Attachments Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white md:bg-gray-50">
            {currentConversationId ? (
              <>
                {/* Chat Header - Desktop */}
                <div className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium text-gray-800">
                          {conversations.find(c => c.id === currentConversationId)?.title}
                        </h2>
                        {/* Status badge with dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${getStatusStyle(conversations.find(c => c.id === currentConversationId)?.status ?? null).color}`}>
                              {getStatusStyle(conversations.find(c => c.id === currentConversationId)?.status ?? null).label}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {CONV_STATUSES.map(s => (
                              <DropdownMenuItem key={s.value} onClick={() => updateConversationStatus(currentConversationId!, s.value)}>
                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.color.split(" ")[0]}`} />
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">
                          {agents.find(a => a.id === conversations.find(c => c.id === currentConversationId)?.agent_id)?.name || "Assistant IA"}
                        </p>
                        {/* Active users in this conversation */}
                        {usersInConversation.length > 0 && (
                          <div className="flex items-center gap-1 ml-2">
                            <span className="text-[10px] text-gray-400">|</span>
                            <div className="flex -space-x-1.5">
                              {usersInConversation.slice(0, 3).map(u => (
                                <Tooltip key={u.id}>
                                  <TooltipTrigger asChild>
                                    <div className={`h-5 w-5 rounded-full border border-white flex items-center justify-center text-[8px] font-medium ${u.is_typing ? "bg-orange-100 text-orange-600 ring-1 ring-orange-400" : "bg-gray-100 text-gray-600"}`}>
                                      {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <span>{u.first_name ? `${u.first_name} ${u.last_name || ""}` : u.email}</span>
                                    {u.is_typing && <span className="ml-1 text-orange-500">ecrit...</span>}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                            {usersInConversation.some(u => u.is_typing) && (
                              <span className="text-[10px] text-orange-500 ml-1 animate-pulse">ecrit...</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Attachments button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAttachments(!showAttachments)}
                      className={`h-8 gap-1.5 text-xs bg-transparent ${showAttachments ? "text-orange-600 bg-orange-50" : "text-gray-500"}`}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {convAttachments.length > 0 && (
                        <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">{convAttachments.length}</span>
                      )}
                    </Button>
                    
                    {/* Artifacts button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setArtifactsPanelOpen(!artifactsPanelOpen)}
                      className={`h-8 gap-1.5 text-xs bg-transparent ${artifactsPanelOpen ? "text-orange-600 bg-orange-50" : "text-gray-500"}`}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {artifactsCount > 0 && (
                        <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">
                          {artifactsCount}
                        </span>
                      )}
                    </Button>
                    
                    <ViewTabsBar
                      activeView={activeView}
                      onViewChange={setActiveView}
                      hasData={hasSoumissionData}
                    />
                  </div>
                </div>

                {/* View Content */}
                {activeView === "chat" ? (
                  <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
                  >
                    <div className="w-full py-4 px-4 space-y-4">
                      {messages.length === 0 && (
                        <div className="text-center py-12">
                          <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                            <Building2 className="h-8 w-8 text-orange-500" />
                          </div>
                          <h3 className="text-lg font-medium text-gray-800 mb-1">Bienvenue!</h3>
                          <p className="text-gray-500 text-sm max-w-sm mx-auto">
                            Posez vos questions sur les estimations, materiaux ou planification.
                          </p>
                        </div>
                      )}
                      
                      {messageListMemo}
                      
                      {loading && (
                        <div className="flex gap-3">
                          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                            <HardHat className="h-4 w-4 text-white" />
                          </div>
                          <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Other users typing indicators */}
                      {usersInConversation.filter(u => u.is_typing).map(u => (
                        <div key={`typing-${u.id}`} className="flex gap-3 justify-start">
                          <div className="h-8 w-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-gray-600">
                              {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                            </span>
                          </div>
                          <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <span className="text-[10px] text-gray-400">
                                {u.first_name || u.email.split("@")[0]} ecrit...
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ConversationViewContent
                      activeView={activeView}
                      messages={messages}
                      conversationId={currentConversationId}
                      onViewChange={setActiveView}
                    />
                  </div>
                )}
                
                {/* Input Area - Inside flex-col to participate in layout */}
                <div className="border-t border-gray-200 bg-white flex-shrink-0">
                  <div className="max-w-3xl mx-auto p-4">
                    <ChatInput
                      onSend={(text, files) => {
                        // Switch to chat view when sending a message
                        if (activeView !== "chat") {
                          setActiveView("chat")
                        }
                        sendMessage(text, files)
                      }}
                      onTyping={handleTyping}
                      loading={loading}
                      uploading={uploading}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-8 w-8 text-orange-500" />
                  </div>
                  <h2 className="text-xl font-medium text-gray-800 mb-2">BuilderAI</h2>
                  <p className="text-gray-500 mb-4">Assistant pour professionnels de la construction</p>
                  <Button 
                    onClick={openNewConversationDialog}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Démarrer
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Attachments Side Panel */}
          {showAttachments && currentConversationId && (
            <div className="hidden md:flex flex-col w-72 border-l border-gray-200 bg-white flex-shrink-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Pieces jointes</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{convAttachments.length}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 bg-transparent" onClick={() => setShowAttachments(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {convAttachments.length === 0 ? (
                  <div className="text-center py-8">
                    <Paperclip className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Aucune piece jointe</p>
                  </div>
                ) : (
                  convAttachments.map((att) => {
                    const isImage = att.file_type?.startsWith("image/")
                    const sizeMB = att.file_size ? (att.file_size / 1024 / 1024).toFixed(1) : null
                    return (
                      <a
                        key={att.id}
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group"
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isImage ? "bg-blue-50" : "bg-gray-100"}`}>
                          {isImage ? <ImageIcon className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{att.file_name}</p>
                          {sizeMB && <p className="text-[10px] text-gray-400">{sizeMB} Mo</p>}
                        </div>
                        <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                      </a>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Artifacts Side Panel */}
          {currentConversationId && (
            <ArtifactsPanel
              conversationId={currentConversationId}
              isOpen={artifactsPanelOpen}
              onClose={() => setArtifactsPanelOpen(false)}
              onToggle={() => setArtifactsPanelOpen(!artifactsPanelOpen)}
              messages={messages}
              onArtifactsCount={setArtifactsCount}
            />
          )}
        </div>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newConvDialogOpen}
        onOpenChange={setNewConvDialogOpen}
        agents={agents}
        defaultAgentId={agents[0]?.id || ""}
        onCreate={createNewConversation}
      />
    </div>
  )
}

// Wrapper with Suspense for useSearchParams
export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent" />
          <p className="mt-4 text-gray-500">Chargement...</p>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}
