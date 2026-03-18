"use client"
import { useState, useId } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"

interface Question {
  id: string
  number: string
  text: string
  type: "choice" | "text" | "number" | "area"
  options?: string[]
  hasOther?: boolean
}

interface InteractiveQuestionFormProps {
  content: string
  messageId?: string
  onSubmit: (answers: Record<string, string>) => void
}

export function InteractiveQuestionForm({ content, messageId, onSubmit }: InteractiveQuestionFormProps) {
  const formId = useId()
  const keyPrefix = messageId || "form"
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [otherValues, setOtherValues] = useState<Record<string, string>>({})
  const [additionalDetails, setAdditionalDetails] = useState<Record<string, string>>({})
  const questions = parseQuestions(content)

  if (questions.length === 0) {
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Format answers for submission
    const formattedAnswers = Object.entries(answers)
      .map(([qId, answer]) => {
        const question = questions.find((q) => q.id === qId)
        let finalAnswer = answer
        if (answer.toLowerCase().includes("autre") && otherValues[qId]) {
          finalAnswer = `Autre : ${otherValues[qId]}`
        }
        // Add additional details if provided
        if (additionalDetails[qId]?.trim()) {
          finalAnswer += `\n_Détails: ${additionalDetails[qId].trim()}_`
        }
        return `**${question?.number}. ${question?.text}**\n${finalAnswer}`
      })
      .join("\n\n")

    onSubmit({ formatted: formattedAnswers })
  }

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length
  const hasAnyContent =
    answeredCount > 0 ||
    Object.values(additionalDetails).some((v) => v?.trim())

  return (
    <div className="mt-4 border-2 border-primary/20 rounded-xl bg-card text-card-foreground shadow-sm w-full overflow-hidden max-h-[80vh] flex flex-col">
      <div className="flex flex-col gap-4 py-5 flex-1 min-h-0">
        <div className="grid auto-rows-min items-start gap-2 px-6 flex-shrink-0">
          <div className="font-semibold text-xl flex items-center gap-2">Formulaire interactif</div>
          <div className="text-muted-foreground text-sm">Repondez aux questions ci-dessous. Utilisez le champ "Ajouter des details" pour preciser votre reponse.</div>
        </div>
        <div className="px-6 flex-1 min-h-0 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4 pb-2">
  {questions.map((question, questionIndex) => (
    <div key={`${formId}-${keyPrefix}-${question.id}-${questionIndex}`} className="space-y-2">
              <Label className="text-sm font-medium">
                {question.number}. {question.text}
              </Label>

              {question.type === "choice" && question.options ? (
                <div className="space-y-2">
                  <RadioGroup
                    value={answers[question.id] || ""}
                    onValueChange={(value) => setAnswers({ ...answers, [question.id]: value })}
                  >
                    <div className="space-y-2">
                      {question.options.map((option, idx) => {
                        const isOtherOption = /autre\s*:/i.test(option)
                        const cleanOption = option.replace(/\s*:\s*_+\s*\|?/, "")

                        return (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={cleanOption} id={`${question.id}-${idx}`} />
                              <Label htmlFor={`${question.id}-${idx}`} className="font-normal cursor-pointer">
                                {cleanOption}
                              </Label>
                            </div>
                            {isOtherOption && answers[question.id] === cleanOption && (
                              <Input
                                type="text"
                                value={otherValues[question.id] || ""}
                                onChange={(e) => setOtherValues({ ...otherValues, [question.id]: e.target.value })}
                                placeholder="Précisez..."
                                className="ml-6 mt-2"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </RadioGroup>
                </div>
              ) : question.type === "area" ? (
                <Textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  placeholder="Votre réponse..."
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <Input
                  type={question.type === "number" ? "number" : "text"}
                  value={answers[question.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  placeholder="Votre réponse..."
                />
              )}
              
              {/* Additional details field for each question */}
              <div className="mt-2">
                <Textarea
                  value={additionalDetails[question.id] || ""}
                  onChange={(e) => setAdditionalDetails({ ...additionalDetails, [question.id]: e.target.value })}
                  placeholder="Ajouter des details (optionnel)..."
                  rows={2}
                  className="resize-none text-sm bg-muted/30 border-dashed"
                />
              </div>
            </div>
          ))}
        </form>
        </div>
        <div className="px-6 pb-4 flex-shrink-0 border-t pt-4 bg-card">
          <Button type="submit" disabled={!hasAnyContent} onClick={handleSubmit} className="w-full gap-2">
            <Send className="h-4 w-4" />
            Soumettre les reponses ({answeredCount}/{questions.length})
          </Button>
        </div>
      </div>
    </div>
  )
}

function parseQuestions(content: string): Question[] {
  const questions: Question[] = []

  const lines = content.split("\n")
  let currentQuestion: Partial<Question> | null = null
  let currentOptions: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip empty lines, table separators, and header rows
    if (!line || line.match(/^\|[\s-]+\|/) || line.match(/^[-|]+$/) || line.match(/^#\s/) || line.match(/^\|\s*#\s*\|/)) {
      continue
    }
    
    // Skip header rows like "Élément à préciser" or "Options / Format attendu"
    if (/élément\s+à\s+préciser|options.*format\s+attendu/i.test(line)) {
      continue
    }

    // Format 1: Table format with pipes "| q-1 | Question text | Options |"
    const tableQuestionMatch = line.match(/^\|\s*q-?(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|?$/)
    if (tableQuestionMatch) {
      // Save previous question if exists
      if (currentQuestion?.number) {
        questions.push({
          ...currentQuestion,
          type: currentOptions.length > 0 ? "choice" : currentQuestion.type || "text",
          options: currentOptions.length > 0 ? currentOptions : undefined,
        } as Question)
        currentQuestion = null
        currentOptions = []
      }

      const questionNumber = tableQuestionMatch[1]
      const questionText = tableQuestionMatch[2].trim()
      const optionsText = tableQuestionMatch[3].trim()

      // Parse options - support multiple formats:
      // 1. "a) Option / b) Option" (with slashes)
      // 2. "a) Option b) Option c) Option" (space-separated)
      // 3. "Option1 / Option2 / Option3" (slash-separated without letters)
      let parsedOptions: string[] = []
      
      // Try format with letters: "a) Bois b) Bloc c) Béton" or "a) Option / b) Option"
      // This regex captures each "letter) text" pattern, stopping at the next letter) or end
      const letterOptions = optionsText.match(/[a-z]\)\s*[^a-z)]+(?=[a-z]\)|$)/gi)
      if (letterOptions && letterOptions.length > 0) {
        parsedOptions = letterOptions.map((opt) => opt.trim().replace(/\s*\/\s*$/, ''))
      } else {
        // Try slash-separated format: "Option1 / Option2 / Option3"
        const slashOptions = optionsText.split(/\s*\/\s*/).map(o => o.trim()).filter(o => o.length > 0)
        // Only use if we have multiple options (not just a format hint like "pi² par étage")
        if (slashOptions.length > 1) {
          parsedOptions = slashOptions
        }
      }

      // Determine question type
      let type: Question["type"] = parsedOptions.length > 0 ? "choice" : "text"
      if (parsedOptions.length === 0) {
        if (/superficie|nombre|quantité|étage|pi²|m²|\d+|budget|largeur|profondeur/i.test(optionsText)) {
          type = "text" // Free text for measurements
        } else if (/adresse|numéro civique|rue|ville|code postal/i.test(optionsText)) {
          type = "area"
        }
      }

      questions.push({
        id: `q-${questionNumber}`,
        number: `q-${questionNumber}`,
        text: questionText,
        type: type,
        options: parsedOptions.length > 0 ? parsedOptions : undefined,
        hasOther: /autre/i.test(optionsText),
      } as Question)
      continue
    }

    // Format 2: Tab-separated table "q-1\tQuestion text\tOptions"
    const tabMatch = line.match(/^q-?(\d+)\t+(.+?)\t+(.+)$/)
    if (tabMatch) {
      if (currentQuestion?.number) {
        questions.push({
          ...currentQuestion,
          type: currentOptions.length > 0 ? "choice" : currentQuestion.type || "text",
          options: currentOptions.length > 0 ? currentOptions : undefined,
        } as Question)
        currentQuestion = null
        currentOptions = []
      }

      const questionNumber = tabMatch[1]
      const questionText = tabMatch[2].trim()
      const optionsText = tabMatch[3].trim()

      // Parse slash-separated options
      const slashOptions = optionsText.split(/\s*\/\s*/).map(o => o.trim()).filter(o => o.length > 0)
      const parsedOptions = slashOptions.length > 1 ? slashOptions : []

      let type: Question["type"] = parsedOptions.length > 0 ? "choice" : "text"
      if (parsedOptions.length === 0) {
        if (/pi²|m²|largeur|profondeur|\$/i.test(optionsText)) {
          type = "text"
        } else if (/adresse|numéro civique/i.test(optionsText)) {
          type = "area"
        }
      }

      questions.push({
        id: `q-${questionNumber}`,
        number: `q-${questionNumber}`,
        text: questionText,
        type: type,
        options: parsedOptions.length > 0 ? parsedOptions : undefined,
        hasOther: /autre/i.test(optionsText),
      } as Question)
      continue
    }

    // Format 3: "q-1. Question text" or "q-1. | Question text |"
    const questionMatch = line.match(/^q-?(\d+)\.?\s*\|?\s*(.+?)\s*\|?\s*$/)
    if (questionMatch) {
      // Save previous question if exists
      if (currentQuestion?.number) {
        questions.push({
          ...currentQuestion,
          type: currentOptions.length > 0 ? "choice" : currentQuestion.type || "text",
          options: currentOptions.length > 0 ? currentOptions : undefined,
        } as Question)
      }

      const questionText = questionMatch[2].replace(/\|/g, '').trim()
      
      // Determine question type based on text
      let type: Question["type"] = "text"
      if (/superficie|nombre|quantité|étage|pi²|m²|année|largeur|pourcentage/i.test(questionText)) {
        type = "number"
      } else if (/adresse\s+complète|description|détails|photos|plans/i.test(questionText)) {
        type = "text"
      }

      currentQuestion = {
        id: `q-${questionMatch[1]}`,
        number: `q-${questionMatch[1]}`,
        text: questionText,
        type: type,
        hasOther: false,
      }
      currentOptions = []
      continue
    }

    // Format 4: Standalone options "a) Option text" or "  a) Option text"
    const optionMatch = line.match(/^\s*[a-z]\)\s*(.+?)(?:\s*\|)?$/)
    if (optionMatch && currentQuestion) {
      const option = optionMatch[0].trim().replace(/\|$/, '').trim()
      currentOptions.push(option)

      if (/autre/i.test(option)) {
        currentQuestion.hasOther = true
      }
      continue
    }
  }

  // Save last question if exists
  if (currentQuestion?.number) {
    questions.push({
      ...currentQuestion,
      type: currentOptions.length > 0 ? "choice" : currentQuestion.type || "text",
      options: currentOptions.length > 0 ? currentOptions : undefined,
    } as Question)
  }

  return questions
}
