"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  HardHat,
  Home,
  Building2,
  Wrench,
  Zap,
  Droplets,
  Layers,
  ChevronRight,
  ChevronLeft,
  Info,
  User,
  MapPin,
  ClipboardList,
  Paperclip,
  Camera,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react"
import { AddressAutocomplete } from "@/components/address-autocomplete"

export type SubmissionType = {
  id: string
  label: string
  description: string
  examples: string[]
  icon: React.ReactNode
  color: string
}

export const SUBMISSION_TYPES: SubmissionType[] = [
  {
    id: "renovation_generale",
    label: "Rénovation générale",
    description: "Travaux de rénovation couvrant plusieurs corps de métier dans une résidence ou un commerce.",
    examples: ["Cuisine complète", "Salle de bain", "Sous-sol aménagé", "Planchers et peinture"],
    icon: <Home className="h-5 w-5" />,
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    id: "construction_neuve",
    label: "Construction neuve",
    description: "Nouvelle construction résidentielle ou commerciale, de la fondation à la finition.",
    examples: ["Maison unifamiliale", "Chalet", "Immeuble locatif", "Bâtiment commercial"],
    icon: <Building2 className="h-5 w-5" />,
    color: "bg-green-50 border-green-200 text-green-700",
  },
  {
    id: "agrandissement",
    label: "Agrandissement",
    description: "Extension d'un bâtiment existant pour ajouter de la superficie habitable ou utile.",
    examples: ["Annexe", "Garage attenant", "Véranda / solarium", "Deuxième étage"],
    icon: <Layers className="h-5 w-5" />,
    color: "bg-purple-50 border-purple-200 text-purple-700",
  },
  {
    id: "electrique",
    label: "Électricité",
    description: "Travaux électriques résidentiels ou commerciaux, mise aux normes ou nouveaux circuits.",
    examples: ["Panneau électrique", "Éclairage encastré", "Prises et circuits", "Thermostats"],
    icon: <Zap className="h-5 w-5" />,
    color: "bg-yellow-50 border-yellow-200 text-yellow-700",
  },
  {
    id: "plomberie",
    label: "Plomberie",
    description: "Installation, remplacement ou déplacement de systèmes de plomberie.",
    examples: ["Robinetterie", "Évier / lavabo", "Déplacement tuyaux", "Chauffe-eau"],
    icon: <Droplets className="h-5 w-5" />,
    color: "bg-cyan-50 border-cyan-200 text-cyan-700",
  },
  {
    id: "reparation_entretien",
    label: "Réparation / Entretien",
    description: "Travaux ponctuels de réparation ou d'entretien préventif.",
    examples: ["Toiture", "Revêtement extérieur", "Gouttières", "Fondations"],
    icon: <Wrench className="h-5 w-5" />,
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
]

export type ProjectAttachment = {
  file: File
  preview?: string
}

export type ProjectFormData = {
  title: string
  agentId: string
  submissionType: string
  clientName: string
  clientPhone: string
  clientEmail: string
  address: string
  city: string
  postalCode: string
  notes: string
  attachments: ProjectAttachment[]
}

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: { id: string; name: string }[]
  defaultAgentId: string
  onCreate: (data: ProjectFormData) => Promise<void>
}

export function NewProjectDialog({
  open,
  onOpenChange,
  agents,
  defaultAgentId,
  onCreate,
}: NewProjectDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<ProjectFormData>({
    title: "",
    agentId: defaultAgentId,
    submissionType: "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    address: "",
    city: "",
    postalCode: "",
    notes: "",
    attachments: [],
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const selectedType = SUBMISSION_TYPES.find((t) => t.id === form.submissionType)

  const set = (key: keyof ProjectFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const canProceedStep1 = form.submissionType !== ""
  const canProceedStep2 = form.clientName.trim() !== "" && form.address.trim() !== ""
  // Notes/description du mandat is now required (minimum 20 characters)
  const canProceedStep3 = form.title.trim() !== "" && form.notes.trim().length >= 20
  
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    const newAttachments: ProjectAttachment[] = []
    
    Array.from(files).forEach((file) => {
      const attachment: ProjectAttachment = { file }
      if (file.type.startsWith("image/")) {
        attachment.preview = URL.createObjectURL(file)
      }
      newAttachments.push(attachment)
    })
    
    setForm((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
    }))
  }
  
  const removeAttachment = (index: number) => {
    setForm((prev) => {
      const updated = [...prev.attachments]
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!)
      }
      updated.splice(index, 1)
      return { ...prev, attachments: updated }
    })
  }

  const handleClose = () => {
    // Clean up preview URLs
    form.attachments.forEach((att) => {
      if (att.preview) URL.revokeObjectURL(att.preview)
    })
    setStep(1)
    setForm({
      title: "",
      agentId: defaultAgentId,
      submissionType: "",
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      address: "",
      city: "",
      postalCode: "",
      notes: "",
      attachments: [],
    })
    onOpenChange(false)
  }

  const handleCreate = async () => {
    if (!canProceedStep3) return
    setLoading(true)
    try {
      await onCreate({ ...form, agentId: form.agentId || defaultAgentId })
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <HardHat className="h-4 w-4 text-white" />
            </div>
            Nouveau projet
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations pour démarrer votre soumission
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {[
            { n: 1, label: "Type", icon: <ClipboardList className="h-3.5 w-3.5" /> },
            { n: 2, label: "Client", icon: <User className="h-3.5 w-3.5" /> },
            { n: 3, label: "Projet", icon: <MapPin className="h-3.5 w-3.5" /> },
          ].map(({ n, label, icon }) => (
            <div key={n} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  step === n
                    ? "bg-orange-500 text-white"
                    : step > n
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {icon}
                {label}
              </div>
              {n < 3 && <ChevronRight className="h-3 w-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step 1: Type de soumission */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Choisissez le type de soumission pour orienter l'assistant vers les bonnes questions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUBMISSION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => set("submissionType", type.id)}
                  className={cn(
                    "text-left rounded-xl border-2 p-4 transition-all hover:shadow-sm",
                    form.submissionType === type.id
                      ? "border-orange-400 bg-orange-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg border", type.color)}>
                      {type.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{type.label}</span>
                        {form.submissionType === type.id && (
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{type.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {type.examples.map((ex) => (
                      <span
                        key={ex}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Infos client */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            {selectedType && (
              <div className={cn("flex items-center gap-2 p-3 rounded-lg border text-sm", selectedType.color)}>
                {selectedType.icon}
                <span className="font-medium">{selectedType.label}</span>
                <button
                  onClick={() => setStep(1)}
                  className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                >
                  Modifier
                </button>
              </div>
            )}
            <div className="space-y-1">
              <Label>Nom du client <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ex: Jean Tremblay"
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input
                  placeholder="514 000-0000"
                  value={form.clientPhone}
                  onChange={(e) => set("clientPhone", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Courriel</Label>
                <Input
                  type="email"
                  placeholder="client@email.com"
                  value={form.clientEmail}
                  onChange={(e) => set("clientEmail", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Adresse du chantier <span className="text-red-500">*</span></Label>
              <AddressAutocomplete
                placeholder="Commencez a taper une adresse..."
                value={form.address}
                onChange={(value) => set("address", value)}
                onAddressSelect={(details) => {
                  // Auto-fill city and postal code from Google Places
                  if (details.city) set("city", details.city)
                  if (details.postal_code) set("postalCode", details.postal_code)
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ville</Label>
                <Input
                  placeholder="Montreal"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Code postal</Label>
                <Input
                  placeholder="H1A 1A1"
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Titre et agent */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {selectedType && (
              <div className={cn("flex items-center gap-2 p-3 rounded-lg border text-sm", selectedType.color)}>
                {selectedType.icon}
                <span className="font-medium">{selectedType.label}</span>
                <span className="text-gray-500 mx-1">•</span>
                <span className="text-gray-700">{form.clientName}</span>
                {form.city && <><span className="text-gray-500 mx-1">•</span><span className="text-gray-700">{form.city}</span></>}
              </div>
            )}
            <div className="space-y-1">
              <Label>Titre du projet <span className="text-red-500">*</span></Label>
              <Input
                placeholder={`Ex: ${selectedType?.label || "Rénovation"} – ${form.clientName || "Client"}`}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
              <p className="text-xs text-gray-500">
                Ce titre apparaîtra dans votre tableau de bord.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Assistant</Label>
              <Select value={form.agentId} onValueChange={(v) => set("agentId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un assistant" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description du mandat <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Décrivez le projet en détail: travaux souhaités, contraintes, délais, budget approximatif, accès au chantier..."
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Minimum 20 caractères. Plus vous donnez de détails, plus l'assistant sera efficace.
                {form.notes.length > 0 && form.notes.length < 20 && (
                  <span className="text-orange-600 ml-1">({20 - form.notes.length} caractères restants)</span>
                )}
              </p>
            </div>
            
            {/* File attachments section */}
            <div className="space-y-2">
              <Label>Documents et photos</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Importer fichiers
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Prendre photo
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Plans, photos du chantier, devis existants... (optionnel)
              </p>
              
              {/* Attachments preview */}
              {form.attachments.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {form.attachments.map((att, idx) => (
                    <div key={idx} className="relative group">
                      {att.preview ? (
                        <img
                          src={att.preview}
                          alt={att.file.name}
                          className="w-full h-16 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-full h-16 bg-gray-100 rounded-lg border flex flex-col items-center justify-center">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <span className="text-xs text-gray-500 truncate max-w-full px-1">
                            {att.file.name.split('.').pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2 text-sm text-orange-800">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Les informations du client et les pièces jointes seront automatiquement incluses dans le premier message envoyé à l'assistant.
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) handleClose()
              else setStep((s) => (s - 1) as 1 | 2 | 3)
            }}
          >
            {step === 1 ? "Annuler" : (
              <><ChevronLeft className="h-4 w-4 mr-1" />Retour</>
            )}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!canProceedStep3 || loading}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {loading ? "Création..." : "Créer le projet"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Builds the first message to be auto-sent to the agent with all client/project context.
 */
export function buildProjectContextMessage(data: ProjectFormData): string {
  const type = SUBMISSION_TYPES.find((t) => t.id === data.submissionType)
  const lines: string[] = []

  lines.push(`## Nouveau projet de soumission\n`)
  lines.push(`**Type de soumission :** ${type?.label || data.submissionType}`)

  lines.push(`\n### Informations du client`)
  lines.push(`- **Nom :** ${data.clientName}`)
  if (data.clientPhone) lines.push(`- **Téléphone :** ${data.clientPhone}`)
  if (data.clientEmail) lines.push(`- **Courriel :** ${data.clientEmail}`)

  lines.push(`\n### Adresse du chantier`)
  lines.push(`- **Adresse :** ${data.address}`)
  if (data.city) lines.push(`- **Ville :** ${data.city}`)
  if (data.postalCode) lines.push(`- **Code postal :** ${data.postalCode}`)

  lines.push(`\n### Description du mandat`)
  lines.push(data.notes.trim())
  
  if (data.attachments && data.attachments.length > 0) {
    lines.push(`\n### Documents joints`)
    lines.push(`${data.attachments.length} fichier(s) joint(s): ${data.attachments.map(a => a.file.name).join(", ")}`)
    lines.push(`\n*Veuillez analyser les documents ci-joints pour mieux comprendre le projet.*`)
  }

  lines.push(`\n---\nVeuillez analyser ces informations et poser vos questions pour compléter l'évaluation du projet.`)

  return lines.join("\n")
}
