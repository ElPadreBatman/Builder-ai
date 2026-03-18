"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { Soumission, TaskList, Item } from "@/types/soumission"
import { calculerTotauxSoumission, DIVISIONS_MASTERFORMAT } from "@/types/soumission"
import { Loader2, Download, FileText, Table2, FileSpreadsheet, Pencil, Check, Plus, Trash2, Undo2, Save, Clock, ChevronDown, ChevronRight, Eye, EyeOff, Sparkles, ArrowUpDown, GripVertical, ListTodo, X, MoreVertical, MoveRight, CheckSquare, Square, Printer, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"


// ============================================================================
// Types
// ============================================================================
type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
}

// ============================================================================
// Helpers
// ============================================================================
function extractSoumissionJSON(messages: Message[]): Soumission | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content

    // Pattern 1: Raw markdown ```json:soumission or ```json
    const mdRegex = /```(?:json:soumission|json)\s*\n([\s\S]*?)\n```/g
    let match
    while ((match = mdRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1])
        if (parsed.projet && parsed.phases) return parsed as Soumission
      } catch { /* continue */ }
    }

    // Pattern 2: HTML-rendered <pre><code class="language-json:soumission">
    const htmlRegex = /<pre><code[^>]*class="language-json(?::soumission)?"[^>]*>([\s\S]*?)<\/code><\/pre>/g
    while ((match = htmlRegex.exec(content)) !== null) {
      try {
        // Decode HTML entities
        const decoded = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        const parsed = JSON.parse(decoded)
        if (parsed.projet && parsed.phases) return parsed as Soumission
      } catch { /* continue */ }
    }

    // Pattern 3: Inline JSON object with "projet" and "phases" keys (fallback)
    const inlineRegex = /(\{[\s\S]*?"projet"\s*:\s*\{[\s\S]*?"phases"\s*:\s*\[[\s\S]*?\][\s\S]*?\})/g
    while ((match = inlineRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1])
        if (parsed.projet && parsed.phases) return parsed as Soumission
      } catch { /* continue */ }
    }
  }
  return null
}

function extractLastSoumissionContent(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content
    const hasTable = content.includes("|") && content.includes("---")
    const hasKeywords = /relevé de quantité|soumission|estimation|devis/i.test(content)
    if (hasTable && hasKeywords) return content
  }
  return null
}

const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
const fmtQte = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 4 })

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// ============================================================================
// Editable cell component
// ============================================================================
function EditableCell({
  value,
  onChange,
  type = "text",
  className = "",
  align = "left",
  format = "currency",
}: {
  value: string | number
  onChange: (val: string) => void
  type?: "text" | "number"
  className?: string
  align?: "left" | "right" | "center"
  format?: "currency" | "quantity" | "text"
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const handleBlur = () => {
    setEditing(false)
    onChange(draft)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditing(false)
      onChange(draft)
    }
    if (e.key === "Escape") {
      setDraft(String(value))
      setEditing(false)
    }
  }

  const textAlign = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

  const displayValue = () => {
    if (type !== "number") return value
    const n = Number(value)
    if (format === "quantity") return fmtQte(n)
    return fmt(n)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full bg-orange-50 border border-orange-300 rounded px-1.5 py-0.5 text-sm ${textAlign} focus:outline-none focus:ring-1 focus:ring-orange-400 ${className}`}
        step={type === "number" ? "0.01" : undefined}
      />
    )
  }

  return (
    <span
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
      className={`cursor-pointer hover:bg-orange-50 rounded px-1 py-0.5 transition-colors inline-block w-full ${textAlign} ${className}`}
      title="Cliquer pour modifier"
    >
      {displayValue()}
    </span>
  )
}

// ============================================================================
// SEARCHABLE DESCRIPTION CELL (with price list lookup)
// ============================================================================
interface PriceListItem {
  id: number
  material_name: string
  material_code: string
  category: string
  unit: string
  unit_price: number
  supplier: string
  installation_cost: number | null
  total_cost: number | null
}

function SearchableDescriptionCell({
  value,
  onChange,
  onSelectPriceItem,
}: {
  value: string
  onChange: (val: string) => void
  onSelectPriceItem: (item: PriceListItem) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [searchResults, setSearchResults] = useState<PriceListItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
        setEditing(false)
        if (draft !== value) onChange(draft)
      }
    }
    if (editing) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [editing, draft, value, onChange])

  const searchPriceList = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/price-list/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.items || [])
        setShowDropdown(data.items?.length > 0)
      }
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDraft(val)
    // Debounce search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => searchPriceList(val), 300)
  }

  const handleSelectItem = (item: PriceListItem) => {
    setDraft(item.material_name)
    onChange(item.material_name)
    onSelectPriceItem(item)
    setShowDropdown(false)
    setEditing(false)
  }

  const handleBlur = () => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      if (!showDropdown) {
        setEditing(false)
        if (draft !== value) onChange(draft)
      }
    }, 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditing(false)
      setShowDropdown(false)
      if (draft !== value) onChange(draft)
    } else if (e.key === "Escape") {
      setDraft(value)
      setEditing(false)
      setShowDropdown(false)
    }
  }

  if (editing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full bg-orange-50 border border-orange-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          placeholder="Rechercher dans la liste de prix..."
        />
        {isSearching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-3 w-3 border border-orange-400 border-t-transparent rounded-full" />
          </div>
        )}
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectItem(item)}
                className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="font-medium text-sm text-gray-800 truncate">{item.material_name}</div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>{item.category}</span>
                  <span>{item.unit}</span>
                  <span className="font-medium text-orange-600">${item.unit_price?.toFixed(2)}</span>
                  {item.supplier && <span className="text-gray-400">{item.supplier}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <span
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
      className="cursor-pointer hover:bg-orange-50 rounded px-1 py-0.5 transition-colors inline-block w-full"
      title="Cliquer pour rechercher dans la liste de prix"
    >
      {value || <span className="text-gray-400 italic">Cliquer pour ajouter...</span>}
    </span>
  )
}

// ============================================================================
// TABLEUR VIEW (with editable state)
// ============================================================================
const SHEET_TABS = [
  { key: "synthese", label: "Synthese" },
  { key: "details", label: "Details par phase" },
  { key: "divisions", label: "Par division" },
  { key: "hypotheses", label: "Hypotheses" },
  { key: "inclusions", label: "Inclusions-Exclusions" },
  { key: "echeancier", label: "Echeancier" },
  ] as const

type SheetKey = (typeof SHEET_TABS)[number]["key"]

function TableurView({
  soumission,
  onSoumissionChange,
}: {
  soumission: Soumission
  onSoumissionChange?: (s: Soumission) => void
}) {
  const [originalSnapshot] = useState<Soumission>(() => deepClone(soumission))
  const [activeSheet, setActiveSheet] = useState<SheetKey>("synthese")
  const hasChanges = JSON.stringify(soumission) !== JSON.stringify(originalSnapshot)

  const totaux = useMemo(() => calculerTotauxSoumission(soumission), [soumission])

  const applySoumissionChange = useCallback(
    (updater: (prev: Soumission) => Soumission) => {
      if (onSoumissionChange) {
        onSoumissionChange(updater(soumission))
      }
    },
    [soumission, onSoumissionChange],
  )

  const updateItem = useCallback(
    (phaseIdx: number, divIdx: number, itemIdx: number, field: "quantite" | "prix_unitaire" | "description" | "type" | "unite", value: string) => {
      applySoumissionChange(prev => {
        const next = deepClone(prev)
        const item = next.phases[phaseIdx].divisions[divIdx].items[itemIdx]
        if (field === "quantite" || field === "prix_unitaire") {
          const num = Number.parseFloat(value)
          if (!Number.isNaN(num)) (item as any)[field] = num
        } else {
          ;(item as any)[field] = value
        }
        return next
      })
    },
    [applySoumissionChange],
  )

  // Update item from price list selection (updates description, unite, and prix_unitaire at once)
  const updateItemFromPriceList = useCallback(
    (phaseIdx: number, divIdx: number, itemIdx: number, priceItem: { material_name: string; unit: string; unit_price: number }) => {
      applySoumissionChange(prev => {
        const next = deepClone(prev)
        const item = next.phases[phaseIdx].divisions[divIdx].items[itemIdx]
        item.description = priceItem.material_name
        item.unite = priceItem.unit
        item.prix_unitaire = priceItem.unit_price
        return next
      })
    },
    [applySoumissionChange],
  )

  const addItem = useCallback((phaseIdx: number, divIdx: number, taskListId?: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.phases[phaseIdx].divisions[divIdx].items.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: "Nouveau poste",
        type: "Mat.",
        quantite: 0,
        unite: "u",
        prix_unitaire: 0,
        task_list_id: taskListId,
        order: next.phases[phaseIdx].divisions[divIdx].items.length,
      })
      return next
    })
  }, [applySoumissionChange])

  const addItems = useCallback((phaseIdx: number, divIdx: number, items: Array<Partial<Item>>) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      const currentLen = next.phases[phaseIdx].divisions[divIdx].items.length
      items.forEach((item, idx) => {
        next.phases[phaseIdx].divisions[divIdx].items.push({
          id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          description: item.description || "Nouveau poste",
          type: (item.type as "MO" | "Mat.") || "Mat.",
          quantite: item.quantite || 0,
          unite: item.unite || "u",
          prix_unitaire: item.prix_unitaire || 0,
          code: item.code,
          task_list_id: item.task_list_id,
          order: currentLen + idx,
        })
      })
      return next
    })
  }, [applySoumissionChange])

  const removeItem = useCallback((phaseIdx: number, divIdx: number, itemIdx: number) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.phases[phaseIdx].divisions[divIdx].items.splice(itemIdx, 1)
      return next
    })
  }, [applySoumissionChange])

  // Division management
  const addDivision = useCallback((phaseIdx: number, divCode: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (next.phases[phaseIdx].divisions.some(d => d.code === divCode)) return next
      next.phases[phaseIdx].divisions.push({
        code: divCode,
        nom: DIVISIONS_MASTERFORMAT[divCode] || `Division ${divCode}`,
        items: [{ description: "Nouveau poste", type: "Mat.", quantite: 0, unite: "u", prix_unitaire: 0 }],
      })
      next.phases[phaseIdx].divisions.sort((a, b) => a.code.localeCompare(b.code))
      return next
    })
  }, [applySoumissionChange])

  const removeDivision = useCallback((phaseIdx: number, divIdx: number) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.phases[phaseIdx].divisions.splice(divIdx, 1)
      return next
    })
  }, [applySoumissionChange])

  // Phase management
  const addPhase = useCallback(() => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.phases.push({ code: `PH-${next.phases.length + 1}`, nom: "Nouvelle phase", divisions: [] })
      return next
    })
  }, [applySoumissionChange])

  const removePhase = useCallback((phaseIdx: number) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (next.phases.length <= 1) return next
      next.phases.splice(phaseIdx, 1)
      return next
    })
  }, [applySoumissionChange])

  const renamePhase = useCallback((phaseIdx: number, field: "nom" | "code", value: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.phases[phaseIdx][field] = value
      return next
    })
  }, [applySoumissionChange])

  // Task list management
  const addTaskList = useCallback((phaseIdx: number, divIdx: number, name: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (!next.phases[phaseIdx].divisions[divIdx].task_lists) {
        next.phases[phaseIdx].divisions[divIdx].task_lists = []
      }
      const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"]
      const existingCount = next.phases[phaseIdx].divisions[divIdx].task_lists!.length
      next.phases[phaseIdx].divisions[divIdx].task_lists!.push({
        id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        color: colors[existingCount % colors.length],
        order: existingCount,
      })
      return next
    })
  }, [applySoumissionChange])

  const removeTaskList = useCallback((phaseIdx: number, divIdx: number, listId: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      const lists = next.phases[phaseIdx].divisions[divIdx].task_lists
      if (lists) {
        const idx = lists.findIndex(l => l.id === listId)
        if (idx !== -1) lists.splice(idx, 1)
      }
      // Move items from deleted list to no list
      next.phases[phaseIdx].divisions[divIdx].items.forEach(item => {
        if (item.task_list_id === listId) {
          item.task_list_id = undefined
        }
      })
      return next
    })
  }, [applySoumissionChange])

  const updateDivisionItems = useCallback((phaseIdx: number, divIdx: number, items: Item[], taskLists: TaskList[]) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.phases[phaseIdx].divisions[divIdx].items = items
      next.phases[phaseIdx].divisions[divIdx].task_lists = taskLists
      return next
    })
  }, [applySoumissionChange])

  const reorderItems = useCallback((phaseIdx: number, divIdx: number, fromIdx: number, toIdx: number, targetListId?: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      const items = next.phases[phaseIdx].divisions[divIdx].items
      const [movedItem] = items.splice(fromIdx, 1)
      if (targetListId !== undefined) {
        movedItem.task_list_id = targetListId
      }
      items.splice(toIdx, 0, movedItem)
      // Update order for all items
      items.forEach((item, idx) => {
        item.order = idx
      })
      return next
    })
  }, [applySoumissionChange])

  // Inclusions/Exclusions management
  const addInclusion = useCallback((text: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (!next.inclusions) next.inclusions = []
      next.inclusions.push(text)
      return next
    })
  }, [applySoumissionChange])

  const removeInclusion = useCallback((idx: number) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.inclusions?.splice(idx, 1)
      return next
    })
  }, [applySoumissionChange])

  const updateInclusion = useCallback((idx: number, text: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (next.inclusions) next.inclusions[idx] = text
      return next
    })
  }, [applySoumissionChange])

  const addExclusion = useCallback((text: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (!next.exclusions) next.exclusions = []
      next.exclusions.push(text)
      return next
    })
  }, [applySoumissionChange])

  const removeExclusion = useCallback((idx: number) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      next.exclusions?.splice(idx, 1)
      return next
    })
  }, [applySoumissionChange])

  const updateExclusion = useCallback((idx: number, text: string) => {
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      if (next.exclusions) next.exclusions[idx] = text
      return next
    })
  }, [applySoumissionChange])

  const resetToOriginal = useCallback(() => {
    if (onSoumissionChange) onSoumissionChange(deepClone(originalSnapshot))
  }, [originalSnapshot, onSoumissionChange])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b flex-shrink-0 gap-2 flex-wrap">
        <div className="flex border-b-0 overflow-x-auto gap-0">
          {SHEET_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSheet(tab.key)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSheet === tab.key
                  ? "border-orange-500 text-orange-700 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-orange-600 font-medium">Modifie</span>
            <Button size="sm" variant="outline" onClick={resetToOriginal} className="h-7 text-xs gap-1 bg-transparent">
              <Undo2 className="h-3 w-3" />
              Reinitialiser
            </Button>
          </div>
        )}
      </div>

      {/* Sheet content */}
      <div className="flex-1 overflow-auto p-4 pb-20 min-w-0">
        {activeSheet === "synthese" && <SyntheseSheet soumission={soumission} totaux={totaux} onParametresChange={(field, value) => {
          applySoumissionChange(prev => {
            const next = deepClone(prev)
            // Ensure parametres exists before setting field
            if (!next.parametres) {
              next.parametres = { taux_fg: 0.10, taux_imprevu: 0.18 }
            }
            ;(next.parametres as any)[field] = value
            return next
          })
        }} onMandatChange={(mandat) => {
          applySoumissionChange(prev => {
            const next = deepClone(prev)
            ;(next.projet as any).portee_travaux = mandat
            return next
          })
        }} />}
        {activeSheet === "details" && (
          <DetailsSheet
            soumission={soumission}
            updateItem={updateItem}
            updateItemFromPriceList={updateItemFromPriceList}
            addItem={addItem}
            addItems={addItems}
            removeItem={removeItem}
            addDivision={addDivision}
            removeDivision={removeDivision}
            addPhase={addPhase}
            removePhase={removePhase}
            renamePhase={renamePhase}
            addTaskList={addTaskList}
            removeTaskList={removeTaskList}
            updateDivisionItems={updateDivisionItems}
            reorderItems={reorderItems}
            applySoumissionChange={applySoumissionChange}
          />
        )}
        {activeSheet === "divisions" && <DivisionsSheet soumission={soumission} totaux={totaux} />}
        {activeSheet === "hypotheses" && <HypothesesSheet soumission={soumission} />}
        {activeSheet === "inclusions" && (
          <InclusionsSheet
            soumission={soumission}
            addInclusion={addInclusion}
            removeInclusion={removeInclusion}
            updateInclusion={updateInclusion}
            addExclusion={addExclusion}
            removeExclusion={removeExclusion}
            updateExclusion={updateExclusion}
            onBulkUpdate={(inclusions, exclusions) => {
              applySoumissionChange(prev => {
                const next = deepClone(prev)
                next.inclusions = inclusions
                next.exclusions = exclusions
                return next
              })
            }}
          />
        )}
        {activeSheet === "echeancier" && (
          <EcheancierSheet
            soumission={soumission}
            onEcheancierChange={(echeancier) => {
              applySoumissionChange(prev => {
                const next = deepClone(prev)
                ;(next as any).echeancier = echeancier
                return next
              })
            }}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// SYNTHESE SHEET
// ============================================================================
function SyntheseSheet({
  soumission,
  totaux,
  onParametresChange,
  onMandatChange,
}: { 
  soumission: Soumission
  totaux: ReturnType<typeof calculerTotauxSoumission>
  onParametresChange?: (field: string, value: number) => void
  onMandatChange?: (mandat: string) => void
}) {
  const params = soumission.parametres || { taux_fg: 0.10, taux_imprevu: 0.18 }
  // Use values directly from soumission.parametres (controlled by parent)
  const tauxOH = params.taux_fg ?? 0.10
  const tauxImprevu = params.taux_imprevu ?? 0.18
  const [mandat, setMandat] = useState((soumission.projet as any).portee_travaux || (soumission.projet as any).description || "")
  const [isGeneratingMandat, setIsGeneratingMandat] = useState(false)
  
  // Sync mandat when soumission changes
  useEffect(() => {
    const newMandat = (soumission.projet as any).portee_travaux || (soumission.projet as any).description || ""
    if (newMandat !== mandat) setMandat(newMandat)
  }, [soumission.projet])
  
  const handleTauxChange = (field: 'taux_fg' | 'taux_imprevu', value: number) => {
    // Call parent callback immediately - no local state needed
    if (onParametresChange) onParametresChange(field, value)
  }

  const handleMandatChange = (value: string) => {
    setMandat(value)
    if (onMandatChange) onMandatChange(value)
  }

  const generateMandatAI = async () => {
    setIsGeneratingMandat(true)
    try {
      // Build context from divisions and items
      const divisionsSummary = (soumission.phases || []).flatMap(phase =>
        (phase.divisions || []).map(div => ({
          code: div.code,
          nom: div.nom,
          items: div.items.map(it => it.description).slice(0, 10),
          taskLists: ((div as any).task_lists || []).map((l: any) => l.name),
        }))
      )

      const response = await fetch("/api/ai/generate-mandat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: soumission.projet.nom,
          client: soumission.projet.client,
          adresse: soumission.projet.adresse,
          divisions: divisionsSummary,
        }),
      })

      if (!response.ok) throw new Error("Erreur generation")
      const data = await response.json()
      
      if (data.mandat) {
        setMandat(data.mandat)
        if (onMandatChange) onMandatChange(data.mandat)
      }
    } catch (error) {
      console.error("Erreur generation mandat:", error)
    } finally {
      setIsGeneratingMandat(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-orange-600">{`SOUMISSION - ${soumission.projet.nom.toUpperCase()}`}</h3>
        <p className="text-sm text-gray-500">{`Client: ${soumission.projet.client || "A confirmer"} | Adresse: ${soumission.projet.adresse || "A confirmer"}`}</p>
        <p className="text-xs text-gray-400">{`Date: ${soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA")} | Validite: ${soumission.projet.validite_jours || 30} jours | RBQ: 5806-1391-01`}</p>
      </div>

      {/* Section Mandat / Portee des travaux */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Mandat / Portee des travaux</label>
          <Button
            onClick={generateMandatAI}
            disabled={isGeneratingMandat}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7"
          >
            {isGeneratingMandat ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Generation...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Generer par AI
              </>
            )}
          </Button>
        </div>
        <textarea
          value={mandat}
          onChange={e => handleMandatChange(e.target.value)}
          placeholder="Decrivez la portee des travaux, le mandat confie, les objectifs du projet..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none resize-y min-h-[80px]"
          rows={3}
        />
      </div>

      {/* Controls for margins */}
      <div className="flex items-center gap-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Marge OH:</label>
          <input
            type="number"
            value={Math.round(tauxOH * 100)}
            onChange={e => handleTauxChange('taux_fg', Number(e.target.value) / 100)}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-400 focus:outline-none"
            step="1"
            min="0"
            max="100"
          />
          <span className="text-sm text-gray-600">%</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Imprévus:</label>
          <input
            type="number"
            value={Math.round(tauxImprevu * 100)}
            onChange={e => handleTauxChange('taux_imprevu', Number(e.target.value) / 100)}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-400 focus:outline-none"
            step="1"
            min="0"
            max="100"
          />
          <span className="text-sm text-gray-600">%</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#2F5496] text-white">
              <th className="px-3 py-2 text-left font-medium">Phase</th>
              <th className="px-3 py-2 text-right font-medium">Couts directs</th>
              <th className="px-3 py-2 text-right font-medium">{`OH ${Math.round(tauxOH * 100)}%`}</th>
              <th className="px-3 py-2 text-right font-medium">{`Imprevus ${Math.round(tauxImprevu * 100)}%`}</th>
              <th className="px-3 py-2 text-right font-medium">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {totaux.phaseDetails.map((phase, i) => {
              const oh = phase.cd * tauxOH
              const imp = phase.cd * tauxImprevu
              const totalHT = phase.cd + oh + imp
              return (
                <tr key={phase.code} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 border border-gray-200">{`${phase.code} - ${phase.nom}`}</td>
                  <td className="px-3 py-2 text-right border border-gray-200">{fmt(phase.cd)}</td>
                  <td className="px-3 py-2 text-right border border-gray-200">{fmt(oh)}</td>
                  <td className="px-3 py-2 text-right border border-gray-200">{fmt(imp)}</td>
                  <td className="px-3 py-2 text-right border border-gray-200 font-semibold">{fmt(totalHT)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#D6DCE5] font-bold">
              <td className="px-3 py-2 border border-gray-300">SOUS-TOTAL</td>
              <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalCD)}</td>
              <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalCD * tauxOH)}</td>
              <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalCD * tauxImprevu)}</td>
              <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalCD * (1 + tauxOH + tauxImprevu))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="space-y-1 text-sm w-64">
          <div className="flex justify-between px-3 py-1">
            <span className="font-medium">TPS (5%)</span>
            <span>{fmt(totaux.totalCD * (1 + tauxOH + tauxImprevu) * 0.05)}</span>
          </div>
          <div className="flex justify-between px-3 py-1">
            <span className="font-medium">TVQ (9,975%)</span>
            <span>{fmt(totaux.totalCD * (1 + tauxOH + tauxImprevu) * 0.09975)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 bg-[#F47920] text-white font-bold rounded">
            <span>TOTAL TTC</span>
            <span>{fmt(totaux.totalCD * (1 + tauxOH + tauxImprevu) * 1.14975)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUGGESTIONS MODAL
// ============================================================================
interface SuggestedItem {
  code: string
  description: string
  type: "MO" | "Mat."
  unite: string
  quantite: number
  prix_unitaire: number
  confidence: "high" | "medium" | "low"
  source: "database" | "ai"
}

function SuggestionsModal({
  isOpen,
  onClose,
  divisionCode,
  divisionName,
  projectName,
  projectCategory,
  existingItems,
  allProjectPhases,
  onInsertItems,
}: {
  isOpen: boolean
  onClose: () => void
  divisionCode: string
  divisionName: string
  projectName: string
  projectCategory?: string
  existingItems: Array<{ description: string; type: string; code?: string }>
  allProjectPhases?: Array<{ nom: string; divisions: Array<{ code: string; nom: string; itemCount: number }> }>
  onInsertItems: (items: SuggestedItem[]) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSuggestions([])
      setSelectedItems(new Set())
      setHasGenerated(false)
      // Build a richer default prompt with full project context
      const phasesContext = (allProjectPhases || []).length > 0
        ? `\nPhases du projet:\n${allProjectPhases!.map(p =>
            `- ${p.nom}: ${p.divisions.map(d => `Div.${d.code} (${d.itemCount} items)`).join(", ")}`
          ).join("\n")}`
        : ""
      setPrompt(`Genere les items de ${divisionName || DIVISIONS_MASTERFORMAT[divisionCode] || "construction"} pour le projet "${projectName}" (categorie ${projectCategory || "B"}).${phasesContext}
Inclure pour cette division:
- Materiaux necessaires avec quantites realistes
- Main-d'oeuvre requise (taux CCQ)
- Items specifiques au type de projet et aux autres phases existantes`)
    }
  }, [isOpen, divisionCode, divisionName, projectName, projectCategory, allProjectPhases])

  const generateSuggestions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          divisionCode,
          divisionName,
          projectName,
          projectCategory: projectCategory || "B",
          existingItems,
          allProjectPhases,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.items || [])
        setSelectedItems(new Set(data.items?.map((_: SuggestedItem, i: number) => i) || []))
        setHasGenerated(true)
      }
    } catch (e) {
      console.error("[v0] Error generating suggestions:", e)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleItem = (idx: number) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(idx)) newSet.delete(idx)
    else newSet.add(idx)
    setSelectedItems(newSet)
  }

  const selectAll = () => setSelectedItems(new Set(suggestions.map((_, i) => i)))
  const deselectAll = () => setSelectedItems(new Set())

  const handleInsert = () => {
    const itemsToInsert = suggestions.filter((_, i) => selectedItems.has(i))
    onInsertItems(itemsToInsert)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="font-semibold text-gray-800">Suggestions pour {divisionCode} - {divisionName || DIVISIONS_MASTERFORMAT[divisionCode]}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Prompt de generation</label>
              <div className="relative">
                <button className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <span>Inserer variable</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
              placeholder="Decrivez les items a generer..."
            />
            <p className="text-xs text-gray-400 mt-1">Tapez $ pour inserer des variables contextuelles</p>
          </div>

          <button
            onClick={generateSuggestions}
            disabled={isLoading || !prompt.trim()}
            className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generation en cours...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generer les suggestions</>
            )}
          </button>

          {hasGenerated && suggestions.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Items suggeres ({suggestions.length})</span>
                <div className="flex gap-3 text-xs">
                  <button onClick={selectAll} className="text-blue-600 hover:text-blue-800">Tout selectionner</button>
                  <button onClick={deselectAll} className="text-gray-500 hover:text-gray-700">Tout deselectionner</button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleItem(idx)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedItems.has(idx) ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        selectedItems.has(idx) ? "border-purple-500 bg-purple-500" : "border-gray-300"
                      }`}>
                        {selectedItems.has(idx) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            item.type === "MO" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                          }`}>{item.type}</span>
                          <span className="text-xs text-gray-400">{item.code}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            item.confidence === "high" ? "bg-green-100 text-green-700" :
                            item.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{item.confidence === "high" ? "Haute confiance" : item.confidence === "medium" ? "Moyenne confiance" : "Basse confiance"}</span>
                        </div>
                        <div className="font-medium text-gray-800">{item.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Qte: {item.quantite} {item.unite} &middot; Prix: {item.prix_unitaire.toFixed(2)}$/unite
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Annuler
          </button>
          {hasGenerated && (
            <button
              onClick={handleInsert}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Inserer {selectedItems.size} items
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// AUTO-ORGANIZE MODAL
// ============================================================================
function AutoOrganizeModal({
  isOpen,
  onClose,
  divisionCode,
  divisionName,
  items,
  existingLists,
  onApplyOrganization,
}: {
  isOpen: boolean
  onClose: () => void
  divisionCode: string
  divisionName: string
  items: Item[]
  existingLists: TaskList[]
  onApplyOrganization: (result: { task_lists: TaskList[]; items: Item[] }) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<{ task_lists: TaskList[]; items: Item[] } | null>(null)

  const organizeItems = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/ai/auto-organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionCode,
          divisionName,
          items,
          existingLists: existingLists.map(l => ({ id: l.id, name: l.name })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
      }
    } catch (e) {
      console.error("[v0] Error auto-organizing:", e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (preview) {
      onApplyOrganization(preview)
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      setPreview(null)
      organizeItems()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold text-gray-800">Auto-organiser {divisionCode}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-gray-600">Analyse et organisation en cours...</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                L'IA a organise {items.length} items en {preview.task_lists.length} listes:
              </p>
              {preview.task_lists.map(list => {
                const listItems = preview.items.filter(i => i.task_list_id === list.id)
                return (
                  <div key={list.id} className="border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 font-medium flex items-center gap-2" style={{ backgroundColor: list.color + "20", borderLeft: `3px solid ${list.color}` }}>
                      <ListTodo className="h-4 w-4" style={{ color: list.color }} />
                      {list.name}
                      <span className="text-xs text-gray-500 ml-auto">{listItems.length} items</span>
                    </div>
                    <div className="px-3 py-2 space-y-1 text-sm">
                      {listItems.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-gray-600 truncate">• {item.description}</div>
                      ))}
                      {listItems.length > 3 && (
                        <div className="text-gray-400 text-xs">+ {listItems.length - 3} autres items</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-10">Erreur lors de l'organisation</p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Annuler
          </button>
          <button
            onClick={handleApply}
            disabled={!preview}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Appliquer
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DETAILS SHEET (editable with phase/division management + task lists)
// ============================================================================
function DetailsSheet({
  soumission,
  updateItem,
  updateItemFromPriceList,
  addItem,
  addItems,
  removeItem,
  addDivision,
  removeDivision,
  addPhase,
  removePhase,
  renamePhase,
  addTaskList,
  removeTaskList,
  updateDivisionItems,
  reorderItems,
  applySoumissionChange,
}: {
  soumission: Soumission
  updateItem: (phaseIdx: number, divIdx: number, itemIdx: number, field: "quantite" | "prix_unitaire" | "description" | "type" | "unite", value: string) => void
  updateItemFromPriceList: (phaseIdx: number, divIdx: number, itemIdx: number, priceItem: { material_name: string; unit: string; unit_price: number }) => void
  addItem: (phaseIdx: number, divIdx: number, taskListId?: string) => void
  addItems: (phaseIdx: number, divIdx: number, items: Array<Partial<Item>>) => void
  removeItem: (phaseIdx: number, divIdx: number, itemIdx: number) => void
  addDivision: (phaseIdx: number, divCode: string) => void
  removeDivision: (phaseIdx: number, divIdx: number) => void
  addPhase: () => void
  removePhase: (phaseIdx: number) => void
  renamePhase: (phaseIdx: number, field: "nom" | "code", value: string) => void
  addTaskList: (phaseIdx: number, divIdx: number, name: string) => void
  removeTaskList: (phaseIdx: number, divIdx: number, listId: string) => void
  updateDivisionItems: (phaseIdx: number, divIdx: number, items: Item[], taskLists: TaskList[]) => void
  reorderItems: (phaseIdx: number, divIdx: number, fromIdx: number, toIdx: number, targetListId?: string) => void
  applySoumissionChange: (fn: (prev: Soumission) => Soumission) => void
}) {
  const [addDivForPhase, setAddDivForPhase] = useState<number | null>(null)
  const [newDivCode, setNewDivCode] = useState("")
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set())
  const [suggestionsModal, setSuggestionsModal] = useState<{ phaseIdx: number; divIdx: number } | null>(null)
  const [organizeModal, setOrganizeModal] = useState<{ phaseIdx: number; divIdx: number } | null>(null)
  const [newListName, setNewListName] = useState("")
  const [addingListFor, setAddingListFor] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<{ phaseIdx: number; divIdx: number; itemIdx: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ phaseIdx: number; divIdx: number; itemIdx: number; position: "above" | "below" } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ phaseIdx: number; divIdx: number; itemIdx: number } | null>(null)
  // Multi-selection state: key = "phaseIdx-divIdx-itemId"
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set())
  const [moveTargetModal, setMoveTargetModal] = useState<false | "list">(false)

  // Per-phase available divisions (not global)
  const usedDivCodesPerPhase = useMemo(() => {
    return (soumission.phases || []).map(phase => {
      const codes = new Set<string>()
      for (const div of phase.divisions || []) codes.add(div.code)
      return codes
    })
  }, [soumission])

  const getAvailableDivisionsForPhase = useCallback((phaseIdx: number) => {
    const used = usedDivCodesPerPhase[phaseIdx] || new Set()
    return Object.entries(DIVISIONS_MASTERFORMAT)
      .filter(([code]) => !used.has(code))
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [usedDivCodesPerPhase])

  // Multi-select helpers
  const makeItemKey = (phaseIdx: number, divIdx: number, itemId: string | undefined, itemIdx: number) =>
    `${phaseIdx}-${divIdx}-${itemId || itemIdx}`

  const toggleItemSelection = (key: string) => {
    setSelectedItemKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const clearSelection = () => setSelectedItemKeys(new Set())

  // Bulk delete all selected items
  const bulkDeleteSelected = useCallback(() => {
    // Parse keys and collect (phaseIdx, divIdx, itemId) tuples
    const toDelete: { phaseIdx: number; divIdx: number; itemId: string }[] = []
    for (const key of selectedItemKeys) {
      const [pi, di, ...rest] = key.split("-")
      toDelete.push({ phaseIdx: Number(pi), divIdx: Number(di), itemId: rest.join("-") })
    }
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      // Group by phase+div
      const byDiv: Record<string, string[]> = {}
      for (const { phaseIdx, divIdx, itemId } of toDelete) {
        const k = `${phaseIdx}-${divIdx}`
        if (!byDiv[k]) byDiv[k] = []
        byDiv[k].push(itemId)
      }
      for (const [k, ids] of Object.entries(byDiv)) {
        const [pi, di] = k.split("-").map(Number)
        next.phases[pi].divisions[di].items = next.phases[pi].divisions[di].items.filter(
          item => !ids.includes(item.id || "")
        )
      }
      return next
    })
    clearSelection()
  }, [selectedItemKeys, applySoumissionChange])

  // Bulk move items to a specific task list
  const bulkMoveToList = useCallback((targetListId: string | undefined) => {
    const toMove: { phaseIdx: number; divIdx: number; itemId: string }[] = []
    for (const key of selectedItemKeys) {
      const [pi, di, ...rest] = key.split("-")
      toMove.push({ phaseIdx: Number(pi), divIdx: Number(di), itemId: rest.join("-") })
    }
    applySoumissionChange(prev => {
      const next = deepClone(prev)
      const byDiv: Record<string, string[]> = {}
      for (const { phaseIdx, divIdx, itemId } of toMove) {
        const k = `${phaseIdx}-${divIdx}`
        if (!byDiv[k]) byDiv[k] = []
        byDiv[k].push(itemId)
      }
      for (const [k, ids] of Object.entries(byDiv)) {
        const [pi, di] = k.split("-").map(Number)
        next.phases[pi].divisions[di].items.forEach(item => {
          if (ids.includes(item.id || "")) item.task_list_id = targetListId
        })
      }
      return next
    })
    clearSelection()
  }, [selectedItemKeys, applySoumissionChange])

  const toggleListCollapse = (listId: string) => {
    const newSet = new Set(collapsedLists)
    if (newSet.has(listId)) newSet.delete(listId)
    else newSet.add(listId)
    setCollapsedLists(newSet)
  }

  // Group items by task_list_id
  const groupItemsByList = (items: Item[], taskLists: TaskList[] = []) => {
    const groups: Map<string | undefined, Item[]> = new Map()
    const sortedLists = [...taskLists].sort((a, b) => a.order - b.order)
    
    // Initialize groups for all lists
    for (const list of sortedLists) {
      groups.set(list.id, [])
    }
    groups.set(undefined, []) // Items without a list

    // Assign items to groups
    for (const item of items || []) {
      const key = item.task_list_id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }

    return { groups, sortedLists }
  }

  const handleDragStart = (phaseIdx: number, divIdx: number, itemIdx: number) => {
    setDraggedItem({ phaseIdx, divIdx, itemIdx })
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, phaseIdx: number, divIdx: number, itemIdx: number) => {
    e.preventDefault()
    if (!draggedItem) return
    // Determine if dragging over top or bottom half of row
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position: "above" | "below" = e.clientY < midY ? "above" : "below"
    setDropTarget({ phaseIdx, divIdx, itemIdx, position })
  }

  const handleDragLeave = () => {
    // Delay clear to avoid flicker between rows
    // Do nothing - dropTarget will be overridden by the next row's onDragOver
  }

  const handleDrop = (targetPhaseIdx: number, targetDivIdx: number, targetItemIdx: number, targetListId?: string) => {
    if (!draggedItem || !dropTarget) {
      setDraggedItem(null)
      setDropTarget(null)
      return
    }
    if (draggedItem.phaseIdx === targetPhaseIdx && draggedItem.divIdx === targetDivIdx) {
      const insertAt = dropTarget.position === "below" ? targetItemIdx + 1 : targetItemIdx
      reorderItems(targetPhaseIdx, targetDivIdx, draggedItem.itemIdx, insertAt, targetListId)
    }
    setDraggedItem(null)
    setDropTarget(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDropTarget(null)
  }

  return (
    <div className="space-y-1 min-w-0" onClick={() => setContextMenu(null)}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-orange-500" />
          <span className="text-xs text-gray-500">Cliquez sur une cellule pour la modifier. Glissez les items par la poignee a gauche.</span>
        </div>
        <button
          onClick={addPhase}
          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-md transition-colors font-medium"
        >
          <Plus className="h-3 w-3" />
          Ajouter phase
        </button>
      </div>

      {/* Bulk action toolbar */}
      {selectedItemKeys.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
          <CheckSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">{selectedItemKeys.size} item{selectedItemKeys.size > 1 ? "s" : ""} selectionne{selectedItemKeys.size > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2 ml-auto">
            {/* Move to list dropdown */}
            {(soumission.phases || []).some(p => p.divisions.some(d => (d.task_lists || []).length > 0)) && (
              <div className="relative">
                <select
                  className="text-xs border border-blue-300 rounded px-2 py-1 bg-white text-blue-700"
                  onChange={e => {
                    if (e.target.value) {
                      bulkMoveToList(e.target.value === "__none__" ? undefined : e.target.value)
                      e.target.value = ""
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Deplacer vers une liste...</option>
                  <option value="__none__">Sans liste</option>
                  {(soumission.phases || []).flatMap((p, pi) =>
                    p.divisions.flatMap((d, di) =>
                      (d.task_lists || []).map(list => (
                        <option key={list.id} value={list.id}>
                          {p.nom} › Div.{d.code} › {list.name}
                        </option>
                      ))
                    )
                  )}
                </select>
              </div>
            )}
            <button
              onClick={bulkDeleteSelected}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer ({selectedItemKeys.size})
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {suggestionsModal && (
        <SuggestionsModal
          isOpen={true}
          onClose={() => setSuggestionsModal(null)}
          divisionCode={soumission.phases[suggestionsModal.phaseIdx]?.divisions[suggestionsModal.divIdx]?.code || ""}
          divisionName={soumission.phases[suggestionsModal.phaseIdx]?.divisions[suggestionsModal.divIdx]?.nom || ""}
          projectName={soumission.projet?.nom || "Projet"}
          projectCategory={soumission.projet?.categorie || "B"}
          existingItems={(soumission.phases[suggestionsModal.phaseIdx]?.divisions[suggestionsModal.divIdx]?.items || []).map(i => ({
            description: i.description,
            type: i.type,
            code: i.code,
          }))}
          allProjectPhases={(soumission.phases || []).map(p => ({
            nom: p.nom,
            divisions: (p.divisions || []).map(d => ({
              code: d.code,
              nom: d.nom,
              itemCount: d.items.length,
            }))
          }))}
          onInsertItems={(items) => {
            addItems(suggestionsModal.phaseIdx, suggestionsModal.divIdx, items.map(i => ({
              code: i.code,
              description: i.description,
              type: i.type,
              unite: i.unite,
              quantite: i.quantite,
              prix_unitaire: i.prix_unitaire,
            })))
          }}
        />
      )}

      {organizeModal && (
        <AutoOrganizeModal
          isOpen={true}
          onClose={() => setOrganizeModal(null)}
          divisionCode={soumission.phases[organizeModal.phaseIdx]?.divisions[organizeModal.divIdx]?.code || ""}
          divisionName={soumission.phases[organizeModal.phaseIdx]?.divisions[organizeModal.divIdx]?.nom || ""}
          items={soumission.phases[organizeModal.phaseIdx]?.divisions[organizeModal.divIdx]?.items || []}
          existingLists={soumission.phases[organizeModal.phaseIdx]?.divisions[organizeModal.divIdx]?.task_lists || []}
          onApplyOrganization={(result) => {
            updateDivisionItems(organizeModal.phaseIdx, organizeModal.divIdx, result.items, result.task_lists as TaskList[])
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: "800px" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#2F5496] text-white">
              <th className="px-1 py-2 text-center font-medium" style={{ width: "24px" }}></th>
              <th className="px-1 py-2 text-center font-medium" style={{ width: "32px" }}></th>
              <th className="px-2 py-2 text-left font-medium" style={{ width: "70px" }}>Code</th>
              <th className="px-2 py-2 text-left font-medium" style={{ minWidth: "180px" }}>Description</th>
              <th className="px-2 py-2 text-center font-medium" style={{ width: "65px" }}>Type</th>
              <th className="px-2 py-2 text-center font-medium" style={{ width: "50px" }}>Unite</th>
              <th className="px-2 py-2 text-right font-medium" style={{ width: "55px" }}>Qte</th>
              <th className="px-2 py-2 text-right font-medium" style={{ width: "80px" }}>Prix un.</th>
              <th className="px-2 py-2 text-right font-medium" style={{ width: "90px" }}>Total</th>
              <th className="px-1 py-2 text-center font-medium" style={{ width: "32px" }}></th>
            </tr>
          </thead>
          {(soumission.phases || []).map((phase, phaseIdx) => (
            <React.Fragment key={phase.code}>
              <tbody>
                <tr className="bg-[#1F3864]">
                  <td colSpan={10} className="px-3 py-2 border border-gray-400">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          className="bg-transparent text-white font-bold text-xs border-none outline-none w-16 placeholder-white/50"
                          value={phase.code}
                          onChange={e => renamePhase(phaseIdx, "code", e.target.value)}
                        />
                        <span className="text-white/40">{"--"}</span>
                        <input
                          className="bg-transparent text-white font-bold text-sm border-none outline-none flex-1 placeholder-white/50"
                          value={phase.nom}
                          onChange={e => renamePhase(phaseIdx, "nom", e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAddDivForPhase(addDivForPhase === phaseIdx ? null : phaseIdx)}
                          className="flex items-center gap-1 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Division
                        </button>
                        {soumission.phases.length > 1 && (
                          <button
                            onClick={() => removePhase(phaseIdx)}
                            className="p-1 text-red-300 hover:text-red-100 hover:bg-red-900/30 rounded transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {addDivForPhase === phaseIdx && (
                      <div className="mt-2 flex items-center gap-2 bg-white/10 rounded px-2 py-1.5">
                        <select
                          value={newDivCode}
                          onChange={e => setNewDivCode(e.target.value)}
                          className="text-xs bg-white text-gray-800 border border-gray-300 rounded px-2 py-1 flex-1"
                        >
                          <option value="">Choisir une division...</option>
                          {getAvailableDivisionsForPhase(phaseIdx).map(([code, nom]) => (
                            <option key={code} value={code}>{`${code} - ${nom}`}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { if (newDivCode) { addDivision(phaseIdx, newDivCode); setNewDivCode(""); setAddDivForPhase(null) } }}
                          disabled={!newDivCode}
                          className="flex items-center gap-1 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-2 py-1 rounded"
                        >
                          <Check className="h-3 w-3" />
                          Ajouter
                        </button>
                        <button onClick={() => { setAddDivForPhase(null); setNewDivCode("") }} className="text-xs text-white/70 hover:text-white px-1 py-1">
                          Annuler
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>

              {(phase.divisions || []).map((division, divIdx) => {
                const divNom = DIVISIONS_MASTERFORMAT[division.code] || division.nom
                const { groups, sortedLists } = groupItemsByList(division.items, division.task_lists)
                let divTotal = 0
                let divMO = 0
                let divMat = 0
                for (const item of division.items || []) {
                  const t = (item.quantite || 0) * (item.prix_unitaire || 0)
                  divTotal += t
                  if (item.type === "MO") divMO += t
                  else divMat += t
                }
                const divKey = `${phaseIdx}-${divIdx}`

                const renderItemRow = (item: Item, itemIdx: number, listId?: string) => {
                  const actualIdx = (division.items || []).findIndex(i => i === item)
                  const total = (item.quantite || 0) * (item.prix_unitaire || 0)
                  const isDragging = draggedItem?.phaseIdx === phaseIdx && draggedItem?.divIdx === divIdx && draggedItem?.itemIdx === actualIdx
                  const isDropTargetAbove = dropTarget?.phaseIdx === phaseIdx && dropTarget?.divIdx === divIdx && dropTarget?.itemIdx === actualIdx && dropTarget?.position === "above"
                  const isDropTargetBelow = dropTarget?.phaseIdx === phaseIdx && dropTarget?.divIdx === divIdx && dropTarget?.itemIdx === actualIdx && dropTarget?.position === "below"
                  const isContextOpen = contextMenu?.phaseIdx === phaseIdx && contextMenu?.divIdx === divIdx && contextMenu?.itemIdx === actualIdx
                  const itemKey = makeItemKey(phaseIdx, divIdx, item.id, actualIdx)
                  const isItemSelected = selectedItemKeys.has(itemKey)

                  return (
                    <React.Fragment key={item.id || actualIdx}>
                      {/* Drop indicator line - ABOVE */}
                      {isDropTargetAbove && (
                        <tr className="pointer-events-none">
                          <td colSpan={10} className="p-0">
                            <div className="h-0.5 bg-blue-500 mx-2 rounded-full shadow-sm" style={{ boxShadow: "0 0 4px rgba(59,130,246,0.8)" }} />
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`group transition-colors ${isDragging ? "opacity-30 bg-blue-50" : isItemSelected ? "bg-blue-50 hover:bg-blue-100" : "bg-white hover:bg-orange-50/50"}`}
                        draggable
                        onDragStart={() => handleDragStart(phaseIdx, divIdx, actualIdx)}
                        onDragOver={e => handleDragOver(e, phaseIdx, divIdx, actualIdx)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(phaseIdx, divIdx, actualIdx, listId)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="px-1 py-1 border border-gray-200 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 cursor-pointer"
                            checked={isItemSelected}
                            onChange={() => toggleItemSelection(itemKey)}
                            onClick={e => e.stopPropagation()}
                          />
                        </td>
                        {/* Grip handle - drag only initiated from here */}
                        <td
                          className="px-1 py-1 border border-gray-200 text-center cursor-grab active:cursor-grabbing select-none"
                          title="Glisser pour deplacer"
                        >
                          <GripVertical className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </td>
                        <td className="px-2 py-1 border border-gray-200 text-xs text-gray-600">{item.code || ""}</td>
                        <td className="px-2 py-1 border border-gray-200">
                          <SearchableDescriptionCell
                            value={item.description}
                            onChange={val => updateItem(phaseIdx, divIdx, actualIdx, "description", val)}
                            onSelectPriceItem={priceItem => updateItemFromPriceList(phaseIdx, divIdx, actualIdx, priceItem)}
                          />
                        </td>
                        <td className="px-1 py-1 border border-gray-200 text-center">
                          <select
                            value={item.type || "Mat."}
                            onChange={e => updateItem(phaseIdx, divIdx, actualIdx, "type", e.target.value)}
                            className={`w-full px-1 py-0.5 text-xs rounded border-0 cursor-pointer focus:ring-1 focus:ring-orange-300 ${
                              item.type === "MO" ? "bg-amber-100 text-amber-700" :
                              item.type === "S-T" ? "bg-purple-100 text-purple-700" :
                              item.type === "Loc." ? "bg-green-100 text-green-700" :
                              "bg-blue-100 text-blue-700"
                            }`}
                          >
                            <option value="Mat.">Mat.</option>
                            <option value="MO">MO</option>
                            <option value="S-T">S-T</option>
                            <option value="Loc.">Loc.</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 border border-gray-200 text-center text-sm text-gray-600">
                          <EditableCell value={item.unite} onChange={val => updateItem(phaseIdx, divIdx, actualIdx, "unite", val)} align="center" />
                        </td>
                        <td className="px-2 py-1 border border-gray-200 text-right">
                          <EditableCell value={item.quantite} onChange={val => updateItem(phaseIdx, divIdx, actualIdx, "quantite", val)} type="number" format="quantity" align="right" />
                        </td>
                        <td className="px-2 py-1 border border-gray-200 text-right">
                          <EditableCell value={item.prix_unitaire} onChange={val => updateItem(phaseIdx, divIdx, actualIdx, "prix_unitaire", val)} type="number" format="currency" align="right" />
                        </td>
                        <td className="px-3 py-1.5 border border-gray-200 text-right font-medium text-gray-700">{fmt(total)}</td>
                        {/* 3-dot context menu */}
                        <td className="px-1 py-1 border border-gray-200 text-center relative">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setContextMenu(isContextOpen ? null : { phaseIdx, divIdx, itemIdx: actualIdx })
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                          {isContextOpen && (
                            <div
                              className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44 text-left"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => {
                                  addItem(phaseIdx, divIdx, listId)
                                  // Move the new item above current: swap last inserted with actualIdx
                                  const newIdx = (division.items || []).length
                                  reorderItems(phaseIdx, divIdx, newIdx, actualIdx, listId)
                                  setContextMenu(null)
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 text-gray-400" />
                                Ajouter au-dessus
                              </button>
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => {
                                  addItem(phaseIdx, divIdx, listId)
                                  setContextMenu(null)
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 text-gray-400" />
                                Ajouter en-dessous
                              </button>
                              <div className="border-t border-gray-100 my-1" />
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  removeItem(phaseIdx, divIdx, actualIdx)
                                  setContextMenu(null)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Drop indicator line - BELOW */}
                      {isDropTargetBelow && (
                        <tr className="pointer-events-none">
                          <td colSpan={10} className="p-0">
                            <div className="h-0.5 bg-blue-500 mx-2 rounded-full" style={{ boxShadow: "0 0 4px rgba(59,130,246,0.8)" }} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                }

                return (
                  <tbody key={divKey}>
                    {/* Division header */}
                    <tr className="bg-gray-100">
                      <td colSpan={10} className="px-3 py-2 border border-gray-300">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                            <span className="font-bold text-gray-800">Division {division.code}</span>
                            <span className="text-gray-600">{divNom}</span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{(division.items || []).length} articles</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-amber-600">MO {fmt(divMO)}</span>
                            <span className="text-blue-600">Mat./Loc. {fmt(divMat)}</span>
                            <span className="font-bold">Total {fmt(divTotal)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Task lists */}
                    {sortedLists.map(list => {
                      const listItems = groups.get(list.id) || []
                      const listTotal = listItems.reduce((sum, i) => sum + (i.quantite || 0) * (i.prix_unitaire || 0), 0)
                      const isCollapsed = collapsedLists.has(list.id)
                      
                      return (
                        <React.Fragment key={list.id}>
                          <tr className="bg-white border-l-4" style={{ borderLeftColor: list.color }}>
                            <td className="px-1 py-1.5 border border-gray-200">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 cursor-pointer"
                                checked={listItems.length > 0 && listItems.every(item =>
                                  selectedItemKeys.has(makeItemKey(phaseIdx, divIdx, item.id, (division.items || []).findIndex(i => i === item)))
                                )}
                                onChange={() => {
                                  const keys = listItems.map(item =>
                                    makeItemKey(phaseIdx, divIdx, item.id, (division.items || []).findIndex(i => i === item))
                                  )
                                  const allSelected = keys.every(k => selectedItemKeys.has(k))
                                  setSelectedItemKeys(prev => {
                                    const next = new Set(prev)
                                    if (allSelected) keys.forEach(k => next.delete(k))
                                    else keys.forEach(k => next.add(k))
                                    return next
                                  })
                                }}
                              />
                            </td>
                            <td
                              className="px-1 py-1.5 border border-gray-200 cursor-pointer"
                              onClick={() => toggleListCollapse(list.id)}
                            >
                              {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                            </td>
                            <td colSpan={2} className="px-2 py-1.5 border border-gray-200">
                              <div className="flex items-center gap-2">
                                <ListTodo className="h-4 w-4" style={{ color: list.color }} />
                                <span className="font-medium" style={{ color: list.color }}>{list.name}</span>
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{listItems.length}</span>
                              </div>
                            </td>
                            <td colSpan={4} className="border border-gray-200"></td>
                            <td className="px-3 py-1.5 border border-gray-200 text-right font-medium">{fmt(listTotal)}</td>
                            <td className="px-1 py-1 border border-gray-200 text-center">
                              <button
                                onClick={() => removeTaskList(phaseIdx, divIdx, list.id)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded transition-all"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                          {!isCollapsed && listItems.map((item, i) => renderItemRow(item, i, list.id))}
                        </React.Fragment>
                      )
                    })}

                    {/* Items without a list */}
                    {(groups.get(undefined) || []).map((item, i) => renderItemRow(item, i))}

                    {/* Subtotal */}
                    <tr className="bg-[#D6DCE5] font-bold">
                      <td colSpan={2} className="px-3 py-1.5 border border-gray-300" />
                      <td colSpan={6} className="px-3 py-1.5 border border-gray-300">{`Sous-total Div. ${division.code}`}</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right">{fmt(divTotal)}</td>
                      <td className="border border-gray-300" />
                    </tr>

                    {/* Action buttons */}
                    <tr className="bg-white">
                      <td colSpan={10} className="px-3 py-2 border border-gray-200">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => addItem(phaseIdx, divIdx)}
                            className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800"
                          >
                            <Plus className="h-4 w-4" />
                            Ajouter Tache
                          </button>
                          <button
                            onClick={() => setAddingListFor(addingListFor === divKey ? null : divKey)}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                          >
                            <ListTodo className="h-4 w-4" />
                            Ajouter une liste de taches
                          </button>
                          <button
                            onClick={() => setSuggestionsModal({ phaseIdx, divIdx })}
                            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                          >
                            <Sparkles className="h-4 w-4" />
                            Suggestions
                          </button>
                          <button
                            onClick={() => setOrganizeModal({ phaseIdx, divIdx })}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                            Auto-organiser
                          </button>
                          <button
                            onClick={() => removeDivision(phaseIdx, divIdx)}
                            className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {addingListFor === divKey && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={newListName}
                              onChange={e => setNewListName(e.target.value)}
                              placeholder="Nom de la liste..."
                              className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                if (newListName.trim()) {
                                  addTaskList(phaseIdx, divIdx, newListName.trim())
                                  setNewListName("")
                                  setAddingListFor(null)
                                }
                              }}
                              disabled={!newListName.trim()}
                              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-sm"
                            >
                              Ajouter
                            </button>
                            <button
                              onClick={() => { setAddingListFor(null); setNewListName("") }}
                              className="text-sm text-gray-500 hover:text-gray-700"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                )
              })}
            </React.Fragment>
          ))}
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// DIVISIONS SHEET
// ============================================================================
function DivisionsSheet({
  soumission,
  totaux,
}: { soumission: Soumission; totaux: ReturnType<typeof calculerTotauxSoumission> }) {
  const divisionTotals: Record<string, { nom: string; mo: number; mat: number }> = {}
  for (const phase of soumission.phases) {
    for (const division of phase.divisions) {
      if (!divisionTotals[division.code]) {
        divisionTotals[division.code] = { nom: DIVISIONS_MASTERFORMAT[division.code] || division.nom, mo: 0, mat: 0 }
      }
      for (const item of division.items) {
        const total = item.quantite * item.prix_unitaire
        if (item.type === "MO") divisionTotals[division.code].mo += total
        else divisionTotals[division.code].mat += total
      }
    }
  }

  const sorted = Object.entries(divisionTotals).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#2F5496] text-white">
            <th className="px-3 py-2 text-left font-medium">Division</th>
            <th className="px-3 py-2 text-left font-medium">Intitule</th>
            <th className="px-3 py-2 text-right font-medium">MO $</th>
            <th className="px-3 py-2 text-right font-medium">{"Mat./Loc. $"}</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([code, div], i) => (
            <tr key={code} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2 border border-gray-200">{code}</td>
              <td className="px-3 py-2 border border-gray-200">{div.nom}</td>
              <td className="px-3 py-2 text-right border border-gray-200">{fmt(div.mo)}</td>
              <td className="px-3 py-2 text-right border border-gray-200">{fmt(div.mat)}</td>
              <td className="px-3 py-2 text-right border border-gray-200 font-medium">{fmt(div.mo + div.mat)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#D6DCE5] font-bold">
            <td className="px-3 py-2 border border-gray-300" />
            <td className="px-3 py-2 border border-gray-300">TOTAL</td>
            <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalMO)}</td>
            <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalMat)}</td>
            <td className="px-3 py-2 text-right border border-gray-300">{fmt(totaux.totalCD)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ============================================================================
// HYPOTHESES SHEET
// ============================================================================
function HypothesesSheet({ soumission }: { soumission: Soumission }) {
  const tauxDefaut = { charpentier: 86, cimentier: 86, platrier: 82.5, peintre: 75, plombier: 100, electricien: 104, carreleur: 100.75, operateur: 95 }
  const taux = soumission.taux_horaires || tauxDefaut

  const rows = [
    ...(soumission.hypotheses || []),
    { element: "Type soumission", valeur: soumission.projet?.categorie || "", unite: "", source: "RBQ", notes: `Imprevus ${Math.round((soumission.parametres?.taux_imprevu ?? 0.18) * 100)}%` },
    { element: "Duree estimee", valeur: String(soumission.projet.duree_jours), unite: "jours", source: "Estimation", notes: "" },
    ...Object.entries(taux)
      .filter(([, v]) => v)
      .map(([k, v]) => ({
        element: `Taux ${k.charAt(0).toUpperCase() + k.slice(1)}`,
        valeur: String(v),
        unite: "$/h",
        source: "CCQ",
        notes: "",
      })),
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#2F5496] text-white">
            <th className="px-3 py-2 text-left font-medium">Element</th>
            <th className="px-3 py-2 text-left font-medium">Valeur</th>
            <th className="px-3 py-2 text-left font-medium">Unite</th>
            <th className="px-3 py-2 text-left font-medium">Source</th>
            <th className="px-3 py-2 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2 border border-gray-200">{row.element}</td>
              <td className="px-3 py-2 border border-gray-200">{row.valeur}</td>
              <td className="px-3 py-2 border border-gray-200">{row.unite || ""}</td>
              <td className="px-3 py-2 border border-gray-200">{row.source}</td>
              <td className="px-3 py-2 border border-gray-200">{row.notes || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


// ============================================================================
// INCLUSIONS SHEET (editable)
// ============================================================================
function InclusionsSheet({
  soumission,
  addInclusion,
  removeInclusion,
  updateInclusion,
  addExclusion,
  removeExclusion,
  updateExclusion,
  onBulkUpdate,
}: {
  soumission: Soumission
  addInclusion: (text: string) => void
  removeInclusion: (idx: number) => void
  updateInclusion: (idx: number, text: string) => void
  addExclusion: (text: string) => void
  removeExclusion: (idx: number) => void
  updateExclusion: (idx: number, text: string) => void
  onBulkUpdate?: (inclusions: string[], exclusions: string[]) => void
}) {
  const inclusions = soumission.inclusions || []
  const exclusions = soumission.exclusions || []
  const [isGenerating, setIsGenerating] = useState(false)

  const generateInclusionsExclusionsAI = async () => {
    setIsGenerating(true)
    try {
      const divisionsSummary = (soumission.phases || []).flatMap(phase =>
        (phase.divisions || []).map(div => ({
          code: div.code,
          nom: div.nom,
          items: div.items.map(it => ({ description: it.description, type: it.type })).slice(0, 15),
        }))
      )

      const response = await fetch("/api/ai/generate-inclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: soumission.projet.nom,
          portee_travaux: (soumission.projet as any).portee_travaux || "",
          divisions: divisionsSummary,
          existingInclusions: inclusions,
          existingExclusions: exclusions,
        }),
      })

      if (!response.ok) throw new Error("Erreur generation")
      const data = await response.json()
      
      if (data.inclusions && data.exclusions && onBulkUpdate) {
        onBulkUpdate(data.inclusions, data.exclusions)
      }
    } catch (error) {
      console.error("Erreur generation inclusions/exclusions:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* AI Generate button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Gestion des inclusions et exclusions</h3>
        <Button
          onClick={generateInclusionsExclusionsAI}
          disabled={isGenerating}
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Generation...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1" />
              Generer par AI
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
      {/* Inclusions column */}
      <div>
        <div className="text-sm font-bold text-green-700 bg-green-50 px-3 py-2 rounded-t border border-green-200 border-b-0">INCLUS</div>
        <div className="border border-green-200 rounded-b divide-y divide-green-100">
          {inclusions.map((item, i) => (
            <div key={i} className="group flex items-center gap-2 px-3 py-2 hover:bg-green-50/50 transition-colors">
              <input
                className="flex-1 text-sm text-green-700 bg-transparent border-none outline-none focus:ring-1 focus:ring-green-300 rounded px-1 py-0.5"
                value={item}
                onChange={e => updateInclusion(i, e.target.value)}
              />
              <button
                onClick={() => removeInclusion(i)}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex-shrink-0"
                title="Supprimer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {inclusions.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-gray-400 italic">Aucune inclusion</div>
          )}
        </div>
        <button
          onClick={() => addInclusion("Nouvelle inclusion")}
          className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded transition-colors font-medium"
        >
          <Plus className="h-3 w-3" />
          Ajouter inclusion
        </button>
      </div>

      {/* Exclusions column */}
      <div>
        <div className="text-sm font-bold text-red-700 bg-red-50 px-3 py-2 rounded-t border border-red-200 border-b-0">EXCLUS</div>
        <div className="border border-red-200 rounded-b divide-y divide-red-100">
          {exclusions.map((item, i) => (
            <div key={i} className="group flex items-center gap-2 px-3 py-2 hover:bg-red-50/50 transition-colors">
              <input
                className="flex-1 text-sm text-red-700 bg-transparent border-none outline-none focus:ring-1 focus:ring-red-300 rounded px-1 py-0.5"
                value={item}
                onChange={e => updateExclusion(i, e.target.value)}
              />
              <button
                onClick={() => removeExclusion(i)}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex-shrink-0"
                title="Supprimer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {exclusions.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-gray-400 italic">Aucune exclusion</div>
          )}
        </div>
        <button
          onClick={() => addExclusion("Nouvelle exclusion")}
          className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors font-medium"
        >
          <Plus className="h-3 w-3" />
          Ajouter exclusion
        </button>
      </div>
      </div>
    </div>
  )
}

// ============================================================================
// ECHEANCIER SHEET (schedule generator)
// ============================================================================
interface EcheancierItem {
  id: string
  tache: string
  division?: string
  duree_jours: number
  date_debut: string
  date_fin: string
  predecesseur?: string
  responsable?: string
}

function EcheancierSheet({
  soumission,
  onEcheancierChange,
}: {
  soumission: Soumission
  onEcheancierChange: (echeancier: EcheancierItem[]) => void
}) {
  const [dateDebut, setDateDebut] = useState(() => {
    const today = new Date()
    today.setDate(today.getDate() + 7) // Default: 1 week from now
    return today.toISOString().split("T")[0]
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [echeancier, setEcheancier] = useState<EcheancierItem[]>((soumission as any).echeancier || [])

  const generateEcheancier = async () => {
    setIsGenerating(true)
    try {
      // Build detailed divisions summary for AI including task lists and items
      const divisionsSummary = (soumission.phases || []).flatMap(phase =>
        (phase.divisions || []).map(div => {
          const taskLists = (div as any).task_lists || []
          const sortedLists = [...taskLists].sort((a: any, b: any) => a.order - b.order)
          
          // Group items by task list
          const itemsByList: Record<string, any[]> = {}
          for (const list of sortedLists) {
            itemsByList[list.id] = []
          }
          itemsByList["_ungrouped"] = []
          
          for (const item of div.items || []) {
            const listId = (item as any).task_list_id || "_ungrouped"
            if (!itemsByList[listId]) itemsByList[listId] = []
            itemsByList[listId].push({
              description: item.description,
              type: item.type,
              heures: item.type === "MO" ? item.quantite : 0,
            })
          }

          // Build task lists with their items
          const listesDetaillees = sortedLists.map((list: any) => ({
            nom: list.name,
            items: itemsByList[list.id] || [],
            heures_mo: (itemsByList[list.id] || []).reduce((s: number, it: any) => s + (it.heures || 0), 0),
          }))

          const totalHeures = div.items.filter(it => it.type === "MO").reduce((s, it) => s + it.quantite, 0)

          return {
            code: div.code,
            nom: div.nom,
            heures_mo: totalHeures,
            nb_items: div.items.length,
            listes: listesDetaillees,
            items_sans_liste: itemsByList["_ungrouped"] || [],
          }
        })
      )

      const response = await fetch("/api/ai/generate-echeancier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: soumission.projet.nom,
          client: soumission.projet.client,
          adresse: soumission.projet.adresse,
          dateDebut,
          divisions: divisionsSummary,
          portee_travaux: (soumission.projet as any).portee_travaux || "",
        }),
      })

      if (!response.ok) throw new Error("Erreur generation")
      const data = await response.json()
      
      if (data.echeancier) {
        setEcheancier(data.echeancier)
        onEcheancierChange(data.echeancier)
      }
    } catch (error) {
      console.error("Erreur generation echeancier:", error)
      // Fallback: generate simple schedule based on divisions
      const fallbackSchedule = generateFallbackSchedule()
      setEcheancier(fallbackSchedule)
      onEcheancierChange(fallbackSchedule)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateFallbackSchedule = (): EcheancierItem[] => {
    const items: EcheancierItem[] = []
    let currentDate = new Date(dateDebut)
    let itemId = 1

    for (const phase of soumission.phases || []) {
      for (const division of phase.divisions || []) {
        const totalHeures = division.items.filter(it => it.type === "MO").reduce((s, it) => s + it.quantite, 0)
        const dureeJours = Math.max(1, Math.ceil(totalHeures / 8)) // 8h per day

        const dateDebutStr = currentDate.toISOString().split("T")[0]
        currentDate.setDate(currentDate.getDate() + dureeJours)
        const dateFinStr = currentDate.toISOString().split("T")[0]

        items.push({
          id: `ECH-${itemId++}`,
          tache: division.nom || `Division ${division.code}`,
          division: division.code,
          duree_jours: dureeJours,
          date_debut: dateDebutStr,
          date_fin: dateFinStr,
          responsable: "",
        })

        // Add 1 day gap between divisions
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
    return items
  }

  const updateItem = (idx: number, field: keyof EcheancierItem, value: any) => {
    const updated = [...echeancier]
    updated[idx] = { ...updated[idx], [field]: value }
    
    // Recalculate date_fin if duree or date_debut changed
    if (field === "duree_jours" || field === "date_debut") {
      const startDate = new Date(updated[idx].date_debut)
      startDate.setDate(startDate.getDate() + updated[idx].duree_jours)
      updated[idx].date_fin = startDate.toISOString().split("T")[0]
    }
    
    setEcheancier(updated)
    onEcheancierChange(updated)
  }

  const removeItem = (idx: number) => {
    const updated = echeancier.filter((_, i) => i !== idx)
    setEcheancier(updated)
    onEcheancierChange(updated)
  }

  const addItem = () => {
    const lastDate = echeancier.length > 0 ? echeancier[echeancier.length - 1].date_fin : dateDebut
    const newItem: EcheancierItem = {
      id: `ECH-${echeancier.length + 1}`,
      tache: "Nouvelle tache",
      duree_jours: 1,
      date_debut: lastDate,
      date_fin: lastDate,
    }
    const updated = [...echeancier, newItem]
    setEcheancier(updated)
    onEcheancierChange(updated)
  }

  // Calculate total duration
  const totalJours = echeancier.reduce((s, it) => s + it.duree_jours, 0)
  const dateFinProjet = echeancier.length > 0 ? echeancier[echeancier.length - 1].date_fin : dateDebut

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-orange-600">Echeancier preliminaire</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Date debut:</label>
            <input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-400 focus:outline-none"
            />
          </div>
          <Button
            onClick={generateEcheancier}
            disabled={isGenerating}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generation...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generer par AI
              </>
            )}
          </Button>
        </div>
      </div>

      {echeancier.length > 0 ? (
        <>
          {/* Summary */}
          <div className="flex gap-4 p-3 bg-gray-50 rounded-lg text-sm">
            <div><span className="text-gray-500">Duree totale:</span> <span className="font-semibold">{totalJours} jours</span></div>
            <div><span className="text-gray-500">Date debut:</span> <span className="font-semibold">{dateDebut}</span></div>
            <div><span className="text-gray-500">Date fin prevue:</span> <span className="font-semibold">{dateFinProjet}</span></div>
          </div>

          {/* Schedule table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2F5496] text-white">
                  <th className="px-2 py-2 text-left font-medium" style={{ width: "60px" }}>ID</th>
                  <th className="px-2 py-2 text-left font-medium">Tache</th>
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "80px" }}>Division</th>
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "80px" }}>Duree (j)</th>
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "120px" }}>Date debut</th>
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "120px" }}>Date fin</th>
                  <th className="px-2 py-2 text-left font-medium" style={{ width: "120px" }}>Responsable</th>
                  <th className="px-2 py-2 text-center font-medium" style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {echeancier.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{item.id}</td>
                    <td className="px-2 py-1 border border-gray-200">
                      <input
                        type="text"
                        value={item.tache}
                        onChange={e => updateItem(idx, "tache", e.target.value)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent focus:ring-1 focus:ring-orange-300 rounded"
                      />
                    </td>
                    <td className="px-2 py-1 border border-gray-200 text-center text-gray-600">{item.division || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200">
                      <input
                        type="number"
                        value={item.duree_jours}
                        onChange={e => updateItem(idx, "duree_jours", parseInt(e.target.value) || 1)}
                        min={1}
                        className="w-full px-1 py-0.5 text-center border-0 bg-transparent focus:ring-1 focus:ring-orange-300 rounded"
                      />
                    </td>
                    <td className="px-2 py-1 border border-gray-200">
                      <input
                        type="date"
                        value={item.date_debut}
                        onChange={e => updateItem(idx, "date_debut", e.target.value)}
                        className="w-full px-1 py-0.5 text-center border-0 bg-transparent focus:ring-1 focus:ring-orange-300 rounded text-xs"
                      />
                    </td>
                    <td className="px-2 py-1 border border-gray-200 text-center text-gray-600">{item.date_fin}</td>
                    <td className="px-2 py-1 border border-gray-200">
                      <input
                        type="text"
                        value={item.responsable || ""}
                        onChange={e => updateItem(idx, "responsable", e.target.value)}
                        placeholder="Nom..."
                        className="w-full px-1 py-0.5 border-0 bg-transparent focus:ring-1 focus:ring-orange-300 rounded"
                      />
                    </td>
                    <td className="px-2 py-1 border border-gray-200 text-center">
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" size="sm" onClick={addItem} className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Ajouter une tache
          </Button>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Aucun echeancier genere</p>
          <p className="text-xs text-gray-400 mt-1">Cliquez sur "Generer par AI" pour creer un echeancier base sur les divisions</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EDITABLE TEXT COMPONENT (for Word-like editing)
// ============================================================================
function EditableText({
  value,
  onChange,
  className = "",
  tag: Tag = "span",
  placeholder = "Cliquer pour modifier...",
}: {
  value: string
  onChange: (val: string) => void
  className?: string
  tag?: "span" | "p" | "h1" | "h2" | "h3" | "div"
  placeholder?: string
}) {
  const ref = React.useRef<HTMLElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const handleBlur = () => {
    setIsFocused(false)
    const text = ref.current?.innerText || ""
    if (text !== value) onChange(text)
  }

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className={`outline-none transition-colors rounded px-0.5 -mx-0.5 ${isFocused ? "bg-orange-50 ring-1 ring-orange-300" : "hover:bg-gray-50"} ${!value ? "text-gray-400 italic" : ""} ${className}`}
      data-placeholder={placeholder}
    >
      {value || placeholder}
    </Tag>
  )
}

// ============================================================================
// HELPERS POUR GENERER SCOPE ET CALENDRIER VIA IA
// ============================================================================
async function generateScopeAI(soumission: Soumission): Promise<string> {
  const divisions = soumission.phases.flatMap(p => p.divisions.map(d => 
    DIVISIONS_MASTERFORMAT[d.code] || d.nom
  ))
  
  const divList = divisions.slice(0, 4).join(" • ")
  const more = divisions.length > 4 ? ` (+${divisions.length - 4} autres)` : ""
  return `TRAVAUX INCLUS:\n${divList}${more}\n\nNORMES: Code de construction du Québec`
}

async function generateCalendrierAI(soumission: Soumission): Promise<Array<{phase: string; description: string; duree: string}>> {
  return soumission.phases.map(phase => ({
    phase: phase.code,
    description: phase.nom,
    duree: phase.duree_jours ? `${phase.duree_jours} jours` : "À déterminer"
  }))
}

// ============================================================================
// SOUMISSION WORD VIEW (RÉORGANISÉ AVEC EXPORT PDF OPTIMISÉ)
// ============================================================================
const COLORS_DOC = {
  ORANGE: "#F47920",
  GRIS_FONCE: "#2D3748",
  GRIS_MOYEN: "#718096",
  GRIS_LIGNE: "#E2E8F0",
  GRIS_CLAIR: "#F7FAFC",
  JAUNE: "#FFF2CC",
  VERT: "#C6EFCE",
  ROUGE_CLAIR: "#FFC7CE",
}

function SoumissionWordView({
  soumission,
  onSoumissionChange,
  messages,
}: {
  soumission: Soumission
  onSoumissionChange?: (s: Soumission) => void
  messages: Message[]
}) {
  const totaux = useMemo(() => calculerTotauxSoumission(soumission), [soumission])
  const tauxImprevuPct = Math.round((soumission.parametres?.taux_imprevu ?? 0.18) * 100)
  const ohRate = soumission.parametres?.taux_fg ?? 0.10
  const imprevusRate = soumission.parametres?.taux_imprevu ?? 0.18
  const [isExporting, setIsExporting] = useState(false)
  const documentRef = React.useRef<HTMLDivElement>(null)
  const [hideDetails, setHideDetails] = useState(false)
  const [hideLinePrices, setHideLinePrices] = useState(false)
  const [showSommaireView, setShowSommaireView] = useState(false)
  const [sommaireDescriptions, setSommaireDescriptions] = useState<Record<string, string>>({})
  const [isGeneratingSommaire, setIsGeneratingSommaire] = useState(false)
  const [sommaireNotes, setSommaireNotes] = useState("")

  // docFields must be defined early (before useMemo that uses it)
  const [docFields, setDocFields] = useState({
    entreprise: "Gestion A.F. Construction inc.",
    rbq: "5806-1391-01",
    condition: "Prix estimatif. Une visite sur place est requise pour confirmer les quantites et prix finaux.",
    modalites: "10% a l'acceptation | 25% fondations | 40% charpente/toit | 20% finitions | 5% reception",
    conditions: "En signant, vous confirmez avoir lu et compris cette soumission. Le prix final sera ajuste apres la visite sur place.",
    validite: "Cette soumission est valide pour une periode de 30 jours a compter de la date d'emission. Passe ce delai, les prix pourront etre revises selon les conditions du marche.",
  })

  // États pour le contenu généré par IA
  const [scopeAI, setScopeAI] = useState<string>("")
  const [calendrierAI, setCalendrierAI] = useState<Array<{phase: string; description: string; duree: string}>>([])
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // Générer le scope et calendrier au chargement
  React.useEffect(() => {
    const generate = async () => {
      setIsGeneratingAI(true)
      try {
        const [scope, calendrier] = await Promise.all([
          generateScopeAI(soumission),
          generateCalendrierAI(soumission)
        ])
        setScopeAI(scope)
        setCalendrierAI(calendrier)
      } catch (error) {
        console.error("Erreur génération IA:", error)
      } finally {
        setIsGeneratingAI(false)
      }
    }
    generate()
  }, [soumission])

  // Générer les descriptions sommaire via API
  const generateSommaireDescriptions = useCallback(async () => {
    if (isGeneratingSommaire) return
    setIsGeneratingSommaire(true)
    try {
      const divisions = soumission.phases.flatMap(phase =>
        phase.divisions.filter(div => div.items.length > 0).map(div => ({
          code: div.code,
          nom: DIVISIONS_MASTERFORMAT[div.code] || div.nom,
          items: div.items.map(item => ({
            description: item.description,
            quantite: item.quantite,
            unite: item.unite,
            type: item.type,
          })),
        }))
      )

      const response = await fetch("/api/ai/sommaire-divisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisions,
          projectName: soumission.projet.nom || "Projet de construction",
          inclusions: soumission.inclusions || [],
          exclusions: soumission.exclusions || [],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSommaireDescriptions(data.divisions || {})
      }
    } catch (error) {
      console.error("Erreur génération sommaire:", error)
    } finally {
      setIsGeneratingSommaire(false)
    }
  }, [soumission, isGeneratingSommaire])

  // Toggle sommaire view
  const toggleSommaireView = useCallback(() => {
    const newState = !showSommaireView
    setShowSommaireView(newState)
    // Generate descriptions if switching to sommaire view and not already generated
    if (newState && Object.keys(sommaireDescriptions).length === 0) {
      generateSommaireDescriptions()
    }
  }, [showSommaireView, sommaireDescriptions, generateSommaireDescriptions])

  // ===== FONCTION BUILD SOMMAIRE HTML (reusable) =====
  type SommaireFields = {
    projectName: string
    client: string
    adresse: string
    dateStr: string
    validite: number
    entreprise: string
    rbq: string
    notes: string
    divisionDescriptions: Record<string, string>
  }

  const buildSommaireHTML = useCallback((fields: SommaireFields, headerBg: string) => {
    const { projectName, client, adresse, dateStr, validite, entreprise, rbq, notes, divisionDescriptions } = fields
    const fmtH = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g, "<br>")

    // Build division summary rows
    let divisionRows = ""
    let grandTotalMat = 0
    let grandTotalMO = 0
    for (const phase of soumission.phases || []) {
      for (const division of phase.divisions || []) {
        const divNom = DIVISIONS_MASTERFORMAT[division.code] || division.nom
        const matItems = division.items.filter(it => it.type !== "MO")
        const moItems = division.items.filter(it => it.type === "MO")
        const totalMat = matItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
        const totalMO = moItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
        const totalDiv = totalMat + totalMO
        if (totalDiv === 0) continue
        grandTotalMat += totalMat
        grandTotalMO += totalMO

        // Use custom description if provided, otherwise build from items
        const customDesc = divisionDescriptions[division.code]
        let shortDesc: string
        if (customDesc && customDesc.trim()) {
          shortDesc = customDesc.trim()
        } else {
          const descriptions = division.items
            .filter(it => it.description && it.description.trim())
            .slice(0, 4)
            .map(it => it.description.trim())
          shortDesc = descriptions.length > 0
            ? descriptions.join(", ") + (division.items.length > 4 ? ", ..." : "")
            : "Voir details"
        }

        divisionRows += `<tr>
          <td style="font-weight:600;white-space:nowrap">${esc(division.code)}</td>
          <td style="font-weight:600">${esc(divNom)}</td>
          <td style="font-size:9pt;color:#374151;line-height:1.4">${esc(shortDesc)}</td>
          <td class="text-right">${totalMat > 0 ? fmtH(totalMat) : "—"}</td>
          <td class="text-right">${totalMO > 0 ? fmtH(totalMO) : "—"}</td>
          <td class="text-right" style="font-weight:600">${fmtH(totalDiv)}</td>
        </tr>\n`
      }
    }

    const grandTotalCD = grandTotalMat + grandTotalMO
    const oh = grandTotalCD * ohRate
    const imp = grandTotalCD * imprevusRate
    const totalHT = grandTotalCD + oh + imp
    const tps = totalHT * 0.05
    const tvq = totalHT * 0.09975
    const totalTTC = totalHT + tps + tvq

    // Inclusions / Exclusions
    const incl = soumission.inclusions || []
    const excl = soumission.exclusions || []
    let inclExclHTML = ""
    if (incl.length > 0 || excl.length > 0) {
      const maxLen = Math.max(incl.length, excl.length)
      let rows = ""
      for (let i = 0; i < maxLen; i++) {
        rows += `<tr><td class="inclus">${incl[i] ? `<span class="check">&#10003;</span> ${esc(incl[i])}` : ""}</td><td class="exclus">${excl[i] ? `<span class="cross">&#10007;</span> ${esc(excl[i])}` : ""}</td></tr>\n`
      }
      inclExclHTML = `
      <h3 class="section-title">Ce qui est inclus / Ce qui n'est pas inclus</h3>
      <table class="incl-table">
        <thead><tr><th class="th-inclus">INCLUS DANS CETTE SOUMISSION</th><th class="th-exclus">NON INCLUS</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    }

    // Notes section
    const notesHTML = notes.trim() ? `
    <h3 class="section-title">Notes importantes</h3>
    <div class="notes-box">${esc(notes)}</div>` : ""

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Sommaire - ${esc(projectName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.6; color: #1f2937; background: #f3f4f6; padding: 20px; }
    .document { max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.12); border-radius: 6px; overflow: hidden; }
    .header-image { position: relative; width: 100%; height: 140px; background: ${headerBg}; }
    .header-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%); }
    .header-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 16px 24px; color: white; }
    .header-content h1 { font-size: 24pt; font-weight: bold; letter-spacing: 0.04em; }
    .header-content .project-name { font-size: 14pt; opacity: 0.95; margin-top: 4px; }
    .header-content .badge { display: inline-block; background: rgba(244,121,32,0.9); color: white; font-size: 9pt; font-weight: bold; padding: 3px 10px; border-radius: 20px; margin-top: 6px; letter-spacing: 0.05em; }
    .content { padding: 32px 36px; }
    .company-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #F47920; margin-bottom: 24px; }
    .company-info { display: flex; align-items: center; gap: 12px; }
    .logo { width: 44px; height: 44px; background: #F47920; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18pt; border-radius: 10px; }
    .company-name { font-size: 14pt; font-weight: bold; }
    .company-rbq { font-size: 9pt; color: #718096; margin-top: 2px; }
    .date-block { text-align: right; font-size: 10pt; color: #718096; }
    .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 28px; }
    .info-label { background: #f7fafc; padding: 10px 14px; font-size: 10pt; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0; }
    .info-value { padding: 10px 14px; font-size: 10pt; border-bottom: 1px solid #e2e8f0; }
    .info-label:last-of-type, .info-value:last-child { border-bottom: none; }
    h3.section-title { font-size: 13pt; font-weight: bold; color: #2D3748; margin: 28px 0 14px; padding-bottom: 8px; border-bottom: 2px solid #F47920; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; }
    thead th { background: #2F5496; color: white; font-weight: 600; font-size: 9pt; }
    tbody tr:nth-child(even) { background: #f7fafc; }
    tfoot td { background: #fff2cc; font-weight: bold; }
    .text-right { text-align: right; }
    .summary-table tfoot td:last-child { background: #F47920; color: white; }
    .tax-wrap { margin-top: 20px; display: flex; justify-content: flex-end; }
    .tax-table { width: 280px; border-radius: 8px; overflow: hidden; }
    .tax-table td { padding: 8px 14px; font-size: 10pt; }
    .tax-table tr:last-child td { background: #F47920; color: white; font-weight: bold; font-size: 11pt; }
    .total-box { background: #1e3a8a; color: white; border-radius: 10px; padding: 22px 28px; text-align: center; margin: 28px 0; }
    .total-box .lbl { font-size: 12pt; opacity: 0.9; margin-bottom: 6px; }
    .total-box .amount { font-size: 30pt; font-weight: bold; letter-spacing: 0.01em; }
    .incl-table th { text-align: center; padding: 10px; font-weight: bold; font-size: 10pt; }
    .th-inclus { background: #166534; color: white; }
    .th-exclus { background: #991b1b; color: white; }
    .inclus { background: #dcfce7; padding: 8px 12px; font-size: 10pt; }
    .exclus { background: #fee2e2; padding: 8px 12px; font-size: 10pt; }
    .check { color: #166534; font-weight: bold; }
    .cross { color: #991b1b; font-weight: bold; }
    .notes-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; font-size: 10pt; line-height: 1.6; color: #92400e; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 36px; }
    .sig-block h4 { font-size: 11pt; font-weight: bold; margin-bottom: 8px; }
    .sig-block .sig-line { border-bottom: 1px solid #9ca3af; margin-top: 50px; margin-bottom: 6px; }
    .sig-block .date-line { border-bottom: 1px solid #9ca3af; margin-top: 28px; margin-bottom: 6px; }
    .sig-block .line-lbl { font-size: 9pt; color: #718096; }
    .footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid #e2e8f0; margin-top: 32px; font-size: 9pt; color: #718096; }
    .print-bar { max-width: 210mm; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
    .print-bar button { padding: 10px 20px; font-size: 11pt; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; background: #F47920; color: white; }
    @media print {
      body { background: white; padding: 0; }
      .document { box-shadow: none; }
      .print-bar { display: none; }
      .header-image, thead th, tfoot td, .total-box, .logo,
      .th-inclus, .th-exclus, .inclus, .exclus, .notes-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 1.5cm; size: letter; }
    }
  </style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
  <div class="document">
    <div class="header-image">
      <div class="header-overlay"></div>
      <div class="header-content">
        <h1>SOUMISSION</h1>
        <div class="project-name">${esc(projectName)}</div>
        <span class="badge">SOMMAIRE</span>
      </div>
    </div>
    <div class="content">
      <div class="company-bar">
        <div class="company-info">
          <div class="logo">${esc(entreprise.charAt(0))}</div>
          <div>
            <div class="company-name">${esc(entreprise)}</div>
            <div class="company-rbq">RBQ: ${esc(rbq)}</div>
          </div>
        </div>
        <div class="date-block">
          <div><strong>${esc(dateStr)}</strong></div>
          <div>Valide ${validite} jours</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-label">Projet</div><div class="info-value"><strong>${esc(projectName)}</strong></div>
        <div class="info-label">Client</div><div class="info-value">${esc(client || "A confirmer")}</div>
        <div class="info-label">Adresse</div><div class="info-value">${esc(adresse || "A confirmer")}</div>
        <div class="info-label">Date</div><div class="info-value">${esc(dateStr)}</div>
        <div class="info-label">Validite</div><div class="info-value">${validite} jours</div>
      </div>

      <h3 class="section-title">Resume des travaux par division</h3>
      <table class="summary-table">
        <thead>
          <tr>
            <th style="width:60px">Code</th>
            <th style="width:140px">Division</th>
            <th>Description des travaux</th>
            <th class="text-right" style="width:100px">Materiaux</th>
            <th class="text-right" style="width:100px">Main-d'oeuvre</th>
            <th class="text-right" style="width:110px">Sous-total</th>
          </tr>
        </thead>
        <tbody>${divisionRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right">Total des couts directs</td>
            <td class="text-right">${fmtH(grandTotalMat)}</td>
            <td class="text-right">${fmtH(grandTotalMO)}</td>
            <td class="text-right">${fmtH(grandTotalCD)}</td>
          </tr>
        </tfoot>
      </table>

      ${inclExclHTML}
      ${notesHTML}

      <h3 class="section-title">Votre investissement</h3>
      <div class="tax-wrap">
        <table class="tax-table">
          <tbody>
            <tr><td>Couts directs</td><td class="text-right">${fmtH(grandTotalCD)}</td></tr>
            <tr><td>Frais de gestion (${Math.round(ohRate*100)}%)</td><td class="text-right">${fmtH(oh)}</td></tr>
            <tr><td>Contingence (${tauxImprevuPct}%)</td><td class="text-right">${fmtH(imp)}</td></tr>
            <tr style="background:#f7fafc;font-weight:600"><td>Sous-total avant taxes</td><td class="text-right">${fmtH(totalHT)}</td></tr>
            <tr><td>TPS (5%)</td><td class="text-right">${fmtH(tps)}</td></tr>
            <tr><td>TVQ (9,975%)</td><td class="text-right">${fmtH(tvq)}</td></tr>
            <tr><td>TOTAL</td><td class="text-right">${fmtH(totalTTC)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="total-box">
        <div class="lbl">MONTANT TOTAL (taxes incluses)</div>
        <div class="amount">${fmtH(totalTTC)}</div>
      </div>

      <div class="signatures">
        <div class="sig-block">
          <h4>ENTREPRENEUR</h4>
          <p>${esc(entreprise)}</p>
          <p style="color:#718096;font-size:9pt">RBQ: ${esc(rbq)}</p>
          <div class="sig-line"></div><p class="line-lbl">Signature</p>
          <div class="date-line"></div><p class="line-lbl">Date</p>
        </div>
        <div class="sig-block">
          <h4>CLIENT</h4>
          <p>${esc(client || "Client")}</p>
          <p style="color:#718096;font-size:9pt">${esc(adresse || "")}</p>
          <div class="sig-line"></div><p class="line-lbl">Signature (j'accepte cette soumission)</p>
          <div class="date-line"></div><p class="line-lbl">Date</p>
        </div>
      </div>

      <div class="footer">
        <span>${esc(entreprise)} | RBQ: ${esc(rbq)}</span>
        <span>Cette soumission est valide ${validite} jours | ${esc(dateStr)}</span>
      </div>
    </div>
  </div>
</body>
</html>`
  }, [soumission, ohRate, imprevusRate, tauxImprevuPct, hideLinePrices, hideDetails, docFields, calendrierAI, totaux])

  // ===== FONCTION EXPORT SOMMAIRE CLIENT (version simplifiée) =====
  const exportSommaireHTML = async (customFields?: SommaireFields) => {
    setIsExporting(true)
    try {
      const fields = customFields || {
        projectName: soumission.projet.nom || "Soumission",
        client: soumission.projet.client || "",
        adresse: soumission.projet.adresse || "",
        dateStr: soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA"),
        validite: soumission.projet.validite_jours || 30,
        entreprise: soumission.projet.entreprise || "Mon Entreprise",
        rbq: soumission.projet.rbq || "",
        notes: "",
        divisionDescriptions: {},
      }
      // Get header image as base64
      let headerBg = "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0ea5e9 100%)"
      try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = "/images/soumission-header.jpg"
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); setTimeout(reject, 3000) })
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (ctx) { ctx.drawImage(img, 0, 0); const b64 = canvas.toDataURL("image/jpeg", 0.8); headerBg = `url('${b64}') center/cover no-repeat` }
      } catch { /* fallback */ }

      const sommaireHTML = buildSommaireHTML(fields, headerBg)
      const blob = new Blob([sommaireHTML], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sommaire-${projectName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${dateStr}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Sommaire export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const updateField = (field: keyof typeof docFields, val: string) => {
    setDocFields(prev => ({ ...prev, [field]: val }))
    if (onSoumissionChange) {
      const next = deepClone(soumission)
      ;(next.projet as any)[field] = val
      onSoumissionChange(next)
    }
  }

  // ===== FONCTION EXPORT HTML (generates from data, not DOM clone) =====
  const exportHTML = async () => {
    console.log("[v0] exportHTML called with hideDetails =", hideDetails, "hideLinePrices =", hideLinePrices)
    setIsExporting(true)
    try {
      const projectName = soumission.projet.nom || "Soumission"
      const dateStr = soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA")
      const validite = soumission.projet.validite_jours || 30
      const fmtH = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
      const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")

      // Try to get header image as base64
      let headerBg = "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0ea5e9 100%)"
      try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = "/images/soumission-header.jpg"
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); setTimeout(reject, 3000) })
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (ctx) { ctx.drawImage(img, 0, 0); const b64 = canvas.toDataURL("image/jpeg", 0.8); headerBg = `url('${b64}') center/cover no-repeat` }
      } catch { /* fallback gradient */ }

      // Build divisions HTML (respect hideDetails state)
      let pageNum = 1
      let divisionsHTML = ""
      
      // If hideDetails is true, only show summary per division (no item tables)
      for (const phase of soumission.phases || []) {
        for (const division of phase.divisions || []) {
          const divNom = DIVISIONS_MASTERFORMAT[division.code] || division.nom
          const matItems = division.items.filter(it => it.type !== "MO")
          const moItems = division.items.filter(it => it.type === "MO")
          const totalMat = matItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
          const totalMO = moItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
          const totalDiv = totalMat + totalMO
          if (matItems.length === 0 && moItems.length === 0) continue
          pageNum++

          divisionsHTML += `\n    <div class="page-break"><div class="content">
      <div class="division-header">Division ${esc(division.code)} - ${esc(divNom)}</div>`

          if (hideDetails) {
            // Simplified view: only show totals, no individual items
            divisionsHTML += `\n      <table class="detail-table" style="margin-top:16px"><tbody>`
            if (totalMat > 0) {
              divisionsHTML += `\n        <tr><td>Materiaux</td><td class="text-right" style="width:120px"><strong>${fmtH(totalMat)}</strong></td></tr>`
            }
            if (totalMO > 0) {
              divisionsHTML += `\n        <tr><td>Main-d'oeuvre</td><td class="text-right" style="width:120px"><strong>${fmtH(totalMO)}</strong></td></tr>`
            }
            divisionsHTML += `\n        <tr style="border-top:2px solid #2F5496;font-weight:bold"><td>Total Division</td><td class="text-right" style="width:120px">${fmtH(totalDiv)}</td></tr>`
            divisionsHTML += `\n      </tbody></table>`
          } else {
            // Full detail view with all items
            if (matItems.length > 0) {
              if (hideLinePrices) {
                // Show items without individual prices
                divisionsHTML += `\n      <div class="subsection-title">MATERIAUX</div>
      <table class="detail-table"><thead><tr>
        <th style="width:80px">Code</th><th>Description</th><th class="text-center" style="width:60px">Unite</th>
        <th class="text-right" style="width:60px">Qte</th>
      </tr></thead><tbody>`
                for (const it of matItems) {
                  divisionsHTML += `\n        <tr><td>${esc(it.code||"")}</td><td>${esc(it.description)}</td><td class="text-center">${esc(it.unite)}</td><td class="text-right">${it.quantite}</td></tr>`
                }
                divisionsHTML += `\n      </tbody><tfoot><tr><td colspan="3" class="text-right"><strong>Sous-total Materiaux</strong></td><td class="text-right"><strong>${fmtH(totalMat)}</strong></td></tr></tfoot></table>`
              } else {
                divisionsHTML += `\n      <div class="subsection-title">MATERIAUX</div>
      <table class="detail-table"><thead><tr>
        <th style="width:80px">Code</th><th>Description</th><th class="text-center" style="width:60px">Unite</th>
        <th class="text-right" style="width:60px">Qte</th><th class="text-right" style="width:90px">Prix un.</th><th class="text-right" style="width:100px">Total</th>
      </tr></thead><tbody>`
                for (const it of matItems) {
                  divisionsHTML += `\n        <tr><td>${esc(it.code||"")}</td><td>${esc(it.description)}</td><td class="text-center">${esc(it.unite)}</td><td class="text-right">${it.quantite}</td><td class="text-right">${fmtH(it.prix_unitaire)}</td><td class="text-right">${fmtH(it.quantite*it.prix_unitaire)}</td></tr>`
                }
                divisionsHTML += `\n      </tbody><tfoot><tr><td colspan="5" class="text-right"><strong>Sous-total Materiaux</strong></td><td class="text-right"><strong>${fmtH(totalMat)}</strong></td></tr></tfoot></table>`
              }
            }

            if (moItems.length > 0) {
              if (hideLinePrices) {
                // Show items without individual prices
                divisionsHTML += `\n      <div class="subsection-title">MAIN-D'OEUVRE</div>
      <table class="detail-table"><thead><tr>
        <th style="width:80px">Metier</th><th>Description</th>
        <th class="text-right" style="width:80px">Heures</th>
      </tr></thead><tbody>`
                for (const it of moItems) {
                  divisionsHTML += `\n        <tr><td>${esc(it.code||"")}</td><td>${esc(it.description)}</td><td class="text-right">${it.quantite}</td></tr>`
                }
                divisionsHTML += `\n      </tbody><tfoot><tr><td colspan="2" class="text-right"><strong>Sous-total Main-d'oeuvre</strong></td><td class="text-right"><strong>${fmtH(totalMO)}</strong></td></tr></tfoot></table>`
              } else {
                divisionsHTML += `\n      <div class="subsection-title">MAIN-D'OEUVRE</div>
      <table class="detail-table"><thead><tr>
        <th style="width:80px">Metier</th><th>Description</th>
        <th class="text-right" style="width:80px">Heures</th><th class="text-right" style="width:80px">Taux</th><th class="text-right" style="width:100px">Total</th>
      </tr></thead><tbody>`
                for (const it of moItems) {
                  divisionsHTML += `\n        <tr><td>${esc(it.code||"")}</td><td>${esc(it.description)}</td><td class="text-right">${it.quantite}</td><td class="text-right">${fmtH(it.prix_unitaire)}</td><td class="text-right">${fmtH(it.quantite*it.prix_unitaire)}</td></tr>`
                }
                divisionsHTML += `\n      </tbody><tfoot><tr><td colspan="4" class="text-right"><strong>Sous-total Main-d'oeuvre</strong></td><td class="text-right"><strong>${fmtH(totalMO)}</strong></td></tr></tfoot></table>`
              }
            }
          }

          divisionsHTML += `\n      <div class="page-footer"><span>${esc(docFields.entreprise)} | RBQ: ${esc(docFields.rbq)}</span><span>Page ${pageNum}</span></div>
    </div></div>`
        }
      }

      // Inclusions/Exclusions
      let inclusionsHTML = ""
      const incl = soumission.inclusions || []
      const excl = soumission.exclusions || []
      if (incl.length > 0 || excl.length > 0) {
        pageNum++
        const maxLen = Math.max(incl.length, excl.length)
        let rows = ""
        for (let i = 0; i < maxLen; i++) {
          rows += `<tr><td class="inclus">${esc(incl[i]||"")}</td><td class="exclus">${esc(excl[i]||"")}</td></tr>\n`
        }
        inclusionsHTML = `\n    <div class="page-break"><div class="content">
      <div class="section-title">Inclusions et exclusions</div>
      <table class="inclusions-table"><thead><tr><th class="inclus">INCLUS</th><th class="exclus">EXCLUS</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="page-footer"><span>${esc(docFields.entreprise)} | RBQ: ${esc(docFields.rbq)}</span><span>Page ${pageNum}</span></div>
    </div></div>`
      }

      // Financial summary
      pageNum++
      let phaseRows = ""
      for (let i = 0; i < totaux.phaseDetails.length; i++) {
        const p = totaux.phaseDetails[i]
        const oh = p.cd * ohRate
        const imp = p.cd * imprevusRate
        const ht = p.cd + oh + imp
        phaseRows += `<tr><td style="font-weight:500">${esc(p.code)}</td><td>${esc(p.nom)}</td><td class="text-right">${fmtH(p.cd)}</td><td class="text-right">${fmtH(oh)}</td><td class="text-right">${fmtH(imp)}</td><td class="text-right" style="font-weight:500">${fmtH(ht)}</td></tr>\n`
      }

      // Calendrier rows
      let calRows = ""
      for (let i = 0; i < calendrierAI.length; i++) {
        calRows += `<tr><td>${esc(calendrierAI[i].phase)}</td><td>${esc(calendrierAI[i].description)}</td><td class="text-center">${esc(calendrierAI[i].duree)}</td></tr>\n`
      }
      const totalDuree = soumission.projet.duree_jours || calendrierAI.reduce((s, it) => s + (Number.parseInt(it.duree) || 0), 0)

      const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Soumission - ${esc(projectName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; color: #1f2937; background: #f3f4f6; padding: 20px; }
    .document { max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header-image { position: relative; width: 100%; height: 140px; background: ${headerBg}; overflow: hidden; }
    .header-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%); }
    .header-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 16px 24px; color: white; }
    .header-content h1 { font-size: 22pt; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.02em; }
    .header-content .project-name { font-size: 14pt; opacity: 0.95; margin-bottom: 2px; }
    .header-content .project-details { font-size: 9pt; opacity: 0.7; }
    .content { padding: 24px; background: white; }
    .company-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #F47920; margin-bottom: 16px; }
    .company-info { display: flex; align-items: center; gap: 12px; }
    .logo { width: 40px; height: 40px; background: #F47920; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16pt; border-radius: 8px; flex-shrink: 0; }
    .company-details h2 { font-size: 13pt; font-weight: bold; margin-bottom: 2px; }
    .company-details p { font-size: 9pt; color: #718096; }
    .date-info { text-align: right; font-size: 9pt; color: #718096; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 12pt; font-weight: bold; color: #2D3748; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; }
    th, td { padding: 6px 8px; text-align: left; border: 1px solid #E2E8F0; }
    thead th { background: #2F5496; color: white; font-weight: 500; }
    tbody tr:nth-child(even) { background: #F7FAFC; }
    tfoot td { background: #FFF2CC; font-weight: bold; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .info-table td:first-child { width: 180px; background: #F7FAFC; font-weight: bold; }
    .alert-box { background: #FFF8E1; border: 1px solid #FFE082; border-radius: 4px; padding: 12px; margin: 12px 0; }
    .alert-box .alert-title { font-size: 9pt; font-weight: bold; color: #E65100; margin-bottom: 4px; }
    .alert-box p { font-size: 9pt; line-height: 1.5; }
    .calendar-table thead th { background: #2D3748; }
    .division-header { background: #F47920; color: white; padding: 8px 12px; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 8px; }
    .subsection-title { font-size: 9pt; font-weight: bold; color: #2D3748; margin-top: 12px; margin-bottom: 6px; }
    .detail-table thead th { background: #718096; font-size: 8.5pt; }
    .detail-table tbody td { font-size: 8.5pt; padding: 4px 6px; }
    .inclusions-table th { padding: 8px; font-weight: bold; text-align: center; }
    .inclusions-table th.inclus { background: #006400; color: white; }
    .inclusions-table th.exclus { background: #8B0000; color: white; }
    .inclusions-table td.inclus { background: #C6EFCE; }
    .inclusions-table td.exclus { background: #FFC7CE; }
    .tax-table { width: 280px; margin-left: auto; margin-top: 12px; }
    .total-banner { background: #F47920; color: white; text-align: center; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .total-banner .label { font-size: 12pt; font-weight: bold; margin-right: 12px; }
    .total-banner .amount { font-size: 22pt; font-weight: bold; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 24px; }
    .signature-block h4 { font-size: 10pt; font-weight: bold; color: #2D3748; margin-bottom: 4px; }
    .signature-block p { font-size: 9pt; margin-bottom: 2px; }
    .signature-block .signature-line { border-bottom: 1px solid #9ca3af; margin-top: 40px; margin-bottom: 4px; }
    .signature-block .date-line { border-bottom: 1px solid #9ca3af; margin-top: 20px; margin-bottom: 4px; }
    .signature-block .line-label { font-size: 8pt; color: #718096; }
    .page-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #E2E8F0; margin-top: 20px; font-size: 8pt; color: #718096; }
    .page-break { page-break-before: always; margin-top: 40px; padding-top: 24px; }
    @media print {
      body { background: white; padding: 0; }
      .document { box-shadow: none; }
      .header-image, thead th, tfoot td, .alert-box, .total-banner, .division-header,
      .inclusions-table th.inclus, .inclusions-table th.exclus,
      .inclusions-table td.inclus, .inclusions-table td.exclus,
      .logo { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; margin-top: 0; padding-top: 0; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; size: letter; }
    }
    .print-bar { max-width: 210mm; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
    .print-bar button { padding: 8px 16px; font-size: 10pt; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; }
    .btn-print { background: #F47920; color: white; }
    .btn-print:hover { background: #e06810; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">Imprimer / PDF</button>
  </div>
  <div class="document">

    <!-- PAGE 1 - COUVERTURE -->
    <div class="header-image">
      <div class="header-overlay"></div>
      <div class="header-content">
        <h1>SOUMISSION</h1>
        <div class="project-name">${esc(projectName)}</div>
        <div class="project-details">${esc(soumission.projet.client || "")} | ${esc(soumission.projet.adresse || "")}</div>
      </div>
    </div>

    <div class="content">
      <div class="company-header">
        <div class="company-info">
          <div class="logo">AF</div>
          <div class="company-details">
            <h2>${esc(docFields.entreprise)}</h2>
            <p>RBQ: ${esc(docFields.rbq)}</p>
          </div>
        </div>
        <div class="date-info">
          <div>${esc(dateStr)}</div>
          <div>Validite: ${validite} jours</div>
        </div>
      </div>

      <table class="info-table">
        <tbody>
          <tr><td>Chantier</td><td>${esc(soumission.projet.adresse || "A confirmer")}</td></tr>
          <tr><td>Client</td><td>${esc(soumission.projet.client || "A confirmer")}</td></tr>
          <tr><td>Date</td><td>${esc(dateStr)}</td></tr>
          <tr><td>Categorie</td><td>${esc(soumission.projet.categorie || "B")} | Imprevus ${tauxImprevuPct}%</td></tr>
          <tr><td>Validite</td><td>${validite} jours</td></tr>
        </tbody>
      </table>

      <div class="alert-box">
        <div class="alert-title">CONDITION IMPORTANTE</div>
        <p>${esc(docFields.condition)}</p>
      </div>

      <div class="section">
        <h3 class="section-title">Portee des travaux</h3>
        <p style="white-space:pre-line;line-height:1.8;font-size:10pt">${esc(scopeAI)}</p>
      </div>

      <div class="page-footer">
        <span>${esc(docFields.entreprise)} | RBQ: ${esc(docFields.rbq)}</span>
        <span>Page 1</span>
      </div>
    </div>

    <!-- CALENDRIER - PAGE SEPAREE -->
    <div class="page-break"><div class="content">
      <h3 class="section-title" style="margin-top:0">Calendrier preliminaire</h3>
      <p style="font-size:9pt;color:#4a5568;margin-bottom:12px">Voici les grandes etapes de votre projet :</p>
      <table class="calendar-table">
        <thead><tr><th style="width:80px">Phase</th><th>Ce qui sera fait</th><th class="text-center" style="width:100px">Duree estimee</th></tr></thead>
        <tbody>${calRows}</tbody>
        <tfoot><tr><td colspan="2" style="text-align:right"><strong>DUREE TOTALE</strong></td><td class="text-center"><strong>${totalDuree} jours</strong></td></tr></tfoot>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f0f9ff;border-left:3px solid #3b82f6;border-radius:4px">
        <p style="font-size:9pt;color:#1e40af;margin:0"><strong>Note :</strong> Ce calendrier est une estimation. Les dates exactes seront confirmees avant le debut des travaux.</p>
      </div>
      <div class="page-footer">
        <span>${esc(docFields.entreprise)} | RBQ: ${esc(docFields.rbq)}</span>
        <span>Page 2</span>
      </div>
    </div>

    <!-- DIVISIONS -->${divisionsHTML}

    <!-- INCLUSIONS/EXCLUSIONS -->${inclusionsHTML}

    <!-- SOMMAIRE FINANCIER -->
    <div class="page-break"><div class="content">
      <div class="section-title">Sommaire financier</div>
      <table>
        <thead><tr style="background:#2D3748">
          <th>Phase</th><th>Description</th><th class="text-right">CD</th>
          <th class="text-right">OH ${ohRate*100}%</th><th class="text-right">Impr. ${tauxImprevuPct}%</th><th class="text-right">Total HT</th>
        </tr></thead>
        <tbody>${phaseRows}</tbody>
        <tfoot><tr>
          <td colspan="2" class="text-right"><strong>SOUS-TOTAL</strong></td>
          <td class="text-right"><strong>${fmtH(totaux.totalCD)}</strong></td>
          <td class="text-right"><strong>${fmtH(totaux.fg)}</strong></td>
          <td class="text-right"><strong>${fmtH(totaux.imprevus)}</strong></td>
          <td class="text-right"><strong>${fmtH(totaux.totalHT)}</strong></td>
        </tr></tfoot>
      </table>

      <table class="tax-table">
        <tbody>
          <tr><td class="text-right">Sous-total HT</td><td class="text-right" style="font-weight:500">${fmtH(totaux.totalHT)}</td></tr>
          <tr><td class="text-right">TPS (5%)</td><td class="text-right">${fmtH(totaux.tps)}</td></tr>
          <tr><td class="text-right">TVQ (9,975%)</td><td class="text-right">${fmtH(totaux.tvq)}</td></tr>
          <tr><td class="text-right" style="background:#F47920;color:white;font-weight:bold">TOTAL TTC</td><td class="text-right" style="background:#F47920;color:white;font-weight:bold">${fmtH(totaux.totalTTC)}</td></tr>
        </tbody>
      </table>

      <div style="margin-top:16px">
        <h3 class="section-title" style="font-size:10pt">Modalites de paiement</h3>
        <p>${esc(docFields.modalites)}</p>
      </div>

      <div class="page-footer">
        <span>${esc(docFields.entreprise)} | RBQ: ${esc(docFields.rbq)}</span>
        <span>Page ${pageNum}</span>
      </div>
    </div></div>

<!-- CALENDRIER DES TRAVAUX -->
  ${(() => {
    const echeancier = (soumission as any).echeancier || []
    if (echeancier.length === 0) return ""
    const totalJours = echeancier.reduce((s: number, it: any) => s + it.duree_jours, 0)
    return `<div class="page-break"><div class="content">
      <div class="section-title">Calendrier des travaux</div>
      <p style="margin-bottom:12px;font-size:9pt;">Duree estimee: <strong>${totalJours} jours ouvrables</strong></p>
      <table class="detail-table calendar-table">
        <thead>
          <tr>
            <th style="width:60px">ID</th>
            <th>Tache</th>
            <th style="width:80px" class="text-center">Duree</th>
            <th style="width:100px" class="text-right">Debut</th>
            <th style="width:100px" class="text-right">Fin</th>
          </tr>
        </thead>
        <tbody>
          ${echeancier.map((item: any, idx: number) => `
            <tr style="background:${idx % 2 === 0 ? '#F7FAFC' : '#FFFFFF'}">
              <td>${esc(item.id)}</td>
              <td>${esc(item.tache)}</td>
              <td class="text-center">${item.duree_jours} j</td>
              <td class="text-right">${item.date_debut}</td>
              <td class="text-right">${item.date_fin}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="page-footer">
        <span>${esc(docFields.entreprise)} | RBQ: ${esc(docFields.rbq)}</span>
        <span>Page ${pageNum + 1}</span>
      </div>
    </div></div>`
  })()}

  <!-- ACCEPTATION & SIGNATURES -->
  <div class="page-break"><div class="content">
  <div class="section-title">Acceptation</div>
      <p style="margin-bottom:8px">${esc(docFields.conditions)}</p>
      <p style="margin-bottom:12px">${esc(docFields.validite)}</p>

      <div class="total-banner">
        <span class="label">TOTAL TTC</span>
        <span class="amount">${fmtH(totaux.totalTTC)}</span>
      </div>

      <div class="signatures">
        <div class="signature-block">
          <h4>ENTREPRENEUR</h4>
          <p>${esc(docFields.entreprise)}</p>
          <p style="color:#718096">RBQ: ${esc(docFields.rbq)}</p>
          <div class="signature-line"></div>
          <p class="line-label">Signature</p>
          <div class="date-line"></div>
          <p class="line-label">Date</p>
        </div>
        <div class="signature-block">
          <h4>CLIENT</h4>
          <p>${esc(soumission.projet.client || "Client")}</p>
          <p style="color:#718096">${esc(soumission.projet.adresse || "")}</p>
          <div class="signature-line"></div>
          <p class="line-label">Signature</p>
          <div class="date-line"></div>
          <p class="line-label">Date</p>
        </div>
      </div>
    </div></div>

  </div>
</body>
</html>`

      const blob = new Blob([fullHTML], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `soumission-${projectName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${dateStr}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("HTML export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const updateProjet = (field: string, val: string) => {
    if (!onSoumissionChange) return
    const next = deepClone(soumission)
    ;(next.projet as any)[field] = val
    onSoumissionChange(next)
  }

  return (
    <>
    <div className="flex-1 overflow-auto bg-gray-200 p-4 md:p-6">
      {/* Toolbar */}
      <div className="max-w-[210mm] mx-auto mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-500 no-print">
          <Pencil className="h-3.5 w-3.5" />
          <span>Cliquez sur tout texte pour le modifier directement.</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 no-print">
          <Button
            onClick={() => setHideDetails(!hideDetails)}
            size="sm"
            variant="outline"
            className="bg-white hover:bg-gray-50 text-gray-700 gap-2"
          >
            {hideDetails ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hideDetails ? "Afficher details" : "Masquer details"}
          </Button>
          <Button
            onClick={() => setHideLinePrices(!hideLinePrices)}
            size="sm"
            variant={hideLinePrices ? "default" : "outline"}
            className={hideLinePrices 
              ? "bg-amber-600 hover:bg-amber-700 text-white gap-2"
              : "bg-white hover:bg-gray-50 text-gray-700 gap-2"}
          >
            {hideLinePrices ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hideLinePrices ? "Afficher prix/ligne" : "Masquer prix/ligne"}
          </Button>
          <Button
            onClick={toggleSommaireView}
            size="sm"
            variant={showSommaireView ? "default" : "outline"}
            className={showSommaireView 
              ? "bg-blue-600 hover:bg-blue-700 text-white gap-2" 
              : "bg-white hover:bg-blue-50 text-blue-700 border-blue-200 gap-2"}
          >
            {isGeneratingSommaire ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {showSommaireView ? "Vue detaillee" : "Sommaire client"}
          </Button>
          <Button
            onClick={exportHTML}
            disabled={isExporting}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? "Export..." : "Telecharger HTML"}
          </Button>
        </div>
      </div>

      {/* ===== SOMMAIRE CLIENT VIEW ===== */}
      {showSommaireView ? (
        <SommaireClientView
          soumission={soumission}
          descriptions={sommaireDescriptions}
          setDescriptions={setSommaireDescriptions}
          notes={sommaireNotes}
          setNotes={setSommaireNotes}
          isGenerating={isGeneratingSommaire}
          onRegenerate={generateSommaireDescriptions}
          docFields={docFields}
          updateField={updateField}
          totaux={totaux}
          ohRate={ohRate}
          imprevusRate={imprevusRate}
          tauxImprevuPct={tauxImprevuPct}
          exportSommaireHTML={exportSommaireHTML}
          isExporting={isExporting}
        />
      ) : (
        <div ref={documentRef} className="max-w-[210mm] mx-auto bg-white shadow-xl rounded" style={{ fontFamily: "Arial, sans-serif" }}>

        {/* ===== PAGE 1 - COUVERTURE + SCOPE ===== */}

        {/* Header Image - 140px FIXE avec gradient fallback */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "140px",
            overflow: "hidden",
            borderRadius: "6px 6px 0 0",
            background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0ea5e9 100%)",
          }}
        >
          <img
            src="/images/soumission-header.jpg"
            alt="Photo de chantier"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
            crossOrigin="anonymous"
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px" }}>
            <h2 style={{ fontSize: "22pt", fontWeight: "bold", color: "white", letterSpacing: "0.02em", marginBottom: "2px" }}>SOUMISSION</h2>
            <p style={{ fontSize: "14pt", color: "rgba(255,255,255,0.95)" }}>{soumission.projet.nom}</p>
            <p style={{ fontSize: "9pt", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
              {`${soumission.projet.client || ""} | ${soumission.projet.adresse || ""}`}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3" style={{ position: "relative", zIndex: 1, backgroundColor: "white" }}>

          {/* Header with logo - COMPACT */}
          <div className="flex justify-between items-start border-b-4 pb-2" style={{ borderColor: COLORS_DOC.ORANGE }}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLORS_DOC.ORANGE }}>
                <span className="text-white font-bold text-base">AF</span>
              </div>
              <div>
                <EditableText
                  value={docFields.entreprise}
                  onChange={v => updateField("entreprise", v)}
                  tag="h1"
                  className="text-base font-bold"
                />
                <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>
                  {"RBQ: "}
                  <EditableText value={docFields.rbq} onChange={v => updateField("rbq", v)} className="text-xs" />
                </p>
              </div>
            </div>
            <div className="text-right text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>
              <EditableText
                value={soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA")}
                onChange={v => updateProjet("date_soumission", v)}
                className="text-xs"
              />
              <p>{`Validite: ${soumission.projet.validite_jours || 30} jours`}</p>
            </div>
          </div>

          {/* Project Info Table - COMPACT */}
          <div className="text-sm">
            <table className="w-full border-collapse">
              <tbody>
                {[
                  { label: "Chantier", field: "adresse" },
                  { label: "Client", field: "client" },
                  { label: "Date", field: "date_soumission", value: soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA") },
                  { label: "Categorie", value: `${soumission.projet.categorie || "B"} | Imprevus ${tauxImprevuPct}%` },
                  { label: "Validite", value: `${soumission.projet.validite_jours || 30} jours` },
                ].map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-1.5 font-bold w-48 border text-xs" style={{ backgroundColor: COLORS_DOC.GRIS_CLAIR, borderColor: COLORS_DOC.GRIS_LIGNE }}>
                      {row.label}
                    </td>
                    <td className="px-3 py-1.5 border text-xs" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>
                      {row.value || (
                        <EditableText
                          value={(soumission.projet as any)[row.field!] || ""}
                          onChange={v => updateProjet(row.field!, v)}
                          className="text-xs"
                          placeholder="A confirmer"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Condition importante - COMPACT */}
          <div className="p-2 rounded" style={{ backgroundColor: "#FFF8E1", border: "1px solid #FFE082" }}>
            <p className="text-xs font-bold mb-0.5" style={{ color: "#E65100" }}>{"CONDITION IMPORTANTE"}</p>
            <EditableText
              value={docFields.condition}
              onChange={v => updateField("condition", v)}
              tag="p"
              className="text-xs leading-relaxed"
            />
          </div>

          {/* SCOPE DES TRAVAUX (généré par IA) */}
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: COLORS_DOC.GRIS_CLAIR }}>
            <h3 className="text-sm font-bold mb-2" style={{ color: COLORS_DOC.GRIS_FONCE }}>Portee des travaux</h3>
            {isGeneratingAI ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Generation en cours...</span>
              </div>
            ) : (
              <EditableText
                value={scopeAI}
                onChange={setScopeAI}
                tag="p"
                className="text-xs leading-relaxed whitespace-pre-wrap"
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-2 border-t text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN, borderColor: COLORS_DOC.GRIS_LIGNE }}>
            <span>{`${docFields.entreprise} | RBQ: ${docFields.rbq}`}</span>
            <span>Page 1</span>
          </div>
        </div>

        {/* ===== PAGE CALENDRIER PRELIMINAIRE ===== */}
        {((soumission as any).echeancier?.length > 0 || calendrierAI.length > 0) && (
          <>
            <div className="page-break" />
            <div className="p-6 space-y-4" style={{ backgroundColor: "white", position: "relative", zIndex: 1 }}>
              <h2 className="text-lg font-bold" style={{ color: COLORS_DOC.ORANGE }}>Calendrier preliminaire des travaux</h2>
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>
                Ce calendrier est fourni a titre indicatif et pourra etre ajuste selon les conditions du chantier et la disponibilite des ressources.
              </p>

              {/* Use echeancier from tableur if available, otherwise use AI generated */}
              {(soumission as any).echeancier?.length > 0 ? (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: COLORS_DOC.BLEU_MARINE }}>
                      <th className="px-2 py-2 text-left text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "60px" }}>ID</th>
                      <th className="px-2 py-2 text-left text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>Tache</th>
                      <th className="px-2 py-2 text-center text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "80px" }}>Duree</th>
                      <th className="px-2 py-2 text-center text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "100px" }}>Date debut</th>
                      <th className="px-2 py-2 text-center text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "100px" }}>Date fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((soumission as any).echeancier || []).map((item: any, i: number) => (
                      <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                        <td className="px-2 py-1.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, color: COLORS_DOC.GRIS_MOYEN }}>{item.id}</td>
                        <td className="px-2 py-1.5 border font-medium" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.tache}</td>
                        <td className="px-2 py-1.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.duree_jours} jour{item.duree_jours > 1 ? "s" : ""}</td>
                        <td className="px-2 py-1.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.date_debut}</td>
                        <td className="px-2 py-1.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.date_fin}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                      <td className="px-2 py-2 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }} colSpan={2}>DUREE TOTALE ESTIMEE</td>
                      <td className="px-2 py-2 text-center font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>
                        {((soumission as any).echeancier || []).reduce((s: number, it: any) => s + it.duree_jours, 0)} jours
                      </td>
                      <td className="px-2 py-2 text-center font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>
                        {(soumission as any).echeancier?.[0]?.date_debut || "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>
                        {(soumission as any).echeancier?.[(soumission as any).echeancier.length - 1]?.date_fin || "-"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: COLORS_DOC.GRIS_FONCE }}>
                      <th className="px-2 py-2 text-left text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>Phase</th>
                      <th className="px-2 py-2 text-left text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>Description</th>
                      <th className="px-2 py-2 text-center text-white font-medium border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "100px" }}>Duree</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendrierAI.map((item, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                        <td className="px-2 py-1.5 border font-medium" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.phase}</td>
                        <td className="px-2 py-1.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                        <td className="px-2 py-1.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.duree}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                      <td className="px-2 py-2 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }} colSpan={2}>DUREE TOTALE ESTIMEE</td>
                      <td className="px-2 py-2 text-center font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>
                        {`${soumission.projet.duree_jours || calendrierAI.reduce((sum, item) => sum + (parseInt(item.duree) || 0), 0)} jours`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* Footer */}
              <div className="flex justify-between items-center pt-4 border-t text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN, borderColor: COLORS_DOC.GRIS_LIGNE }}>
                <span>{`${docFields.entreprise} | RBQ: ${docFields.rbq}`}</span>
                <span>Page 2</span>
              </div>
            </div>
          </>
        )}

        {/* ===== PAGES 3+ - DETAILS PAR DIVISION ===== */}
        {(soumission.phases || []).map((phase, phaseIdx) =>
          (phase.divisions || []).map((division, divIdx) => {
            const divNom = DIVISIONS_MASTERFORMAT[division.code] || division.nom
            const taskLists = (division as any).task_lists || []
            const hasTaskLists = taskLists.length > 0

            // Group items by task list if task lists exist
            const groupItemsByTaskList = () => {
              const groups: Map<string | undefined, any[]> = new Map()
              const sortedLists = [...taskLists].sort((a: any, b: any) => a.order - b.order)
              
              for (const list of sortedLists) {
                groups.set(list.id, [])
              }
              groups.set(undefined, [])
              
              for (const item of division.items || []) {
                const key = (item as any).task_list_id
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key)!.push(item)
              }
              return { groups, sortedLists }
            }

            const matItems = (division.items || []).filter(it => it.type !== "MO")
            const moItems = (division.items || []).filter(it => it.type === "MO")
            const totalMat = matItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
            const totalMO = moItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)

            if (matItems.length === 0 && moItems.length === 0) return null

            // If there are task lists, render by task list instead of by type
            if (hasTaskLists) {
              const { groups, sortedLists } = groupItemsByTaskList()
              return (
                <React.Fragment key={`phase-${phaseIdx}-div-${divIdx}`}>
                  <div className="page-break" />
                  <div className="p-6 space-y-3" style={{ backgroundColor: "white", position: "relative", zIndex: 1 }}>
                    <h3 className="text-sm font-bold" style={{ color: COLORS_DOC.ORANGE }}>
                      {`Division ${division.code} - ${divNom}`}
                    </h3>

                    {/* Render each task list */}
                    {sortedLists.map((list: any) => {
                      const listItems = groups.get(list.id) || []
                      if (listItems.length === 0) return null
                      const listTotal = listItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)

                      return (
                        <div key={list.id} className="mb-3">
                          <h4 className="text-xs font-bold mb-1" style={{ color: COLORS_DOC.BLEU_MARINE }}>
                            {list.name.toUpperCase()}
                          </h4>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                            <tr style={{ backgroundColor: COLORS_DOC.GRIS_MOYEN }}>
                              <th className="px-1.5 py-1 text-left text-white font-medium" style={{ width: "80px" }}>Code</th>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Description</th>
                              <th className="px-1.5 py-1 text-center text-white font-medium" style={{ width: "50px" }}>Type</th>
                              {!hideDetails && (
                                  <>
                                    <th className="px-1.5 py-1 text-center text-white font-medium" style={{ width: "60px" }}>Unite</th>
                                    <th className="px-1.5 py-1 text-right text-white font-medium" style={{ width: "50px" }}>Qte</th>
                                    {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium" style={{ width: "80px" }}>Prix un.</th>}
                                  </>
                                )}
                                {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium" style={{ width: "90px" }}>Total</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {listItems.map((item, idx) => (
                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                                  <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "80px" }}>{item.code || ""}</td>
                                  <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                                  <td className="px-1.5 py-0.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "50px" }}>{item.type}</td>
                                  {!hideDetails && (
                                    <>
                                      <td className="px-1.5 py-0.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "60px" }}>{item.unite}</td>
                                      <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "50px" }}>{item.quantite}</td>
                                      {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "80px" }}>{fmt(item.prix_unitaire)}</td>}
                                    </>
                                  )}
                                  {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "90px" }}>{fmt(item.quantite * item.prix_unitaire)}</td>}
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                                <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }} colSpan={hideDetails ? 3 : (hideLinePrices ? 5 : 6)}>{`Sous-total ${list.name}`}</td>
                                <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(listTotal)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    })}

                    {/* Items without a task list */}
                    {(groups.get(undefined) || []).length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-bold mb-1" style={{ color: COLORS_DOC.GRIS_FONCE }}>AUTRES</h4>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: COLORS_DOC.GRIS_MOYEN }}>
                              <th className="px-1.5 py-1 text-left text-white font-medium" style={{ width: "80px" }}>Code</th>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Description</th>
                              <th className="px-1.5 py-1 text-center text-white font-medium" style={{ width: "50px" }}>Type</th>
                              {!hideDetails && (
                                <>
                                  <th className="px-1.5 py-1 text-center text-white font-medium" style={{ width: "60px" }}>Unite</th>
                                  <th className="px-1.5 py-1 text-right text-white font-medium" style={{ width: "50px" }}>Qte</th>
                                  {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium" style={{ width: "80px" }}>Prix un.</th>}
                                </>
                              )}
                              {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium" style={{ width: "90px" }}>Total</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(groups.get(undefined) || []).map((item, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "80px" }}>{item.code || ""}</td>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                                <td className="px-1.5 py-0.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "50px" }}>{item.type}</td>
                                {!hideDetails && (
                                  <>
                                    <td className="px-1.5 py-0.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "60px" }}>{item.unite}</td>
                                    <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "50px" }}>{item.quantite}</td>
                                    {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "80px" }}>{fmt(item.prix_unitaire)}</td>}
                                  </>
                                )}
                                {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE, width: "90px" }}>{fmt(item.quantite * item.prix_unitaire)}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Division total */}
                    <div className="flex justify-end pt-2">
                      <div className="text-xs font-bold px-3 py-1 rounded" style={{ backgroundColor: COLORS_DOC.ORANGE, color: "white" }}>
                        {`Total Division: ${fmt(totalMat + totalMO)}`}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-2 border-t text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN, borderColor: COLORS_DOC.GRIS_LIGNE }}>
                      <span>{`${docFields.entreprise} | RBQ: ${docFields.rbq}`}</span>
                      <span>{`Page ${phaseIdx + divIdx + 2}`}</span>
                    </div>
                  </div>
                </React.Fragment>
              )
            }

            // Fallback to original rendering by MO/Mat type
            return (
              <React.Fragment key={`phase-${phaseIdx}-div-${divIdx}`}>
                <div className="page-break" />
                <div className="p-6 space-y-2" style={{ backgroundColor: "white", position: "relative", zIndex: 1 }}>
                  <h3 className="text-sm font-bold" style={{ color: COLORS_DOC.ORANGE }}>
                    {`Division ${division.code} - ${divNom}`}
                  </h3>

                  {/* Materiaux */}
                  {matItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold mb-1" style={{ color: COLORS_DOC.GRIS_FONCE }}>MATERIAUX</h4>
                      {hideDetails ? (
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: COLORS_DOC.GRIS_MOYEN }}>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Code</th>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matItems.map((item, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.code || ""}</td>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>Sous-total Materiaux</td>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totalMat)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: COLORS_DOC.GRIS_MOYEN }}>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Code</th>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Description</th>
                              <th className="px-1.5 py-1 text-center text-white font-medium">Unite</th>
                              <th className="px-1.5 py-1 text-right text-white font-medium">Qte</th>
                              {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium">Prix un.</th>}
                              {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium">Total</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {matItems.map((item, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.code || ""}</td>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                                <td className="px-1.5 py-0.5 border text-center" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.unite}</td>
                                <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.quantite}</td>
                                {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(item.prix_unitaire)}</td>}
                                {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(item.quantite * item.prix_unitaire)}</td>}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }} colSpan={hideLinePrices ? 4 : 5}>Sous-total Materiaux</td>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totalMat)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Main d'oeuvre */}
                  {moItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold mb-1" style={{ color: COLORS_DOC.GRIS_FONCE }}>{"MAIN-D'OEUVRE"}</h4>
                      {hideDetails ? (
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: COLORS_DOC.GRIS_MOYEN }}>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Metier</th>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {moItems.map((item, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.code || ""}</td>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{"Sous-total Main-d'oeuvre"}</td>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totalMO)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: COLORS_DOC.GRIS_MOYEN }}>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Metier</th>
                              <th className="px-1.5 py-1 text-left text-white font-medium">Description</th>
                              <th className="px-1.5 py-1 text-right text-white font-medium">Heures</th>
                              {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium">Taux</th>}
                              {!hideLinePrices && <th className="px-1.5 py-1 text-right text-white font-medium">Total</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {moItems.map((item, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.code || ""}</td>
                                <td className="px-1.5 py-0.5 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.description}</td>
                                <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{item.quantite}</td>
                                {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(item.prix_unitaire)}</td>}
                                {!hideLinePrices && <td className="px-1.5 py-0.5 border text-right" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(item.quantite * item.prix_unitaire)}</td>}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }} colSpan={hideLinePrices ? 3 : 4}>{"Sous-total Main-d'oeuvre"}</td>
                              <td className="px-1.5 py-1 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totalMO)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            )
          }),
        )}

        {/* ===== INCLUSIONS / EXCLUSIONS ===== */}
        {((soumission.inclusions?.length || 0) > 0 || (soumission.exclusions?.length || 0) > 0) && (
          <>
            <div className="page-break" />
            <div className="p-6 space-y-2" style={{ backgroundColor: "white", position: "relative", zIndex: 1 }}>
              <h2 className="text-lg font-bold" style={{ color: COLORS_DOC.GRIS_FONCE }}>Inclusions et exclusions</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-center text-white font-bold border" style={{ backgroundColor: "#006400", borderColor: COLORS_DOC.GRIS_LIGNE }}>{"INCLUS"}</th>
                    <th className="px-2 py-1.5 text-center text-white font-bold border" style={{ backgroundColor: "#8B0000", borderColor: COLORS_DOC.GRIS_LIGNE }}>{"EXCLUS"}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(soumission.inclusions?.length || 0, soumission.exclusions?.length || 0) }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 border" style={{ backgroundColor: COLORS_DOC.VERT, borderColor: COLORS_DOC.GRIS_LIGNE }}>
                        {soumission.inclusions?.[i] || ""}
                      </td>
                      <td className="px-2 py-1 border" style={{ backgroundColor: soumission.exclusions?.[i] ? COLORS_DOC.ROUGE_CLAIR : "#FFFFFF", borderColor: COLORS_DOC.GRIS_LIGNE }}>
                        {soumission.exclusions?.[i] || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}



        {/* ===== SOMMAIRE FINANCIER (À LA FIN) ===== */}
        <div className="page-break" />
        <div className="p-6 space-y-3" style={{ backgroundColor: "white", position: "relative", zIndex: 1 }}>
          <h2 className="text-lg font-bold" style={{ color: COLORS_DOC.GRIS_FONCE }}>Sommaire financier</h2>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: COLORS_DOC.GRIS_FONCE }}>
                <th className="px-2 py-1.5 text-left text-white font-medium">Phase</th>
                <th className="px-2 py-1.5 text-left text-white font-medium">Description</th>
                <th className="px-2 py-1.5 text-right text-white font-medium">CD</th>
                <th className="px-2 py-1.5 text-right text-white font-medium">{`OH ${ohRate * 100}%`}</th>
                <th className="px-2 py-1.5 text-right text-white font-medium">{`Impr. ${tauxImprevuPct}%`}</th>
                <th className="px-2 py-1.5 text-right text-white font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {(totaux.phaseDetails || []).map((phase, i) => {
                const oh = phase.cd * ohRate
                const imp = phase.cd * imprevusRate
                const ht = phase.cd + oh + imp
                return (
                  <tr key={phase.code} style={{ backgroundColor: i % 2 === 0 ? COLORS_DOC.GRIS_CLAIR : "#FFFFFF" }}>
                    <td className="px-2 py-1 border font-medium" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{phase.code}</td>
                    <td className="px-2 py-1 border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{phase.nom}</td>
                    <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(phase.cd)}</td>
                    <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(oh)}</td>
                    <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(imp)}</td>
                    <td className="px-2 py-1 text-right border font-medium" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(ht)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: COLORS_DOC.JAUNE }}>
                <td className="px-2 py-1.5 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }} colSpan={2}>SOUS-TOTAL</td>
                <td className="px-2 py-1.5 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.totalCD)}</td>
                <td className="px-2 py-1.5 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.fg)}</td>
                <td className="px-2 py-1.5 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.imprevus)}</td>
                <td className="px-2 py-1.5 text-right font-bold border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.totalHT)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Taxes */}
          <div className="flex justify-end">
            <table className="text-xs border-collapse w-56">
              <tbody>
                <tr>
                  <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>Sous-total HT</td>
                  <td className="px-2 py-1 text-right border font-medium" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.totalHT)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>TPS (5%)</td>
                  <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.tps)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>TVQ (9,975%)</td>
                  <td className="px-2 py-1 text-right border" style={{ borderColor: COLORS_DOC.GRIS_LIGNE }}>{fmt(totaux.tvq)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1.5 text-right font-bold text-white text-sm border" style={{ backgroundColor: COLORS_DOC.ORANGE, borderColor: COLORS_DOC.ORANGE }}>TOTAL TTC</td>
                  <td className="px-2 py-1.5 text-right font-bold text-white text-sm border" style={{ backgroundColor: COLORS_DOC.ORANGE, borderColor: COLORS_DOC.ORANGE }}>{fmt(totaux.totalTTC)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Modalites */}
          <div className="mt-3">
            <h3 className="text-sm font-bold mb-1" style={{ color: COLORS_DOC.GRIS_FONCE }}>Modalites de paiement</h3>
            <EditableText
              value={docFields.modalites}
              onChange={v => updateField("modalites", v)}
              tag="p"
              className="text-xs leading-relaxed"
            />
          </div>
        </div>

        {/* ===== ACCEPTATION & SIGNATURES ===== */}
        <div className="page-break" />
        <div className="p-6 space-y-3" style={{ backgroundColor: "white", position: "relative", zIndex: 1 }}>
          <h2 className="text-lg font-bold" style={{ color: COLORS_DOC.GRIS_FONCE }}>Acceptation</h2>
          <EditableText
            value={docFields.conditions}
            onChange={v => updateField("conditions", v)}
            tag="p"
            className="text-xs leading-relaxed"
          />
          <EditableText
            value={docFields.validite}
            onChange={v => updateField("validite", v)}
            tag="p"
            className="text-xs leading-relaxed"
          />

          {/* Total banner */}
          <div className="text-center py-3 rounded-lg" style={{ backgroundColor: COLORS_DOC.ORANGE }}>
            <span className="text-white font-bold text-sm mr-2">TOTAL TTC</span>
            <span className="text-white font-bold text-2xl">{fmt(totaux.totalTTC)}</span>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-3">
            <div>
              <p className="text-xs font-bold" style={{ color: COLORS_DOC.GRIS_FONCE }}>ENTREPRENEUR</p>
              <p className="text-xs mt-0.5">{docFields.entreprise}</p>
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>{`RBQ: ${docFields.rbq}`}</p>
              <div className="mt-6 border-b border-gray-400 mb-0.5" />
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>Signature</p>
              <div className="mt-3 border-b border-gray-400 mb-0.5" />
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>Date</p>
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: COLORS_DOC.GRIS_FONCE }}>CLIENT</p>
              <p className="text-xs mt-0.5">{soumission.projet.client || "Client"}</p>
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>{soumission.projet.adresse || ""}</p>
              <div className="mt-6 border-b border-gray-400 mb-0.5" />
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>Signature</p>
              <div className="mt-3 border-b border-gray-400 mb-0.5" />
              <p className="text-xs" style={{ color: COLORS_DOC.GRIS_MOYEN }}>Date</p>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
    </>
  )
}

// ============================================================================
// SOMMAIRE CLIENT VIEW (inline view, not modal)
// ============================================================================
function SommaireClientView({
  soumission,
  descriptions,
  setDescriptions,
  notes,
  setNotes,
  isGenerating,
  onRegenerate,
  docFields,
  updateField,
  totaux,
  ohRate,
  imprevusRate,
  tauxImprevuPct,
  exportSommaireHTML,
  isExporting,
}: {
  soumission: Soumission
  descriptions: Record<string, string>
  setDescriptions: (d: Record<string, string>) => void
  notes: string
  setNotes: (n: string) => void
  isGenerating: boolean
  onRegenerate: () => void
  docFields: { entreprise: string; rbq: string }
  updateField: (field: string, value: string) => void
  totaux: { totalMateriaux: number; totalMO: number; totalCD: number }
  ohRate: number
  imprevusRate: number
  tauxImprevuPct: number
  exportSommaireHTML: (fields?: any) => Promise<void>
  isExporting: boolean
}) {
  const fmtH = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
  
  // Calculate totals
  const grandTotalCD = totaux.totalCD
  const oh = grandTotalCD * ohRate
  const imp = grandTotalCD * imprevusRate
  const totalHT = grandTotalCD + oh + imp
  const tps = totalHT * 0.05
  const tvq = totalHT * 0.09975
  const totalTTC = totalHT + tps + tvq

  // Get divisions with items
  const divisions = useMemo(() => {
    const divs: Array<{ code: string; nom: string; totalMat: number; totalMO: number; total: number }> = []
    for (const phase of soumission.phases || []) {
      for (const division of phase.divisions || []) {
        const matItems = division.items.filter(it => it.type !== "MO")
        const moItems = division.items.filter(it => it.type === "MO")
        const totalMat = matItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
        const totalMO = moItems.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
        const total = totalMat + totalMO
        if (total > 0) {
          divs.push({
            code: division.code,
            nom: DIVISIONS_MASTERFORMAT[division.code] || division.nom,
            totalMat,
            totalMO,
            total,
          })
        }
      }
    }
    return divs
  }, [soumission])

  const updateDescription = (code: string, desc: string) => {
    setDescriptions({ ...descriptions, [code]: desc })
  }

  const handleExport = async () => {
    const fields = {
      projectName: soumission.projet.nom || "Soumission",
      client: soumission.projet.client || "",
      adresse: soumission.projet.adresse || "",
      dateStr: soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA"),
      validite: soumission.projet.validite_jours || 30,
      entreprise: docFields.entreprise,
      rbq: docFields.rbq,
      notes,
      divisionDescriptions: descriptions,
    }
    await exportSommaireHTML(fields)
  }

  return (
    <div className="max-w-[210mm] mx-auto bg-white shadow-xl rounded" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "120px",
          overflow: "hidden",
          borderRadius: "6px 6px 0 0",
          background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0ea5e9 100%)",
        }}
      >
        <img
          src="/images/soumission-header.jpg"
          alt="Photo de chantier"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
          crossOrigin="anonymous"
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 20px" }}>
          <div className="flex items-center gap-2">
            <h2 style={{ fontSize: "20pt", fontWeight: "bold", color: "white", letterSpacing: "0.02em" }}>SOMMAIRE</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: "#F47920", color: "white" }}>
              VERSION CLIENT
            </span>
          </div>
          <p style={{ fontSize: "13pt", color: "rgba(255,255,255,0.95)", marginTop: "4px" }}>{soumission.projet.nom}</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Company & Project Info */}
        <div className="flex justify-between items-start pb-3 border-b-3" style={{ borderColor: "#F47920" }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F47920" }}>
              <span className="text-white font-bold text-lg">{docFields.entreprise.charAt(0)}</span>
            </div>
            <div>
              <p className="font-bold text-base">{docFields.entreprise}</p>
              <p className="text-xs text-gray-500">RBQ: {docFields.rbq}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA")}</p>
            <p className="text-gray-500 text-xs">Valide {soumission.projet.validite_jours || 30} jours</p>
          </div>
        </div>

        {/* Project Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-gray-500 text-xs font-medium">Client</p>
            <p className="font-semibold">{soumission.projet.client || "Non specifie"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-xs font-medium">Adresse du chantier</p>
            <p className="font-semibold">{soumission.projet.adresse || "Non specifie"}</p>
          </div>
        </div>

        {/* Regenerate button */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: "#2D3748" }}>
            Description des travaux
          </h3>
          <Button
            onClick={onRegenerate}
            disabled={isGenerating}
            size="sm"
            variant="outline"
            className="gap-2 text-xs"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {isGenerating ? "Generation..." : "Regenerer avec IA"}
          </Button>
        </div>

        {/* Divisions with editable descriptions */}
        <div className="space-y-4">
          {divisions.map(div => (
            <div key={div.code} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: "#2F5496" }}>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{div.code}</span>
                  <span className="text-white text-sm">{div.nom}</span>
                </div>
                <span className="text-white font-bold text-sm">{fmtH(div.total)}</span>
              </div>
              <div className="p-3 bg-gray-50">
                <Textarea
                  value={descriptions[div.code] || ""}
                  onChange={e => updateDescription(div.code, e.target.value)}
                  placeholder={isGenerating ? "Generation en cours..." : "Decrivez les travaux pour cette division..."}
                  className="w-full text-sm min-h-[70px] resize-y border-gray-200 focus:border-blue-400"
                  disabled={isGenerating}
                />
                <div className="flex justify-end gap-4 mt-2 text-xs text-gray-500">
                  <span>Mat: {fmtH(div.totalMat)}</span>
                  <span>MO: {fmtH(div.totalMO)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Inclusions / Exclusions */}
        {((soumission.inclusions?.length || 0) > 0 || (soumission.exclusions?.length || 0) > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg overflow-hidden border">
              <div className="px-3 py-2 text-white font-semibold text-sm" style={{ backgroundColor: "#166534" }}>
                Ce qui est inclus
              </div>
              <div className="p-3 space-y-1.5" style={{ backgroundColor: "#dcfce7" }}>
                {(soumission.inclusions || []).map((item, i) => (
                  <p key={i} className="text-sm flex items-start gap-2">
                    <span className="text-green-700 font-bold">✓</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border">
              <div className="px-3 py-2 text-white font-semibold text-sm" style={{ backgroundColor: "#991b1b" }}>
                Non inclus
              </div>
              <div className="p-3 space-y-1.5" style={{ backgroundColor: "#fee2e2" }}>
                {(soumission.exclusions || []).map((item, i) => (
                  <p key={i} className="text-sm flex items-start gap-2">
                    <span className="text-red-700 font-bold">✗</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Notes pour le client</h3>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ajoutez des notes ou precisions importantes pour le client..."
            className="w-full text-sm min-h-[60px] resize-y"
          />
        </div>

        {/* Financial Summary */}
        <div className="rounded-lg overflow-hidden border">
          <div className="px-4 py-2 font-semibold text-sm" style={{ backgroundColor: "#F47920", color: "white" }}>
            Votre investissement
          </div>
          <div className="p-4">
            <div className="flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span>Couts directs</span><span>{fmtH(grandTotalCD)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Frais de gestion ({Math.round(ohRate*100)}%)</span><span>{fmtH(oh)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Contingence ({tauxImprevuPct}%)</span><span>{fmtH(imp)}</span></div>
                <div className="flex justify-between font-semibold pt-1 border-t"><span>Sous-total HT</span><span>{fmtH(totalHT)}</span></div>
                <div className="flex justify-between text-gray-600"><span>TPS (5%)</span><span>{fmtH(tps)}</span></div>
                <div className="flex justify-between text-gray-600"><span>TVQ (9,975%)</span><span>{fmtH(tvq)}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Total Box */}
        <div className="rounded-lg p-5 text-center" style={{ backgroundColor: "#1e3a8a" }}>
          <p className="text-white text-sm opacity-90 mb-1">MONTANT TOTAL (taxes incluses)</p>
          <p className="text-white text-3xl font-bold">{fmtH(totalTTC)}</p>
        </div>

        {/* Export Button */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 px-6"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Telecharger le sommaire (HTML)
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SOMMAIRE PREVIEW MODAL (deprecated - kept for backwards compatibility)
// ============================================================================
function SommairePreviewModal({
  open,
  onOpenChange,
  soumission,
  buildSommaireHTML,
  exportSommaireHTML,
  isExporting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  soumission: Soumission
  buildSommaireHTML: (fields: any, headerBg: string) => string
  exportSommaireHTML: (fields?: any) => Promise<void>
  isExporting: boolean
}) {
  // Editable fields state
  const [projectName, setProjectName] = useState(soumission.projet.nom || "Soumission")
  const [client, setClient] = useState(soumission.projet.client || "")
  const [adresse, setAdresse] = useState(soumission.projet.adresse || "")
  const [dateStr, setDateStr] = useState(soumission.projet.date_soumission || new Date().toLocaleDateString("fr-CA"))
  const [validite, setValidite] = useState(soumission.projet.validite_jours || 30)
  const [entreprise, setEntreprise] = useState(soumission.projet.entreprise || "Mon Entreprise")
  const [rbq, setRbq] = useState(soumission.projet.rbq || "")
  const [notes, setNotes] = useState("")
  const [divisionDescriptions, setDivisionDescriptions] = useState<Record<string, string>>({})
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Get all divisions with items
  const divisions = useMemo(() => {
    const divs: Array<{ code: string; nom: string; itemCount: number }> = []
    for (const phase of soumission.phases || []) {
      for (const division of phase.divisions || []) {
        const totalItems = division.items.reduce((s, it) => s + it.quantite * it.prix_unitaire, 0)
        if (totalItems > 0) {
          divs.push({
            code: division.code,
            nom: DIVISIONS_MASTERFORMAT[division.code] || division.nom,
            itemCount: division.items.length,
          })
        }
      }
    }
    return divs
  }, [soumission])

  // Build preview HTML
  const previewHTML = useMemo(() => {
    const fields = {
      projectName,
      client,
      adresse,
      dateStr,
      validite,
      entreprise,
      rbq,
      notes,
      divisionDescriptions,
    }
    const headerBg = "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0ea5e9 100%)"
    return buildSommaireHTML(fields, headerBg)
  }, [projectName, client, adresse, dateStr, validite, entreprise, rbq, notes, divisionDescriptions, buildSommaireHTML])

  // Update iframe when preview changes
  useEffect(() => {
    if (iframeRef.current && open) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(previewHTML)
        doc.close()
      }
    }
  }, [previewHTML, open])

  // Handle export
  const handleExport = async () => {
    const fields = {
      projectName,
      client,
      adresse,
      dateStr,
      validite,
      entreprise,
      rbq,
      notes,
      divisionDescriptions,
    }
    await exportSommaireHTML(fields)
  }

  // Handle print directly
  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.print()
    }
  }

  const updateDivisionDesc = (code: string, desc: string) => {
    setDivisionDescriptions(prev => ({ ...prev, [code]: desc }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Apercu du sommaire client</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Telecharger HTML
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Editable Fields */}
          <div className="w-[380px] border-r bg-gray-50 overflow-y-auto p-4 space-y-4 shrink-0">
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-900">Informations du projet</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Nom du projet</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Client</label>
                <input
                  type="text"
                  value={client}
                  onChange={e => setClient(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom du client"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Adresse du chantier</label>
                <input
                  type="text"
                  value={adresse}
                  onChange={e => setAdresse(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adresse"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Date</label>
                  <input
                    type="text"
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Validite (jours)</label>
                  <input
                    type="number"
                    value={validite}
                    onChange={e => setValidite(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-900">Votre entreprise</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={entreprise}
                  onChange={e => setEntreprise(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Numero RBQ</label>
                <input
                  type="text"
                  value={rbq}
                  onChange={e => setRbq(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234-5678-01"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-900">Description par division</h3>
              <p className="text-xs text-gray-500">Personnalisez la description des travaux pour chaque division. Laissez vide pour utiliser la description auto.</p>
              
              {divisions.map(div => (
                <div key={div.code} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    {div.code} - {div.nom}
                  </label>
                  <Textarea
                    value={divisionDescriptions[div.code] || ""}
                    onChange={e => updateDivisionDesc(div.code, e.target.value)}
                    className="w-full text-sm min-h-[60px] resize-y"
                    placeholder={`Description des travaux pour ${div.nom}...`}
                  />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-900">Notes pour le client</h3>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-sm min-h-[80px] resize-y"
                placeholder="Ajoutez des notes ou instructions importantes pour le client..."
              />
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="flex-1 bg-gray-200 overflow-hidden">
            <iframe
              ref={iframeRef}
              title="Apercu sommaire"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// NO DATA VIEW
// ============================================================================
function NoDataView({
  type,
  hasMarkdownContent = false,
  onGenerate,
  isParsing = false,
  parseError,
}: {
  type: string
  hasMarkdownContent?: boolean
  onGenerate?: () => void
  isParsing?: boolean
  parseError?: string | null
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Table2 className="h-8 w-8 text-gray-400" />
      </div>

      {hasMarkdownContent ? (
        <>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Soumission detectee dans la conversation</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Des tableaux de soumission ont ete trouves dans les messages. Cliquez ci-dessous pour les extraire et generer la vue {type}.
          </p>
          <Button
            onClick={onGenerate}
            disabled={isParsing}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extraction en cours...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Generer le tableau
              </>
            )}
          </Button>
          {parseError && (
            <p className="text-sm text-red-500 mt-3 max-w-sm">{parseError}</p>
          )}
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Aucune donnee disponible</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {`Pour voir la vue ${type}, l'agent doit d'abord generer une soumission structuree dans la conversation.`}
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================
export type ViewTab = "chat" | "tableur" | "soumission"

type SoumissionVersion = {
  id: string
  created_at: string
  updated_at: string
  status: string
  data: Soumission
}

export function ConversationViewContent({
  activeView,
  messages,
  conversationId,
  onViewChange,
}: {
  activeView: ViewTab
  messages: Message[]
  conversationId?: string | null
  onViewChange?: (view: ViewTab) => void
}) {
  const jsonSoumission = useMemo(() => extractSoumissionJSON(messages), [messages])
  const [parsedSoumission, setParsedSoumission] = useState<Soumission | null>(null)
  // Track whether user explicitly triggered a parse - prevents baseSoumission effect from overwriting
  const hasParsedManually = React.useRef(false)
  const [versions, setVersions] = useState<SoumissionVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [editedSoumission, setEditedSoumission] = useState<Soumission | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseReport, setParseReport] = useState<{
    totalItems: number; totalDivisions: number; coutsDirect: number;
    divisions: Array<{ code: string; nom: string; items: number; total: number }>
  } | null>(null)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [showVersionList, setShowVersionList] = useState(false)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved versions from DB on mount
  React.useEffect(() => {
    if (!conversationId) return
    // Reset manual parse flag when switching conversation
    hasParsedManually.current = false
    let cancelled = false
    const loadSaved = async () => {
      setIsLoadingSaved(true)
      try {
        const res = await fetch(`/api/soumissions?conversationId=${conversationId}`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled && json.soumissions?.length > 0) {
            setVersions(json.soumissions)
            setActiveVersionId(json.soumissions[0].id)
          }
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoadingSaved(false)
      }
    }
    loadSaved()
    return () => { cancelled = true }
  }, [conversationId])

  // Get the data for the currently selected version
  const savedSoumission = useMemo(() => {
    if (!activeVersionId || versions.length === 0) return null
    const found = versions.find(v => v.id === activeVersionId)
    return (found?.data as Soumission) || (versions[0]?.data as Soumission) || null
  }, [versions, activeVersionId])

  // Priority: saved from DB first (most reliable), then manually parsed, then inline JSON from messages
  // jsonSoumission (inline) has lowest priority because it may be partial/empty during streaming
  const baseSoumission = savedSoumission || parsedSoumission || jsonSoumission
  const soumission = editedSoumission || baseSoumission

  // When baseSoumission changes from DB/external source, sync editedSoumission
  // BUT skip if user already manually parsed (hasParsedManually) to avoid overwriting their result
  React.useEffect(() => {
    if (baseSoumission && !hasParsedManually.current) {
      setEditedSoumission(deepClone(baseSoumission))
    }
  }, [baseSoumission])

  // Auto-save to DB (debounced, upserts latest draft)
  const saveSoumission = React.useCallback(async (data: Soumission) => {
    if (!conversationId) return
    setSaveStatus("saving")
    try {
      const res = await fetch("/api/soumissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, soumission: data, status: "brouillon" }),
      })
      if (res.ok) {
        const result = await res.json()
        setVersions(prev => {
          const idx = prev.findIndex(v => v.id === result.soumission.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = result.soumission
            return updated
          }
          return [result.soumission, ...prev]
        })
        if (!activeVersionId) setActiveVersionId(result.soumission.id)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2000)
      } else {
        setSaveStatus("error")
      }
    } catch {
      setSaveStatus("error")
    }
  }, [conversationId, activeVersionId])

  // Save as a NEW version (creates a new DB row)
  const saveAsNewVersion = React.useCallback(async () => {
    if (!conversationId || !soumission) return
    setSaveStatus("saving")
    try {
      const res = await fetch("/api/soumissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, soumission, status: "brouillon", newVersion: true }),
      })
      if (res.ok) {
        const result = await res.json()
        setVersions(prev => [result.soumission, ...prev])
        setActiveVersionId(result.soumission.id)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2000)
      } else {
        setSaveStatus("error")
      }
    } catch {
      setSaveStatus("error")
    }
  }, [conversationId, soumission])

  // Handler for child edits -- debounced auto-save
  const handleSoumissionChange = React.useCallback((updated: Soumission) => {
    setEditedSoumission(updated)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveSoumission(updated)
    }, 1500)
  }, [saveSoumission])

  // Switch to a different version
  const switchVersion = React.useCallback((versionId: string) => {
    setActiveVersionId(versionId)
    const v = versions.find(ver => ver.id === versionId)
    if (v?.data) setEditedSoumission(deepClone(v.data as Soumission))
    setShowVersionList(false)
  }, [versions])

  // Check if messages have markdown content that can be parsed
  const hasMarkdownContent = useMemo(() => {
    return messages.some(m => {
      const c = m.content
      const hasTable = c.includes("|") && c.includes("---")
      const hasDivisions = /Division\s+\d{2}/i.test(c)
      const hasKeywords = /soumission|estimation|devis|relev|TOTAL PAYABLE/i.test(c)
      return (hasTable || hasDivisions) && hasKeywords
    })
  }, [messages])

  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
  
  // Actual parse logic
  const doParseFromMarkdown = useCallback(async (asNewVersion: boolean) => {
    setIsParsing(true)
    setParseError(null)
    setShowOverwriteDialog(false)
    try {
      const content = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n")
      const response = await fetch("/api/export/parse-soumission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      if (!response.ok) {
        setParseError(data.error || "Erreur lors du parsing")
        return
      }
      // Mark as manually parsed BEFORE setting state, so the baseSoumission useEffect is skipped
      hasParsedManually.current = true
      setParsedSoumission(data.soumission)
      setEditedSoumission(deepClone(data.soumission))
      if (data.report) setParseReport(data.report)
      // Save: either overwrite current version or create new
      if (conversationId && data.soumission) {
        if (asNewVersion && versions.length > 0) {
          // Save as new version
          try {
            const res = await fetch("/api/soumissions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId, soumission: data.soumission, status: "brouillon", newVersion: true }),
            })
            if (res.ok) {
              const result = await res.json()
              setVersions(prev => [result.soumission, ...prev])
              setActiveVersionId(result.soumission.id)
            }
          } catch { /* silent */ }
        } else {
          saveSoumission(data.soumission)
        }
      }
      
      if (onViewChange) {
        onViewChange("tableur")
      }
    } catch {
      setParseError("Erreur de connexion au serveur")
    } finally {
      setIsParsing(false)
    }
  }, [messages, conversationId, saveSoumission, onViewChange, versions])

  // AI-based parsing fallback
  const doParseWithAI = useCallback(async () => {
    setIsParsing(true)
    setParseError(null)
    try {
      const content = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n")
      const response = await fetch("/api/export/parse-soumission-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      if (!response.ok) {
        setParseError(data.error || "Erreur lors du parsing AI")
        return
      }
      hasParsedManually.current = true
      setParsedSoumission(data.soumission)
      setEditedSoumission(deepClone(data.soumission))
      if (data.report) setParseReport(data.report)
      // Save automatically
      if (conversationId && data.soumission) {
        saveSoumission(data.soumission)
      }
      if (onViewChange) {
        onViewChange("tableur")
      }
    } catch {
      setParseError("Erreur de connexion au serveur AI")
    } finally {
      setIsParsing(false)
    }
  }, [messages, conversationId, saveSoumission, onViewChange])

  // Parse from markdown - check if version exists first
  const generateFromMarkdown = useCallback(async () => {
    if (versions.length > 0) {
      // A version already exists - ask user what to do
      setShowOverwriteDialog(true)
      return
    }
    doParseFromMarkdown(false)
  }, [versions, doParseFromMarkdown])

  if (activeView === "chat") return null

  // Overwrite dialog
  const overwriteDialog = showOverwriteDialog ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4">
        <h3 className="text-base font-bold text-gray-900 mb-2">Un tableau existe deja</h3>
        <p className="text-sm text-gray-600 mb-5">
          {"Une version du tableau de soumission existe deja. Voulez-vous la remplacer ou creer une nouvelle version?"}
        </p>
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOverwriteDialog(false)}
            className="bg-transparent"
          >
            Annuler
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => doParseFromMarkdown(false)}
            className="bg-transparent text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            Ecraser
          </Button>
          <Button
            size="sm"
            onClick={() => doParseFromMarkdown(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Nouvelle version
          </Button>
        </div>
      </div>
    </div>
  ) : null

  if (isLoadingSaved) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        <span className="ml-2 text-sm text-gray-500">Chargement de la soumission...</span>
      </div>
    )
  }

  if (!soumission) {
    return (
      <>
        {overwriteDialog}
        <NoDataView
          type={activeView}
          hasMarkdownContent={hasMarkdownContent}
          onGenerate={generateFromMarkdown}
          isParsing={isParsing}
          parseError={parseError}
        />
      </>
    )
  }

  const versionBar = (
    <VersionToolbar
      versions={versions}
      activeVersionId={activeVersionId}
      showVersionList={showVersionList}
      setShowVersionList={setShowVersionList}
      switchVersion={switchVersion}
      saveAsNewVersion={saveAsNewVersion}
      saveStatus={saveStatus}
      soumission={soumission}
      onRegenerate={hasMarkdownContent ? generateFromMarkdown : undefined}
      isRegenerating={isParsing}
      onParseWithAI={hasMarkdownContent ? doParseWithAI : undefined}
      isParsingAI={isParsing}
    />
  )

  const reportBanner = parseReport ? (
    <div className="mx-4 mt-2 mb-1 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-blue-800">
          Extraction: {parseReport.totalItems} postes dans {parseReport.totalDivisions} divisions
        </span>
        <button onClick={() => setParseReport(null)} className="text-blue-400 hover:text-blue-600 ml-2">x</button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-blue-700">
        {parseReport.divisions.map(d => (
          <span key={d.code}>Div.{d.code}: {d.items} postes = {d.total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
        ))}
      </div>
      <div className="mt-1 font-semibold text-blue-900">
        {"Couts directs: " + parseReport.coutsDirect.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
      </div>
    </div>
  ) : null

  if (activeView === "tableur") return (
    <div className="flex flex-col h-full overflow-hidden">
      {overwriteDialog}
      {versionBar}
      {reportBanner}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <TableurView soumission={soumission} onSoumissionChange={handleSoumissionChange} />
      </div>
    </div>
  )
  if (activeView === "soumission") return (
    <div className="flex flex-col h-full">
      {overwriteDialog}
      {versionBar}
      <div className="flex-1 min-h-0 overflow-auto">
        <SoumissionWordView soumission={soumission} onSoumissionChange={handleSoumissionChange} messages={messages} />
      </div>
    </div>
  )

  return null
}

// ============================================================================
// VERSION TOOLBAR
// ============================================================================
function VersionToolbar({
  versions,
  activeVersionId,
  showVersionList,
  setShowVersionList,
  switchVersion,
  saveAsNewVersion,
  saveStatus,
  soumission,
  onRegenerate,
  isRegenerating = false,
  onParseWithAI,
  isParsingAI = false,
}: {
  versions: SoumissionVersion[]
  activeVersionId: string | null
  showVersionList: boolean
  setShowVersionList: (v: boolean) => void
  switchVersion: (id: string) => void
  saveAsNewVersion: () => void
  saveStatus: "idle" | "saving" | "saved" | "error"
  soumission?: Soumission | null
  onRegenerate?: () => void
  isRegenerating?: boolean
  onParseWithAI?: () => void
  isParsingAI?: boolean
}) {
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const versionLabel = versions.length > 0 
    ? `v${versions.length - versions.findIndex(v => v.id === activeVersionId)}`
    : "v1"

  const handleExportExcel = async () => {
    if (!soumission) return
    setIsExportingExcel(true)
    try {
      const response = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(soumission),
      })
      if (!response.ok) throw new Error("Erreur export")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = response.headers.get("Content-Disposition")
      a.download = disposition?.match(/filename="(.+)"/)?.[1] || "soumission.xlsx"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export Excel error:", err)
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
      <div className="flex items-center gap-2">
        {/* Version selector */}
        <div className="relative">
          <button
            onClick={() => setShowVersionList(!showVersionList)}
            className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition-colors"
          >
            <Clock className="h-3 w-3" />
            <span>{versionLabel}</span>
            {versions.length > 1 && <ChevronDown className="h-3 w-3" />}
          </button>
          {showVersionList && versions.length > 1 && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowVersionList(false)} />
              <div className="absolute top-full left-0 mt-1 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[260px] max-h-60 overflow-y-auto">
                {versions.map((v, i) => {
                  const isActive = v.id === activeVersionId
                  const vNum = versions.length - i
                  return (
                    <button
                      key={v.id}
                      onClick={() => switchVersion(v.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between ${isActive ? "bg-orange-50 text-orange-700" : "text-gray-600"}`}
                    >
                      <div>
                        <span className="font-medium">{`Version ${vNum}`}</span>
                        <span className="ml-2 text-gray-400">{v.status}</span>
                      </div>
                      <span className="text-gray-400">{fmtDate(v.updated_at || v.created_at)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {versions.length > 0 && (
          <span className="text-xs text-gray-400">{`${versions.length} version${versions.length > 1 ? "s" : ""}`}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Save status indicator */}
        {saveStatus !== "idle" && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${saveStatus === "saving" ? "bg-orange-100 text-orange-600" : saveStatus === "saved" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
            {saveStatus === "saving" ? "Sauvegarde..." : saveStatus === "saved" ? "Sauvegarde" : "Erreur"}
          </span>
        )}
        {/* Export Excel */}
        {soumission && (
          <Button size="sm" variant="outline" onClick={handleExportExcel} className="h-7 text-xs gap-1 bg-transparent" disabled={isExportingExcel}>
            {isExportingExcel ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
            Excel
          </Button>
        )}
        {/* Regenerate from conversation */}
        {onRegenerate && (
          <Button size="sm" variant="outline" onClick={onRegenerate} className="h-7 text-xs gap-1 bg-transparent" disabled={isRegenerating || isParsingAI}>
            {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Table2 className="h-3 w-3" />}
            Re-generer
          </Button>
        )}
        {/* Parse with AI fallback */}
        {onParseWithAI && (
          <Button size="sm" variant="outline" onClick={onParseWithAI} className="h-7 text-xs gap-1 bg-transparent text-blue-600 border-blue-200 hover:bg-blue-50" disabled={isParsingAI || isRegenerating}>
            {isParsingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Parser AI
          </Button>
        )}
        {/* New version button */}
        <Button size="sm" variant="outline" onClick={saveAsNewVersion} className="h-7 text-xs gap-1 bg-transparent" disabled={saveStatus === "saving"}>
          <Save className="h-3 w-3" />
          Nouvelle version
        </Button>
      </div>
    </div>
  )
}

export function ViewTabsBar({
  activeView,
  onViewChange,
  hasData,
}: {
  activeView: ViewTab
  onViewChange: (view: ViewTab) => void
  hasData: boolean
}) {
  const tabs: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
    { key: "chat", label: "Chat", icon: <MessageSquareIcon className="h-3.5 w-3.5" /> },
    { key: "tableur", label: "Tableur", icon: <Table2 className="h-3.5 w-3.5" /> },
    { key: "soumission", label: "Soumission", icon: <FileText className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {tabs.map(tab => {
        const isActive = activeView === tab.key
        const isDisabled = tab.key !== "chat" && !hasData
        return (
          <button
            key={tab.key}
            onClick={() => !isDisabled && onViewChange(tab.key)}
            disabled={isDisabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              isActive ? "bg-white text-gray-900 shadow-sm" : isDisabled ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Exported wrapper for inline use in markdown messages
export function InlineTableurView({
  soumission,
  onSoumissionChange,
}: {
  soumission: Soumission
  onSoumissionChange?: (s: Soumission) => void
}) {
  return <TableurView soumission={soumission} onSoumissionChange={onSoumissionChange} />
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
