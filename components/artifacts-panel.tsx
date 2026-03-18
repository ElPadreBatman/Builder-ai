"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { 
  X, ChevronRight, ChevronDown, Pencil, Check, Loader2, RefreshCw, 
  Building2, Ruler, Hash, Package, User, DollarSign, Zap, Droplets,
  Home, Calendar, MapPin, Phone, Mail, Hammer, FileText, Clock, Wrench
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Artifact {
  id: string
  category: string
  key: string
  value: string
  unit?: string
  confidence: number
  source: string
  updated_at: string
}

interface ArtifactsPanelProps {
  conversationId: string | null
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
  messages?: Array<{ role: string; content: string; id?: string }>
  onArtifactsCount?: (count: number) => void
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  client: { label: "Client", icon: User, color: "text-blue-600", bgColor: "bg-blue-50" },
  projet: { label: "Projet", icon: Building2, color: "text-orange-600", bgColor: "bg-orange-50" },
  budget: { label: "Budget", icon: DollarSign, color: "text-green-600", bgColor: "bg-green-50" },
  pieces: { label: "Pieces", icon: Home, color: "text-purple-600", bgColor: "bg-purple-50" },
  dimensions: { label: "Dimensions", icon: Ruler, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  quantites: { label: "Quantites", icon: Hash, color: "text-amber-600", bgColor: "bg-amber-50" },
  materiaux: { label: "Materiaux", icon: Package, color: "text-pink-600", bgColor: "bg-pink-50" },
  electrique: { label: "Electrique", icon: Zap, color: "text-yellow-600", bgColor: "bg-yellow-50" },
  plomberie: { label: "Plomberie", icon: Droplets, color: "text-sky-600", bgColor: "bg-sky-50" },
  existant: { label: "Existant", icon: Calendar, color: "text-gray-600", bgColor: "bg-gray-50" },
  divisions: { label: "Divisions DDN", icon: Hammer, color: "text-red-600", bgColor: "bg-red-50" },
  taux: { label: "Taux horaires", icon: Clock, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  soumission: { label: "Soumission", icon: FileText, color: "text-teal-600", bgColor: "bg-teal-50" },
  mandat: { label: "Mandat", icon: FileText, color: "text-emerald-600", bgColor: "bg-emerald-50" },
}

const KEY_LABELS: Record<string, string> = {
  // Client
  nom_client: "Nom",
  telephone: "Telephone",
  courriel: "Courriel",
  langue: "Langue",
  // Projet
  nom: "Nom du projet",
  adresse: "Adresse",
  ville: "Ville",
  code_postal: "Code postal",
  type: "Type",
  categorie_rbq: "Categorie RBQ",
  date_debut: "Date debut",
  delai: "Delai",
  // Budget
  budget_max: "Budget max",
  priorite_budget: "Priorite",
  mode_paiement: "Paiement",
  // Pieces
  cuisine: "Cuisine",
  salle_de_bain: "Salle de bain",
  salon: "Salon",
  chambre: "Chambre",
  sous_sol: "Sous-sol",
  exterieur: "Exterieur",
  // Dimensions
  superficie_totale: "Superficie totale",
  superficie_cuisine: "Superficie cuisine",
  superficie_sdb: "Superficie SdB",
  lineaire_armoires: "Lineaire armoires",
  hauteur_plafond: "Hauteur plafond",
  lineaire_comptoir: "Lineaire comptoir",
  // Quantites
  prises: "Prises electriques",
  luminaires: "Luminaires",
  interrupteurs: "Interrupteurs",
  portes: "Portes",
  fenetres: "Fenetres",
  robinets: "Robinets",
  electromenagers: "Electromenagers",
  armoires_hautes: "Armoires hautes",
  armoires_basses: "Armoires basses",
  tiroirs: "Tiroirs",
  // Materiaux
  comptoir: "Comptoir",
  armoires: "Armoires",
  plancher: "Plancher",
  dosseret: "Dosseret",
  peinture: "Peinture",
  robinetterie: "Robinetterie",
  poignees: "Poignees",
  // Electrique
  panneau: "Panneau",
  circuits_dedies: "Circuits dedies",
  eclairage_encastre: "Eclairage encastre",
  prises_ilot: "Prises ilot",
  // Plomberie
  deplacement_plomberie: "Deplacement",
  type_evier: "Evier",
  robinet_style: "Style robinet",
  lave_vaisselle: "Lave-vaisselle",
  // Existant
  annee_construction: "Annee construction",
  etat_existant: "Etat",
  travaux_anterieurs: "Travaux anterieurs",
  problemes_connus: "Problemes connus",
  // Divisions DDN
  division_demolition: "Demolition/Preparation",
  division_plomberie: "Plomberie",
  division_electricite: "Electricite",
  division_revetements: "Revetements",
  division_finition: "Finition",
  division_menuiserie: "Menuiserie",
  // Taux
  taux_general: "Taux general",
  taux_plomberie: "Taux plomberie",
  taux_electricite: "Taux electricite",
  taux_specialise: "Taux specialise",
  // Soumission
  numero_soumission: "No soumission",
  type_soumission: "Type",
  date_soumission: "Date",
  validite: "Validite",
  entrepreneur: "Entrepreneur",
  entreprise: "Entreprise",
  // Mandat
  resume_projet: "Resume du projet",
  objectif_principal: "Objectif principal",
  type_intervention: "Type d'intervention",
  pieces_concernees: "Pieces concernees",
  travaux_principaux: "Travaux principaux",
  contraintes: "Contraintes",
  points_attention: "Points d'attention",
}

const KEY_ICONS: Record<string, React.ElementType> = {
  telephone: Phone,
  courriel: Mail,
  adresse: MapPin,
  ville: MapPin,
  date_debut: Calendar,
}

function ArtifactItem({ 
  artifact, 
  onUpdate,
  compact = false
}: { 
  artifact: Artifact
  onUpdate: (id: string, value: string, unit?: string) => Promise<void>
  compact?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(artifact.value)
  const [editUnit, setEditUnit] = useState(artifact.unit || "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    await onUpdate(artifact.id, editValue, editUnit || undefined)
    setIsSaving(false)
    setIsEditing(false)
  }

  const label = KEY_LABELS[artifact.key] || artifact.key
  const IconComponent = KEY_ICONS[artifact.key]

  if (compact) {
    return (
      <div className="flex items-center justify-between py-1.5 group">
        <div className="flex items-center gap-2 min-w-0">
          {IconComponent && <IconComponent className="h-3 w-3 text-gray-400 flex-shrink-0" />}
          <span className="text-xs text-gray-500">{label}:</span>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-6 text-xs w-24"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-900 truncate max-w-[120px]">
              {artifact.value}{artifact.unit && ` ${artifact.unit}`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-2.5 w-2.5 text-gray-400" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />
            {artifact.unit && (
              <Input
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                className="h-7 text-sm w-16"
                placeholder="unite"
              />
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 w-7 p-0"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-900 truncate">
              {artifact.value}
            </span>
            {artifact.unit && (
              <span className="text-sm text-gray-500">{artifact.unit}</span>
            )}
            {artifact.confidence < 0.8 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 ml-1">
                ~{Math.round(artifact.confidence * 100)}%
              </Badge>
            )}
          </div>
        )}
      </div>
      {!isEditing && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3 text-gray-400" />
        </Button>
      )}
    </div>
  )
}

function CategorySection({
  category,
  artifacts,
  onUpdate,
  defaultExpanded = true,
}: {
  category: string
  artifacts: Artifact[]
  onUpdate: (id: string, value: string, unit?: string) => Promise<void>
  defaultExpanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const config = CATEGORY_CONFIG[category] || { 
    label: category, 
    icon: Package, 
    color: "text-gray-600",
    bgColor: "bg-gray-50"
  }
  const Icon = config.icon

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className={cn(
          "w-full flex items-center gap-2 py-3 px-3 hover:bg-gray-50 transition-colors",
          isExpanded && config.bgColor
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className="text-sm font-medium text-gray-700">{config.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {artifacts.length}
        </Badge>
      </button>
      {isExpanded && (
        <div className="pb-2">
          {artifacts.map((artifact) => (
            <ArtifactItem
              key={artifact.id}
              artifact={artifact}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Header card for client + project info
function ProjectHeader({
  clientArtifacts,
  projetArtifacts,
  onUpdate,
}: {
  clientArtifacts: Artifact[]
  projetArtifacts: Artifact[]
  onUpdate: (id: string, value: string, unit?: string) => Promise<void>
}) {
  const clientName = clientArtifacts.find(a => a.key === "nom_client")
  const projectName = projetArtifacts.find(a => a.key === "nom")
  const address = projetArtifacts.find(a => a.key === "adresse")
  const city = projetArtifacts.find(a => a.key === "ville")
  const type = projetArtifacts.find(a => a.key === "type")
  const categorie = projetArtifacts.find(a => a.key === "categorie_rbq")
  const phone = clientArtifacts.find(a => a.key === "telephone")
  const email = clientArtifacts.find(a => a.key === "courriel")

  if (!clientName && !projectName && !address) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 via-orange-50 to-amber-50 border-b border-orange-200">
      {/* Project Title */}
      <div className="px-4 pt-4 pb-2 border-b border-orange-100">
        <div className="flex items-start gap-2">
          <Building2 className="h-5 w-5 text-orange-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-orange-900 text-sm leading-tight">
              {projectName?.value || "Nouveau projet"}
            </h3>
            {type && (
              <span className="text-xs text-orange-600 capitalize">{type.value}</span>
            )}
          </div>
          {categorie && (
            <Badge className="bg-orange-600 text-white text-xs">
              Cat. {categorie.value}
            </Badge>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className="px-4 py-3 space-y-1">
        {clientName && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-sm font-medium text-orange-900">{clientName.value}</span>
          </div>
        )}
        {(address || city) && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs text-orange-700">
              {address?.value}{city && `, ${city.value}`}
            </span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs text-orange-700">{phone.value}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs text-orange-700">{email.value}</span>
          </div>
        )}
      </div>

      {/* Quick edit all client/project fields */}
      <details className="px-4 pb-3">
        <summary className="text-xs text-orange-600 cursor-pointer hover:text-orange-800">
          Modifier les details...
        </summary>
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-orange-200">
          {[...clientArtifacts, ...projetArtifacts].map(artifact => (
            <ArtifactItem 
              key={artifact.id} 
              artifact={artifact} 
              onUpdate={onUpdate}
              compact
            />
          ))}
        </div>
      </details>
    </div>
  )
}

export function ArtifactsPanel({
  conversationId,
  isOpen,
  onClose,
  onToggle,
  messages = [],
  onArtifactsCount,
}: ArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<Record<string, Artifact[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const lastMessageCountRef = useRef(0)
  const lastAssistantMessageRef = useRef<string | null>(null)
  const lastConversationIdRef = useRef<string | null>(null)
  const hasFetchedRef = useRef(false)

  // Fetch artifacts from DB (only once per conversation)
  const fetchArtifacts = useCallback(async (force = false) => {
    if (!conversationId) return
    
    // Skip if already fetched for this conversation (unless forced)
    if (!force && hasFetchedRef.current && lastConversationIdRef.current === conversationId) {
      return
    }
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/ai/extract-artifacts?conversation_id=${conversationId}`)
      const data = await response.json()
      if (data.artifacts) {
        setArtifacts(data.artifacts)
        hasFetchedRef.current = true
        lastConversationIdRef.current = conversationId
      }
    } catch (error) {
      console.error("Error fetching artifacts:", error)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  // Extract artifacts from messages
  const extractArtifacts = useCallback(async () => {
    if (!conversationId || messages.length === 0) return
    setIsExtracting(true)
    try {
      const response = await fetch("/api/ai/extract-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      })
      const data = await response.json()
      if (data.success) {
        await fetchArtifacts(true) // Force refresh after extraction
      }
    } catch (error) {
      console.error("Error extracting artifacts:", error)
    } finally {
      setIsExtracting(false)
    }
  }, [conversationId, messages, fetchArtifacts])

  // Update a single artifact
  const updateArtifact = async (id: string, value: string, unit?: string) => {
    try {
      await fetch("/api/ai/extract-artifacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, value, unit }),
      })
      await fetchArtifacts(true) // Force refresh after update
    } catch (error) {
      console.error("Error updating artifact:", error)
    }
  }

  // Fetch on mount and when conversation changes
  useEffect(() => {
    if (conversationId) {
      // Reset refs when conversation changes
      if (lastConversationIdRef.current !== conversationId) {
        hasFetchedRef.current = false
        lastMessageCountRef.current = 0
        lastAssistantMessageRef.current = null
      }
      fetchArtifacts()
    }
  }, [conversationId, fetchArtifacts])

  // Auto-extract when a NEW assistant message is received
  useEffect(() => {
    if (!conversationId || messages.length === 0) return
    
    // Find the last assistant message
    const assistantMessages = messages.filter(m => m.role === "assistant")
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
    
    // Check if this is a new assistant message
    if (
      lastAssistantMessage && 
      lastAssistantMessage.content !== lastAssistantMessageRef.current &&
      messages.length > lastMessageCountRef.current
    ) {
      lastAssistantMessageRef.current = lastAssistantMessage.content
      lastMessageCountRef.current = messages.length
      
      // Trigger extraction after a short delay (allow UI to update first)
      const timer = setTimeout(() => {
        extractArtifacts()
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [messages, conversationId, extractArtifacts])

  const totalArtifacts = Object.values(artifacts).reduce(
    (sum, arr) => sum + arr.length, 0
  )

  // Notify parent of artifact count changes
  useEffect(() => {
    onArtifactsCount?.(totalArtifacts)
  }, [totalArtifacts, onArtifactsCount])

  const categoryOrder = ["mandat", "client", "projet", "soumission", "taux", "divisions", "budget", "pieces", "dimensions", "quantites", "materiaux", "electrique", "plomberie", "existant"]

  if (!isOpen) {
    return null
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Donnees extraites</h3>
          {totalArtifacts > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalArtifacts}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={extractArtifacts}
            disabled={isExtracting || !conversationId}
            title="Rafraichir l'extraction"
          >
            <RefreshCw className={cn("h-4 w-4", isExtracting && "animate-spin")} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Extraction indicator */}
      {isExtracting && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-orange-600" />
          <span className="text-xs text-orange-700">Analyse en cours...</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : totalArtifacts === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Package className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Aucune donnee extraite
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Les informations seront extraites automatiquement des messages
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={extractArtifacts}
              disabled={isExtracting || !conversationId || messages.length === 0}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extraction...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Extraire maintenant
                </>
              )}
            </Button>
          </div>
        ) : (
          <div>
            {/* Project + Client Header Card */}
            <ProjectHeader
              clientArtifacts={artifacts.client || []}
              projetArtifacts={artifacts.projet || []}
              onUpdate={updateArtifact}
            />
            
            {/* Budget Section (highlighted if present) */}
            {artifacts.budget && artifacts.budget.length > 0 && (
              <div className="bg-green-50 border-b border-green-100">
                <CategorySection
                  category="budget"
                  artifacts={artifacts.budget}
                  onUpdate={updateArtifact}
                  defaultExpanded={true}
                />
              </div>
            )}
            
            {/* Other Categories */}
            {categoryOrder.map((category) => {
              if (category === "client" || category === "projet" || category === "budget") return null
              const categoryArtifacts = artifacts[category]
              if (!categoryArtifacts || categoryArtifacts.length === 0) return null
              return (
                <CategorySection
                  key={category}
                  category={category}
                  artifacts={categoryArtifacts}
                  onUpdate={updateArtifact}
                  defaultExpanded={category === "dimensions" || category === "quantites"}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {totalArtifacts > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <Button 
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            disabled={!conversationId}
          >
            Generer la soumission
          </Button>
        </div>
      )}
    </div>
  )
}
