"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Download, FileSpreadsheet, Loader2, Table2, X } from "lucide-react"
import { InteractiveQuestionForm } from "./interactive-question-form"
import { useState, lazy, Suspense } from "react"
import type { Soumission } from "@/types/soumission"

// Lazy load the heavy TableurView only when needed
const InlineTableur = lazy(() => import("./conversation-views").then(m => ({ default: m.InlineTableurView })))

interface MarkdownMessageProps {
  content: string
  messageId: string
  onQuestionSubmit?: (answers: Record<string, string>) => void
  onNavigateTableur?: () => void
  userId?: string
}

// Extraire le bloc JSON de soumission du contenu
function extractSoumissionJSON(content: string): Soumission | null {
  const jsonBlockRegex = /```(?:json:soumission|json)\s*\n([\s\S]*?)\n```/g
  let match
  
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.projet && parsed.phases) {
        return parsed as Soumission
      }
    } catch {
      // Continue
    }
  }
  
  return null
}

// Nettoyer le contenu pour l'affichage (enlever le bloc JSON)
function cleanContentForDisplay(content: string): string {
  return content.replace(/```json:soumission\s*\n[\s\S]*?\n```/g, '').trim()
}

export function MarkdownMessage({ content, messageId, onQuestionSubmit, onNavigateTableur, userId }: MarkdownMessageProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [inlineSoumission, setInlineSoumission] = useState<Soumission | null>(null)
  const [showTableur, setShowTableur] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  
  const hasTable = content.includes("|") && content.includes("---")
  const hasKeywords = /relevé de quantité|soumission|estimation|devis|division\s+\d{2}/i.test(content)
  const soumissionJSON = extractSoumissionJSON(content)
  const showExportButtons = (hasTable && hasKeywords) || soumissionJSON

  // Check for questions in various formats:
  // - Table format with pipes: "| q-1 | Question | a) Option |"
  // - Tab-separated table: "q-1\tQuestion\tOption1 / Option2"
  // - List format with options: "q-1. Question" followed by "a) Option"
  // - Slash-separated options: "Option1 / Option2 / Option3"
  const hasTableQuestions = /q-?\d+/i.test(content) && /\|\s*[a-z]\)/i.test(content)
  const hasTabSeparatedTable = /q-?\d+\t/i.test(content)
  const hasListQuestions = /q-?\d+\.?\s*\|/i.test(content)
  const hasSimpleQuestions = /q-?\d+\.?\s+/i.test(content) && /[a-z]\)\s+/i.test(content)
  const hasSlashSeparatedOptions = /q-?\d+/i.test(content) && /\w+\s*\/\s*\w+\s*\/\s*\w+/i.test(content)
  const hasQuestions = hasTableQuestions || hasTabSeparatedTable || hasListQuestions || hasSimpleQuestions || hasSlashSeparatedOptions
  
  const displayContent = soumissionJSON ? cleanContentForDisplay(content) : content

  // Navigate to tableur tab (triggers parse from ConversationViewContent)
  const generateTableur = async () => {
    if (onNavigateTableur) {
      onNavigateTableur()
      return
    }
    // Fallback: inline tableur if no navigation callback
    setIsGenerating(true)
    setParseError(null)
    try {
      if (soumissionJSON) {
        setInlineSoumission(soumissionJSON)
        setShowTableur(true)
        return
      }

      const response = await fetch("/api/export/parse-soumission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Impossible d'extraire la soumission")
      }

      const { soumission } = await response.json()
      setInlineSoumission(soumission)
      setShowTableur(true)
    } catch (error) {
      console.error("Error generating tableur:", error)
      setParseError(error instanceof Error ? error.message : "Erreur inconnue")
    } finally {
      setIsGenerating(false)
    }
  }

  const exportToExcel = async () => {
    setIsExporting(true)
    try {
      const soumissionData = inlineSoumission || soumissionJSON
      
      const response = await fetch("/api/export/soumission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          soumissionData 
            ? { soumission: soumissionData, userId }
            : { content, messageId, userId }
        ),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      const disposition = response.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.download = filenameMatch ? filenameMatch[1] : `soumission-${messageId}.xlsx`
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      alert(`Erreur lors de l'export: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const exportToPDF = async () => {
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, messageId }),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `soumission-${messageId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error exporting to PDF:", error)
      alert("Erreur lors de l'export PDF")
    }
  }

  return (
    <div className="space-y-3 w-full flex flex-col">
      <div className="prose prose-sm max-w-none dark:prose-invert my-0 text-left">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4 -mx-2 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props} />
              </div>
            ),
            thead: ({ node, ...props }) => <thead className="bg-muted" {...props} />,
            tbody: ({ node, ...props }) => <tbody className="divide-y divide-gray-200" {...props} />,
            tr: ({ node, isHeader, ...props }: any) => <tr className="hover:bg-muted/50" {...props} />,
            th: ({ node, isHeader, ...props }: any) => (
              <th
                className="px-4 py-2 text-left text-xs font-medium text-foreground uppercase tracking-wider"
                {...props}
              />
            ),
            td: ({ node, isHeader, ...props }: any) => <td className="px-4 py-2 text-sm text-foreground" {...props} />,
            h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
            p: ({ node, ...props }) => <p className="my-2 leading-relaxed" {...props} />,
            ul: ({ node, ordered, ...props }: any) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
            ol: ({ node, ordered, ...props }: any) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
              ) : (
                <code className="block bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto" {...props} />
              ),
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-4 border-primary pl-4 italic my-3" {...props} />
            ),
          }}
        >
          {displayContent}
        </ReactMarkdown>
      </div>

      {hasQuestions && onQuestionSubmit && (
        <div className="w-full">
          <InteractiveQuestionForm content={content} messageId={messageId} onSubmit={onQuestionSubmit} />
        </div>
      )}

      {showExportButtons && !showTableur && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button 
            onClick={generateTableur} 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-transparent"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Table2 className="h-4 w-4" />
            )}
            {isGenerating ? "Generation..." : "Generer le tableau"}
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
          {soumissionJSON && (
            <span className="text-xs text-green-600 self-center ml-2">Format structure detecte</span>
          )}
          {parseError && (
            <span className="text-xs text-red-500 self-center ml-2">{parseError}</span>
          )}
        </div>
      )}

      {showTableur && inlineSoumission && (
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
            <span className="text-xs font-medium text-gray-600">Tableur de soumission</span>
            <div className="flex items-center gap-1">
              <Button
                onClick={exportToExcel}
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 bg-transparent"
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
                Excel
              </Button>
              <Button
                onClick={exportToPDF}
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 bg-transparent"
              >
                <Download className="h-3 w-3" />
                PDF
              </Button>
              <Button
                onClick={() => setShowTableur(false)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 bg-transparent"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="max-h-[500px] overflow-auto">
            <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Chargement...</div>}>
              <InlineTableur soumission={inlineSoumission} onSoumissionChange={setInlineSoumission} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
