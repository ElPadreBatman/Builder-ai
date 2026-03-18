// app/api/chat/route.ts - VERSION CORRIGÉE
// Support GPT-5.2 avec Responses API (file_search, web_search, tools)
// + Fallback Chat Completions pour modèles legacy (gpt-4o, gpt-4o-mini)
// ✅ Fix: PDFs encodés en base64 pour la Responses API
// ✅ PriceLookup tools intégrés pour recherche de prix matériaux
// ✅ EstimationClassifier tool pour classification Type A-D
// ✅ SoumissionCreate tool pour orchestration multi-divisions

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSpecialtyPromptContext } from "@/lib/specialties"
// @ts-ignore - JS module
import { PriceLookup, getOpenAITools, handleToolCall } from "../tools/price-lookup/index.js"
// @ts-ignore - JS module  
import { getOpenAITools as getPriceTools } from "../tools/price-lookup/openai-tools.js"
// @ts-ignore - JS module
import { 
  getOpenAITools as getEstimationTools, 
  handleToolCall as handleEstimationToolCall 
} from "../tools/estimation-classifier/index.js"

// Tool definition for soumission_create
const soumissionCreateTool = {
  type: "function",
  function: {
    name: "soumission_create",
    description: "Orchestre la génération d'une soumission multi-divisions MasterFormat. Appelle les agents de division en parallèle pour générer les items.",
    parameters: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "ID de la conversation" },
        project_info: {
          type: "object",
          properties: {
            client_name: { type: "string" },
            address: { type: "string" },
            city: { type: "string" },
            project_type: { type: "string", enum: ["renovation_generale", "salle_de_bain", "cuisine", "sous_sol", "agrandissement", "construction_neuve"] },
            estimation_type: { type: "string", enum: ["A", "B", "C", "D"] },
            superficie_pi2: { type: "number" },
            description: { type: "string" }
          },
          required: ["client_name", "address", "project_type", "estimation_type"]
        },
        divisions: {
          type: "array",
          items: { type: "string" },
          description: "Divisions MasterFormat à générer (ex: ['01', '06', '09', '22', '26'])"
        }
      },
      required: ["conversation_id", "project_info", "divisions"]
    }
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Initialisation PriceLookup (lazy - créé à la demande)
// Fonctionne avec ou sans SERPAPI_KEY (cache local seulement si pas de clé)
let priceLookupInstance: any = null
function getPriceLookup() {
  if (!priceLookupInstance) {
    priceLookupInstance = new PriceLookup({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      serpApiKey: process.env.SERPAPI_KEY || "", // Optionnel - utilise cache local si vide
      cacheDays: 30,
      timeoutMs: 15000,
    })
  }
  return priceLookupInstance
}

// Modèles qui utilisent la Responses API
const RESPONSES_API_MODELS = [
  'gpt-5.2', 'gpt-5.2-chat-latest', 'gpt-5.2-2025-12-11',
  'gpt-5.1', 'gpt-5.1-mini', 
  'gpt-5', 'gpt-5-2025-08-07',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'
]

function shouldUseResponsesAPI(model: string): boolean {
  return RESPONSES_API_MODELS.some(m => model.includes(m))
}

// Language instruction to force the agent to respond in the user's preferred language
function getLanguageInstruction(lang: string): string {
  switch (lang) {
    case "en":
      return "IMPORTANT: You MUST respond ONLY in English. All your responses, questions and explanations must be in English."
    case "es":
      return "IMPORTANTE: DEBES responder ÚNICAMENTE en español. Todas tus respuestas, preguntas y explicaciones deben ser en español."
    case "fr":
    default:
      return "IMPORTANT: Tu DOIS répondre UNIQUEMENT en français. Toutes tes réponses, questions et explications doivent être en français."
  }
}

// ✅ NOUVEAU: Télécharge un fichier et le convertit en base64
async function fetchFileAsBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
  }
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  const mediaType = response.headers.get("content-type") || "application/octet-stream"
  return { data: base64, mediaType }
}

export async function POST(request: Request) {
  try {
    const { message, attachments, agentId, conversationId, userId } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "La clé API OpenAI n'est pas configurée. Veuillez l'ajouter dans les variables d'environnement." },
        { status: 500 },
      )
    }

    // Configuration par défaut
    let agentConfig = {
      system_prompt: "Tu es un assistant IA serviable et professionnel. Tu réponds de manière claire et concise en français.",
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 2000,
      response_format: "text",
      store_conversations: false,
      tools_enabled: [] as string[],
      vector_store_ids: [] as string[],
      max_history_messages: 20,
      workflow_max_tokens: null as number | null,
    }

    // ✅ Chargement unique de l'agent avec config multi-phases
    if (agentId) {
      const { data: agent, error } = await supabase
        .from("agents")
        .select("system_prompt, model, temperature, max_tokens, response_format, store_conversations, tools_enabled, vector_store_ids, max_history_messages, workflow_max_tokens")
        .eq("id", agentId)
        .single()



      if (!error && agent) {
        agentConfig = { ...agentConfig, ...agent }
      }
    }

    // Charger le profil complet de l'utilisateur pour personnaliser l'agent
    let userSpecialty = "general"
    let userCompany = ""
    let userCity = ""
    let userProvince = ""
    let userCountry = "Canada"
    let userRbq = ""
    let userLanguage = "fr"

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("specialty, company, company_name, city, province, country, rbq_number, preferred_language")
        .eq("id", userId)
        .single()

      if (profile) {
        userSpecialty = profile.specialty || "general"
        userCompany = profile.company_name || profile.company || ""
        userCity = profile.city || ""
        userProvince = profile.province || ""
        userCountry = profile.country || "Canada"
        userRbq = profile.rbq_number || ""
        userLanguage = profile.preferred_language || "fr"
      }
    }

    // Construire le bloc de contexte compagnie/localisation
    const specialtyContext = getSpecialtyPromptContext(userSpecialty)

    const locationParts = [userCity, userProvince, userCountry].filter(Boolean)
    const locationStr = locationParts.length > 0 ? locationParts.join(", ") : ""

    let companyContext = ""
    if (userCompany) companyContext += `\nNom de la compagnie: ${userCompany}`
    if (userRbq) companyContext += `\nNuméro RBQ: ${userRbq}`
    if (locationStr) companyContext += `\nLocalisation: ${locationStr}`

    const locationGuidance = locationStr
      ? `\n\nIMPORTANT — adapte TOUJOURS tes réponses à la localisation de l'entrepreneur (${locationStr}) : codes de construction locaux, normes provinciales/étatiques, unités de mesure, prix du marché régional, permis municipaux et réglementations en vigueur dans cette région.`
      : ""

    // Language instruction - force the agent to respond in the user's preferred language
    const languageInstruction = getLanguageInstruction(userLanguage)

    agentConfig.system_prompt = `${languageInstruction}\n\n${agentConfig.system_prompt}\n\n--- CONTEXTE DE L'ENTREPRENEUR ---\n${specialtyContext}${companyContext ? `\n\nInformations de la compagnie :${companyContext}` : ""}${locationGuidance}`
    
    console.log("[v0] User context — specialty:", userSpecialty, "| location:", locationStr, "| company:", userCompany, "| language:", userLanguage)

    // Determiner le modele a utiliser
    const hasImages = attachments?.some((a: any) => a.type.startsWith("image/"))
    const visionModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5', 'gpt-5.1', 'gpt-5.2']
    const currentModelSupportsVision = visionModels.some(m => agentConfig.model.includes(m))
    const modelToUse = (hasImages && !currentModelSupportsVision) ? "gpt-4o" : agentConfig.model

    // Router vers la bonne API
    if (shouldUseResponsesAPI(modelToUse)) {
      return await handleResponsesAPI(message, attachments, agentConfig, conversationId, modelToUse)
    } else {
      return await handleChatCompletionsAPI(message, attachments, agentConfig, conversationId, modelToUse)
    }

  } catch (error: any) {
    console.error("[v0] OpenAI API error:", error)
    return NextResponse.json({ error: formatErrorMessage(error) }, { status: 500 })
  }
}

// ============================================================================
// RESPONSES API (GPT-5.2, GPT-5.1, GPT-4.1)
// ============================================================================
async function handleResponsesAPI(
  message: string,
  attachments: any[],
  agentConfig: any,
  conversationId: string | null,
  modelToUse: string
) {
  const input: any[] = []

  if (agentConfig.system_prompt) {
    input.push({
      type: "message",
      role: "system",
      content: agentConfig.system_prompt
    })
  }

  if (conversationId) {
    const history = await loadConversationHistory(conversationId, agentConfig.max_history_messages)
    for (const msg of history) {
      input.push({
        type: "message",
        role: msg.role,
        content: msg.content
      })
    }
  }

  // ✅ CORRIGÉ: Gestion native des PDFs via base64 (avant: URL dans le texte seulement)
  if (attachments && attachments.length > 0) {
    const images = attachments.filter((a: any) => a.type.startsWith("image/"))
    const pdfs = attachments.filter((a: any) => a.type === "application/pdf")
    const otherFiles = attachments.filter(
      (a: any) => !a.type.startsWith("image/") && a.type !== "application/pdf"
    )

    const userContent: any[] = []

    // Texte du message + mention des fichiers non-supportés nativement (zip, docx, etc.)
    let messageText = message || ""
    if (otherFiles.length > 0) {
      const fileList = otherFiles.map((f: any) => {
        const name = f.name || f.url.split("/").pop() || "fichier"
        return `- ${name} (${f.type}) : ${f.url}`
      }).join("\n")
      messageText = `${messageText}\n\nPieces jointes (fichiers) :\n${fileList}\n\nNote : Ces fichiers sont accessibles via les URLs ci-dessus.`
    }

    userContent.push({
      type: "input_text",
      text: messageText || "Analyse ces pièces jointes.",
    })

    // ✅ PDFs → encodés en base64 (support natif Responses API)
    for (const pdf of pdfs) {
      try {
        console.log("[v0] Fetching PDF for base64 encoding:", pdf.url)
        const { data, mediaType } = await fetchFileAsBase64(pdf.url)
        userContent.push({
          type: "input_file",
          filename: pdf.name || "document.pdf",
          file_data: `data:${mediaType};base64,${data}`,
        })
        console.log("[v0] PDF encoded successfully:", pdf.name)
      } catch (err) {
        console.error("[v0] Failed to fetch PDF:", pdf.url, err)
        // Fallback: mentionner l'URL dans le texte si l'encodage échoue
        userContent[0].text += `\n\n⚠️ PDF non chargeable: ${pdf.name || "document.pdf"} → ${pdf.url}`
      }
    }

    // ✅ Images → URL directe (supporté nativement)
    for (const img of images) {
      userContent.push({
        type: "input_image",
        image_url: img.url,
      })
    }

    input.push({
      type: "message",
      role: "user",
      content: userContent,
    })
  } else {
    input.push({
      type: "message",
      role: "user",
      content: message,
    })
  }

  // Construction des tools
  const tools: any[] = []

  if (agentConfig.tools_enabled?.includes("file_search") && agentConfig.vector_store_ids?.length > 0) {
    tools.push({
      type: "file_search",
      vector_store_ids: agentConfig.vector_store_ids,
      max_num_results: 20
    })
  }

  if (agentConfig.tools_enabled?.includes("web_search")) {
    tools.push({ type: "web_search" })
  }

  if (agentConfig.tools_enabled?.includes("code_interpreter")) {
    tools.push({ type: "code_interpreter" })
  }

  // Custom function tools (price_lookup, estimation_classifier, soumission_create)
  // Convert from Chat Completions format { type: "function", function: { name, ... } }
  // to Responses API format { type: "function", name: "...", parameters: {...} }
  if (agentConfig.tools_enabled?.includes("price_lookup")) {
    const priceTools = getPriceTools()
    for (const tool of priceTools) {
      if (tool.function) {
        tools.push({ 
          type: "function", 
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        })
      }
    }
  }

  if (agentConfig.tools_enabled?.includes("estimation_classifier")) {
    const estTools = getEstimationTools()
    for (const tool of estTools) {
      if (tool.function) {
        tools.push({ 
          type: "function", 
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        })
      }
    }
  }

  if (agentConfig.tools_enabled?.includes("soumission_create")) {
    tools.push({ 
      type: "function", 
      name: soumissionCreateTool.function.name,
      description: soumissionCreateTool.function.description,
      parameters: soumissionCreateTool.function.parameters
    })
  }

  console.log("[v0] Responses API tools configured:", tools.map(t => t.type === "function" ? t.name : t.type))

  const requestBody: any = {
    model: modelToUse,
    input: input,
    max_output_tokens: agentConfig.max_tokens,
  }

  if (tools.length > 0) {
    requestBody.tools = tools
  }

  if (!modelToUse.includes("gpt-5")) {
    requestBody.temperature = agentConfig.temperature
  }

  if (agentConfig.response_format && agentConfig.response_format !== "text") {
    requestBody.text = { format: { type: agentConfig.response_format } }
  }

  if (agentConfig.store_conversations) {
    requestBody.store = true
  }

  // Log sans le contenu base64 pour ne pas polluer les logs
  console.log("[v0] Responses API request (base64 tronqué):", JSON.stringify({
    ...requestBody,
    input: requestBody.input.map((item: any) => {
      if (item.content && Array.isArray(item.content)) {
        return {
          ...item,
          content: item.content.map((c: any) =>
            c.type === "input_file"
              ? { ...c, file_data: `[base64 ${c.filename} - tronqué pour log]` }
              : c
          )
        }
      }
      return item
    })
  }, null, 2))

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error("[v0] Responses API error:", errorData)
    throw new Error(errorData.error?.message || "Responses API request failed")
  }

  const completion = await response.json()
  console.log("[v0] Responses API completion:", JSON.stringify(completion, null, 2).slice(0, 2000))

  let aiMessage = ""
  let toolsUsed: string[] = []

  // Check for function calls in output
  const functionCalls = completion.output?.filter((item: any) => item.type === "function_call") || []
  
  if (functionCalls.length > 0) {
    console.log("[v0] Function calls detected:", functionCalls.length)
    const toolResults: any[] = []
    const lookup = getPriceLookup()

    for (const fc of functionCalls) {
      const toolName = fc.name
      const toolArgs = JSON.parse(fc.arguments || "{}")
      toolsUsed.push(toolName)
      
      console.log("[v0] Executing Responses API tool:", toolName, toolArgs)

      try {
        let result: string

        if (toolName === "classify_estimation_type") {
          result = handleEstimationToolCall({ function: { name: toolName, arguments: fc.arguments } })
        } else if (["get_material_prices", "generate_quote", "list_materials_by_category"].includes(toolName)) {
          result = await handleToolCall({ function: { name: toolName, arguments: fc.arguments } }, lookup)
        } else if (toolName === "soumission_create") {
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000'
          
          const soumissionResponse = await fetch(`${baseUrl}/api/soumission/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolArgs)
          })
          
          if (soumissionResponse.ok) {
            result = JSON.stringify(await soumissionResponse.json())
          } else {
            const errorData = await soumissionResponse.json()
            result = JSON.stringify({ error: errorData.error || 'Erreur création soumission' })
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${toolName}` })
        }

        toolResults.push({
          type: "function_call_output",
          call_id: fc.call_id,
          output: result
        })
      } catch (err: any) {
        console.error("[v0] Tool execution error:", err)
        toolResults.push({
          type: "function_call_output",
          call_id: fc.call_id,
          output: JSON.stringify({ error: err.message })
        })
      }
    }

    // Send tool results back to get final response
    const followUpBody = {
      model: modelToUse,
      input: toolResults,
      previous_response_id: completion.id
    }

    console.log("[v0] Sending tool results back to Responses API")
    
    const followUpResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(followUpBody),
    })

    if (followUpResponse.ok) {
      const followUpCompletion = await followUpResponse.json()
      
      if (followUpCompletion.output_text) {
        aiMessage = followUpCompletion.output_text
      } else if (followUpCompletion.output) {
        for (const item of followUpCompletion.output) {
          if (item.type === "message" && item.content) {
            for (const content of item.content) {
              if (content.type === "output_text" || content.type === "text") {
                aiMessage += content.text
              }
            }
          }
        }
      }
    }
  } else {
    // No function calls - extract text response
    if (completion.output_text) {
      aiMessage = completion.output_text
    } else if (completion.output) {
      for (const item of completion.output) {
        if (item.type === "message" && item.content) {
          for (const content of item.content) {
            if (content.type === "output_text" || content.type === "text") {
              aiMessage += content.text
            }
          }
        }
      }
    }
  }

  if (!aiMessage) {
    aiMessage = "Désolé, je n'ai pas pu générer une réponse."
  }

  const annotations = completion.output?.find((item: any) =>
    item.type === "file_search_call"
  )?.results || []

  return NextResponse.json({
    message: aiMessage,
    annotations: annotations,
    model_used: modelToUse,
    api_used: "responses",
    tools_used: toolsUsed.length > 0 ? toolsUsed : undefined
  })
}

// ============================================================================
// CHAT COMPLETIONS API (GPT-4o, GPT-4o-mini, legacy)
// ============================================================================
async function handleChatCompletionsAPI(
  message: string,
  attachments: any[],
  agentConfig: any,
  conversationId: string | null,
  modelToUse: string
) {
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string | Array<any> }> = [
    { role: "system", content: agentConfig.system_prompt },
  ]

  if (conversationId) {
    const history = await loadConversationHistory(conversationId, agentConfig.max_history_messages)
    for (const msg of history) {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content })
    }
  }

  if (attachments && attachments.length > 0) {
    const images = attachments.filter((a: any) => a.type.startsWith("image/"))
    const files = attachments.filter((a: any) => !a.type.startsWith("image/"))

    let messageText = message || ""
    if (files.length > 0) {
      const fileList = files.map((f: any) => {
        const name = f.name || f.url.split("/").pop() || "fichier"
        return `- ${name} (${f.type}) : ${f.url}`
      }).join("\n")
      messageText = `${messageText}\n\nPieces jointes (fichiers) :\n${fileList}\n\nNote : Ces fichiers ont ete telecharges et sont accessibles via les URLs ci-dessus. Veuillez en tenir compte dans votre reponse.`
    }

    if (images.length > 0) {
      const content: Array<any> = [{ type: "text", text: messageText || "Que voyez-vous dans cette image ?" }]
      images.forEach((img: any) => {
        content.push({ type: "image_url", image_url: { url: img.url } })
      })
      messages.push({ role: "user", content })
    } else {
      messages.push({ role: "user", content: messageText })
    }
  } else {
    messages.push({ role: "user", content: message })
  }

  const requestBody: any = {
    model: modelToUse,
    messages,
    temperature: agentConfig.temperature,
    max_tokens: agentConfig.max_tokens,
  }

  // Ajouter les tools selon la configuration de l'agent
  const allTools: any[] = []
  
  // Tools de recherche de prix
  if (agentConfig.tools_enabled?.includes("price_lookup")) {
    allTools.push(...getPriceTools())
  }
  
  // Tool de classification d'estimation (Type A-D)
  if (agentConfig.tools_enabled?.includes("estimation_classifier")) {
    allTools.push(...getEstimationTools())
  }
  
  // Tool de génération de soumission multi-divisions
  if (agentConfig.tools_enabled?.includes("soumission_create")) {
    allTools.push(soumissionCreateTool)
  }
  
  if (allTools.length > 0) {
    requestBody.tools = allTools
    // Force tool use for specific keywords in the message
    const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || ""
    const shouldForceTools = lastUserMessage.includes("soumission") || 
                             lastUserMessage.includes("estimation") ||
                             lastUserMessage.includes("prix") ||
                             lastUserMessage.includes("générer") ||
                             lastUserMessage.includes("generer")
    
    requestBody.tool_choice = shouldForceTools ? "required" : "auto"
    console.log("[v0] Tools loaded:", allTools.length, "tool_choice:", requestBody.tool_choice)
  }

  if (agentConfig.response_format && agentConfig.response_format !== "text") {
    requestBody.response_format = { type: agentConfig.response_format }
  }

  requestBody.store = agentConfig.store_conversations

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.json()
    console.error("[v0] Chat Completions API error:", errorData)
    throw new Error(errorData.error?.message || "Chat Completions API request failed")
  }

  const completion = await openaiResponse.json()
  
  // Gestion des tool calls (price_lookup, estimation_classifier, etc.)
  if (completion.choices[0]?.finish_reason === "tool_calls" && completion.choices[0]?.message?.tool_calls) {
    const toolCalls = completion.choices[0].message.tool_calls
    const toolResults: any[] = []
    const lookup = getPriceLookup()

    for (const toolCall of toolCalls) {
      try {
        console.log("[v0] Executing tool call:", toolCall.function.name)
        let result: string
        
        // Router vers le bon handler selon le tool
        if (toolCall.function.name === "classify_estimation_type") {
          result = handleEstimationToolCall(toolCall)
        } else if (["get_material_prices", "generate_quote", "list_materials_by_category"].includes(toolCall.function.name)) {
          result = await handleToolCall(toolCall, lookup)
        } else if (toolCall.function.name === "soumission_create") {
          // Appel à l'API orchestrateur de soumission
          const args = JSON.parse(toolCall.function.arguments)
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000'
          
          const soumissionResponse = await fetch(`${baseUrl}/api/soumission/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
          })
          
          if (soumissionResponse.ok) {
            const soumissionResult = await soumissionResponse.json()
            result = JSON.stringify(soumissionResult)
          } else {
            const errorData = await soumissionResponse.json()
            result = JSON.stringify({ error: errorData.error || 'Erreur création soumission' })
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` })
        }
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: result,
        })
      } catch (err: any) {
        console.error("[v0] Tool call error:", err)
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify({ error: err.message }),
        })
      }
    }

    if (toolResults.length > 0) {

      // Envoyer les résultats des tools et obtenir la réponse finale
      const messagesWithTools = [
        ...messages,
        completion.choices[0].message,
        ...toolResults,
      ]

      const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messagesWithTools,
          temperature: agentConfig.temperature,
          max_tokens: agentConfig.max_tokens,
        }),
      })

      if (followUpResponse.ok) {
        const followUpCompletion = await followUpResponse.json()
        const aiMessage = followUpCompletion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer une réponse."
        return NextResponse.json({
          message: aiMessage,
          model_used: modelToUse,
          api_used: "chat_completions",
          tools_used: toolCalls.map((tc: any) => tc.function.name),
        })
      }
    }
  }

  const aiMessage = completion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer une réponse."

  return NextResponse.json({
    message: aiMessage,
    model_used: modelToUse,
    api_used: "chat_completions"
  })
}

// ============================================================================
// HELPERS
// ============================================================================
async function loadConversationHistory(conversationId: string, maxMessages: number = 20) {
  console.log("[v0] Loading history for conversation:", conversationId, "maxMessages:", maxMessages)

  const { data: conversation } = await supabase
    .from("conversations")
    .select("summary, message_count, workflow_state")
    .eq("id", conversationId)
    .single()

  console.log("[v0] Conversation data:", conversation)

  const messageCount = conversation?.message_count || 0
  const conversationSummary = conversation?.summary
  const workflowState = conversation?.workflow_state

  // For active workflows, always load more history to maintain context
  const effectiveLimit = workflowState?.active ? Math.max(maxMessages, 50) : maxMessages

  if (conversationSummary && messageCount > 15 && !workflowState?.active) {
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10)

    const history = recentMessages?.reverse() || []

    return [
      { role: "system", content: `Contexte de la conversation précédente:\n${conversationSummary}` },
      ...history
    ]
  }

  const { data: historyMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(effectiveLimit)

  console.log("[v0] History loaded, message count:", historyMessages?.length || 0)
  return historyMessages || []
}

function formatErrorMessage(error: any): string {
  if (error?.message?.includes("401") || error?.message?.includes("Incorrect API key")) {
    return "Clé API OpenAI invalide. Veuillez vérifier votre configuration."
  } else if (error?.message?.includes("429") || error?.message?.includes("Rate limit")) {
    return "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants."
  } else if (error?.message) {
    return `Erreur OpenAI: ${error.message}`
  }
  return "Erreur lors de la génération de la réponse IA"
}
