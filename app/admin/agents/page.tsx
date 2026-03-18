"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Trash2, Edit, Plus, ArrowLeft, Search, Globe, Code, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

type Agent = {
  id: string
  name: string
  description: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  is_active: boolean
  response_format: string
  store_conversations: boolean
  tools_enabled: string[]
  vector_store_ids: string[]
  created_at: string
}

const MODEL_CONFIGS = {
  "gpt-5.2-chat-latest": {
    name: "GPT-5.2 Chat Latest",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 32000,
    supportsVision: true,
    supportsTools: true,
    usesResponsesAPI: true,
    description: "Modèle le plus avancé - Responses API avec tools natifs",
  },
  "gpt-5.2": {
    name: "GPT-5.2",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 32000,
    supportsVision: true,
    supportsTools: true,
    usesResponsesAPI: true,
    description: "GPT-5.2 stable - Responses API",
  },
  "gpt-5.1": {
    name: "GPT-5.1",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 32000,
    supportsVision: true,
    supportsTools: true,
    usesResponsesAPI: true,
    description: "GPT-5.1 - Responses API",
  },
  "gpt-4.1": {
    name: "GPT-4.1",
    supportsTemperature: true,
    defaultTemperature: 0.7,
    maxTokens: 32000,
    supportsVision: true,
    supportsTools: true,
    usesResponsesAPI: true,
    description: "GPT-4.1 - Responses API avec tools",
  },
  o1: {
    name: "O1 (Reasoning)",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 32768,
    supportsVision: false,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "Modèle de raisonnement avancé - température fixe",
  },
  "o1-mini": {
    name: "O1 Mini (Reasoning)",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 16384,
    supportsVision: false,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "Version allégée du modèle de raisonnement",
  },
  "gpt-4o": {
    name: "GPT-4o",
    supportsTemperature: true,
    defaultTemperature: 0.7,
    maxTokens: 16000,
    supportsVision: true,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "GPT-4 optimisé multimodal - Chat Completions API",
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    supportsTemperature: true,
    defaultTemperature: 0.7,
    maxTokens: 16000,
    supportsVision: true,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "Version compacte et rapide de GPT-4o",
  },
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    supportsTemperature: true,
    defaultTemperature: 0.7,
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "GPT-4 optimisé pour la vitesse",
  },
  "gpt-4": {
    name: "GPT-4",
    supportsTemperature: true,
    defaultTemperature: 0.7,
    maxTokens: 8192,
    supportsVision: false,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "Modèle GPT-4 standard",
  },
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo",
    supportsTemperature: true,
    defaultTemperature: 0.7,
    maxTokens: 4096,
    supportsVision: false,
    supportsTools: false,
    usesResponsesAPI: false,
    description: "Rapide et économique",
  },
}

const AVAILABLE_TOOLS = [
  {
    id: "file_search",
    name: "File Search",
    description: "Recherche dans vos documents (Vector Store requis)",
    icon: Search,
    requiresVectorStore: true,
  },
  {
    id: "web_search",
    name: "Web Search",
    description: "Recherche sur le web en temps réel",
    icon: Globe,
    requiresVectorStore: false,
  },
  {
    id: "code_interpreter",
    name: "Code Interpreter",
    description: "Exécution de code Python dans un sandbox",
    icon: Code,
    requiresVectorStore: false,
  },
]

export default function AgentsAdminPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_prompt: "",
    model: "gpt-4o",
    temperature: 0.7,
    max_tokens: 2000,
    is_active: true,
    response_format: "text",
    store_conversations: false,
    tools_enabled: [] as string[],
    vector_store_ids: [] as string[],
  })
  const [newVectorStoreId, setNewVectorStoreId] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const currentModelConfig = MODEL_CONFIGS[formData.model as keyof typeof MODEL_CONFIGS]

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  useEffect(() => {
    if (currentModelConfig) {
      setFormData((prev) => ({
        ...prev,
        temperature: currentModelConfig.supportsTemperature ? prev.temperature : currentModelConfig.defaultTemperature,
        max_tokens: Math.min(prev.max_tokens, currentModelConfig.maxTokens),
        tools_enabled: currentModelConfig.supportsTools ? prev.tools_enabled : [],
        vector_store_ids: currentModelConfig.supportsTools ? prev.vector_store_ids : [],
      }))
    }
  }, [formData.model])

  const checkAdminAndLoad = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()

    if (!profile?.is_super_admin) {
      toast({
        variant: "destructive",
        title: "Accès refusé",
        description: "Vous devez être super administrateur",
      })
      router.push("/chat")
      return
    }

    setIsSuperAdmin(true)
    loadAgents()
  }

  const loadAgents = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false })

    if (!error && data) {
      const normalizedAgents = data.map(agent => ({
        ...agent,
        tools_enabled: agent.tools_enabled || [],
        vector_store_ids: agent.vector_store_ids || [],
      }))
      setAgents(normalizedAgents)
    }
    setLoading(false)
  }

  const openDialog = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent)
      setFormData({
        name: agent.name,
        description: agent.description || "",
        system_prompt: agent.system_prompt,
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        is_active: agent.is_active,
        response_format: agent.response_format || "text",
        store_conversations: agent.store_conversations || false,
        tools_enabled: agent.tools_enabled || [],
        vector_store_ids: agent.vector_store_ids || [],
      })
    } else {
      setEditingAgent(null)
      setFormData({
        name: "",
        description: "",
        system_prompt: "",
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 2000,
        is_active: true,
        response_format: "text",
        store_conversations: false,
        tools_enabled: [],
        vector_store_ids: [],
      })
    }
    setNewVectorStoreId("")
    setDialogOpen(true)
  }

  const toggleTool = (toolId: string) => {
    setFormData(prev => {
      const isEnabled = prev.tools_enabled.includes(toolId)
      const newTools = isEnabled 
        ? prev.tools_enabled.filter(t => t !== toolId)
        : [...prev.tools_enabled, toolId]
      return { ...prev, tools_enabled: newTools }
    })
  }

  const addVectorStoreId = () => {
    if (!newVectorStoreId.trim()) return
    if (formData.vector_store_ids.includes(newVectorStoreId.trim())) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Ce Vector Store ID est déjà ajouté",
      })
      return
    }
    
    setFormData(prev => ({
      ...prev,
      vector_store_ids: [...prev.vector_store_ids, newVectorStoreId.trim()]
    }))
    setNewVectorStoreId("")
  }

  const removeVectorStoreId = (id: string) => {
    setFormData(prev => ({
      ...prev,
      vector_store_ids: prev.vector_store_ids.filter(v => v !== id)
    }))
  }

  const saveAgent = async () => {
    if (!formData.name || !formData.system_prompt) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Le nom et le prompt système sont requis",
      })
      return
    }

    if (formData.tools_enabled.includes("file_search") && formData.vector_store_ids.length === 0) {
      toast({
        variant: "destructive",
        title: "Configuration incomplète",
        description: "File Search nécessite au moins un Vector Store ID",
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (editingAgent) {
      const { error } = await supabase.from("agents").update(formData).eq("id", editingAgent.id)

      if (error) {
        console.error("Error updating agent:", error)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors de la mise à jour de l'agent",
        })
        return
      }
      toast({
        title: "Agent mis à jour",
        description: "L'agent a été mis à jour avec succès",
      })
    } else {
      const { error } = await supabase.from("agents").insert([{ ...formData, created_by: user?.id }])

      if (error) {
        console.error("Error creating agent:", error)
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors de la création de l'agent",
        })
        return
      }
      toast({
        title: "Agent créé",
        description: "L'agent a été créé avec succès",
      })
    }

    setDialogOpen(false)
    loadAgents()
  }

  const deleteAgent = async (id: string) => {
    const { error } = await supabase.from("agents").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la suppression de l'agent",
      })
    } else {
      toast({
        title: "Agent supprimé",
        description: "L'agent a été supprimé avec succès",
      })
      loadAgents()
    }
    setDeleteDialogOpen(false)
    setAgentToDelete(null)
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

  if (!isSuperAdmin) return null

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push("/chat")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestion des Agents IA</h1>
              <p className="text-muted-foreground">Créez et configurez vos agents personnalisés</p>
            </div>
          </div>
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel Agent
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const modelConfig = MODEL_CONFIGS[agent.model as keyof typeof MODEL_CONFIGS]
            return (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="mt-1">{agent.description || "Aucune description"}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(agent)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setAgentToDelete(agent.id)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modèle:</span>
                      <span className="font-medium">{modelConfig?.name || agent.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API:</span>
                      <Badge variant={modelConfig?.usesResponsesAPI ? "default" : "secondary"} className="text-xs">
                        {modelConfig?.usesResponsesAPI ? "Responses" : "Chat Completions"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Température:</span>
                      <span className="font-medium">{agent.temperature}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens max:</span>
                      <span className="font-medium">{agent.max_tokens}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Statut:</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          agent.is_active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {agent.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    
                    {agent.tools_enabled && agent.tools_enabled.length > 0 && (
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground text-xs">Tools:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.tools_enabled.map(tool => (
                            <Badge key={tool} variant="outline" className="text-xs">
                              {tool === "file_search" && <Search className="h-3 w-3 mr-1" />}
                              {tool === "web_search" && <Globe className="h-3 w-3 mr-1" />}
                              {tool === "code_interpreter" && <Code className="h-3 w-3 mr-1" />}
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {agent.vector_store_ids && agent.vector_store_ids.length > 0 && (
                      <div className="pt-1">
                        <span className="text-muted-foreground text-xs">
                          Vector Stores: {agent.vector_store_ids.length}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAgent ? "Modifier l'agent" : "Nouvel agent"}</DialogTitle>
              <DialogDescription>Configurez les paramètres de votre agent IA</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'agent *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Assistant Marketing"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Spécialisé dans le marketing digital"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="system_prompt">Prompt système *</Label>
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  placeholder="Tu es un expert en marketing digital..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modèle IA</Label>
                <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5.2-chat-latest" className="font-semibold">
                      🚀 GPT-5.2 Chat Latest
                    </SelectItem>
                    <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                    <SelectItem value="gpt-5.1">GPT-5.1</SelectItem>
                    <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                    <SelectItem value="o1">O1 (Reasoning)</SelectItem>
                    <SelectItem value="o1-mini">O1 Mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
                {currentModelConfig && (
                  <div className="p-3 bg-muted rounded-md space-y-1">
                    <p className="text-xs text-muted-foreground">{currentModelConfig.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-background rounded">
                        Max: {currentModelConfig.maxTokens.toLocaleString()}
                      </span>
                      {currentModelConfig.supportsVision && (
                        <span className="text-xs px-2 py-0.5 bg-background rounded">Vision ✓</span>
                      )}
                      {currentModelConfig.supportsTools && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded">Tools ✓</span>
                      )}
                      {currentModelConfig.usesResponsesAPI && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded">Responses API</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {currentModelConfig?.supportsTools && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-base font-semibold">🔧 Tools (Responses API)</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Activez les outils natifs OpenAI pour cet agent
                    </p>
                  </div>

                  <div className="space-y-3">
                    {AVAILABLE_TOOLS.map((tool) => {
                      const isEnabled = formData.tools_enabled.includes(tool.id)
                      const Icon = tool.icon
                      
                      return (
                        <div
                          key={tool.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                            isEnabled ? "bg-primary/5 border-primary/30" : "bg-background"
                          }`}
                        >
                          <Checkbox
                            id={tool.id}
                            checked={isEnabled}
                            onCheckedChange={() => toggleTool(tool.id)}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={tool.id}
                              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                            >
                              <Icon className="h-4 w-4" />
                              {tool.name}
                            </label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {formData.tools_enabled.includes("file_search") && (
                    <div className="space-y-3 pt-3 border-t">
                      <Label>Vector Store IDs *</Label>
                      <p className="text-xs text-muted-foreground">
                        Ajoutez les IDs des Vector Stores OpenAI contenant vos documents
                      </p>
                      
                      <div className="flex gap-2">
                        <Input
                          value={newVectorStoreId}
                          onChange={(e) => setNewVectorStoreId(e.target.value)}
                          placeholder="vs_abc123..."
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVectorStoreId())}
                        />
                        <Button type="button" onClick={addVectorStoreId} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {formData.vector_store_ids.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {formData.vector_store_ids.map((id) => (
                            <Badge key={id} variant="secondary" className="flex items-center gap-1">
                              <Search className="h-3 w-3" />
                              {id.length > 20 ? `${id.substring(0, 20)}...` : id}
                              <button
                                type="button"
                                onClick={() => removeVectorStoreId(id)}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="p-3 bg-amber-500/10 rounded-md">
                        <p className="text-xs text-amber-600">
                          💡 Pour créer un Vector Store, utilisez l'API OpenAI ou le Playground.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {currentModelConfig?.supportsTemperature ? (
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Température ({formData.temperature})</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: Number.parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">0 = précis, 2 = créatif</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Température</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground">
                        Température fixe pour ce modèle
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="max_tokens">Tokens maximum</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    min="100"
                    max={currentModelConfig?.maxTokens || 16000}
                    step="100"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: Number.parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max: {currentModelConfig?.maxTokens.toLocaleString() || "16,000"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Agent actif</Label>
                  <p className="text-xs text-muted-foreground">Les agents inactifs ne sont pas disponibles</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="response_format">Format de réponse</Label>
                <Select
                  value={formData.response_format}
                  onValueChange={(value) => setFormData({ ...formData, response_format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte (par défaut)</SelectItem>
                    <SelectItem value="json_object">JSON Object</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="store_conversations">Stocker chez OpenAI</Label>
                  <p className="text-xs text-muted-foreground">
                    Stockage des conversations pour amélioration
                  </p>
                </div>
                <Switch
                  id="store_conversations"
                  checked={formData.store_conversations}
                  onCheckedChange={(checked) => setFormData({ ...formData, store_conversations: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={saveAgent}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'agent</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet agent ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => agentToDelete && deleteAgent(agentToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
