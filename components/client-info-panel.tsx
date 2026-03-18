"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Phone, MapPin, Briefcase, ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export type ClientInfo = {
  nom: string
  entreprise: string
  telephone: string
  email: string
  adresse_chantier: string
  type_projet: string
}

const TYPES_PROJET = [
  "Résidentiel neuf",
  "Agrandissement",
  "Rénovation intérieure",
  "Garage / Annexe",
  "Sous-sol",
  "Commercial",
  "Autre",
]

const EMPTY_CLIENT: ClientInfo = {
  nom: "",
  entreprise: "",
  telephone: "",
  email: "",
  adresse_chantier: "",
  type_projet: "",
}

interface ClientInfoPanelProps {
  conversationId: string
  initialData?: Partial<ClientInfo>
  onUpdate?: (data: ClientInfo) => void
}

export function ClientInfoPanel({ conversationId, initialData, onUpdate }: ClientInfoPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<ClientInfo>({ ...EMPTY_CLIENT, ...initialData })
  const [hasChanges, setHasChanges] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  const handleChange = useCallback((field: keyof ClientInfo, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ client_info: data })
        .eq("id", conversationId)

      if (error) throw error

      setHasChanges(false)
      onUpdate?.(data)
      toast({ title: "Informations client sauvegardées" })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err?.message || "Impossible de sauvegarder",
      })
    } finally {
      setSaving(false)
    }
  }, [data, conversationId, supabase, onUpdate, toast])

  // Résumé affiché quand le panneau est fermé
  const summary = data.nom || data.entreprise || data.telephone
    ? [data.nom || data.entreprise, data.telephone].filter(Boolean).join(" · ")
    : "Aucune info client"

  const hasData = !!(data.nom || data.entreprise || data.telephone || data.adresse_chantier)

  return (
    <div className="border-t border-gray-100">
      {/* Header cliquable */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            hasData ? "bg-orange-100" : "bg-gray-100"
          }`}>
            <User className={`h-3.5 w-3.5 ${hasData ? "text-orange-600" : "text-gray-400"}`} />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-xs font-medium text-gray-700">Client</p>
            <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{summary}</p>
          </div>
        </div>
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        }
      </button>

      {/* Formulaire dépliable */}
      {isOpen && (
        <div className="px-3 pb-3 space-y-3">

          {/* Nom */}
          <div className="space-y-1">
            <Label className="text-[10px] text-gray-500 flex items-center gap-1">
              <User className="h-3 w-3" /> Nom du client
            </Label>
            <Input
              value={data.nom}
              onChange={e => handleChange("nom", e.target.value)}
              placeholder="Jean Tremblay"
              className="h-7 text-xs"
            />
          </div>

          {/* Entreprise */}
          <div className="space-y-1">
            <Label className="text-[10px] text-gray-500 flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> Entreprise
            </Label>
            <Input
              value={data.entreprise}
              onChange={e => handleChange("entreprise", e.target.value)}
              placeholder="Construction XYZ inc."
              className="h-7 text-xs"
            />
          </div>

          {/* Téléphone + Email sur 2 colonnes */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" /> Téléphone
              </Label>
              <Input
                value={data.telephone}
                onChange={e => handleChange("telephone", e.target.value)}
                placeholder="514-000-0000"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-500">Courriel</Label>
              <Input
                value={data.email}
                onChange={e => handleChange("email", e.target.value)}
                placeholder="jean@exemple.com"
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Adresse chantier */}
          <div className="space-y-1">
            <Label className="text-[10px] text-gray-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Adresse du chantier
            </Label>
            <Input
              value={data.adresse_chantier}
              onChange={e => handleChange("adresse_chantier", e.target.value)}
              placeholder="123 Rue Principale, Laval, QC"
              className="h-7 text-xs"
            />
          </div>

          {/* Type de projet */}
          <div className="space-y-1">
            <Label className="text-[10px] text-gray-500">Type de projet</Label>
            <Select value={data.type_projet} onValueChange={v => handleChange("type_projet", v)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {TYPES_PROJET.map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bouton Sauvegarder */}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            size="sm"
            className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-40"
          >
            {saving
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sauvegarde...</>
              : <><Save className="h-3 w-3 mr-1" /> Sauvegarder</>
            }
          </Button>
        </div>
      )}
    </div>
  )
}
