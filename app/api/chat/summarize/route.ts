import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  try {
    const { conversationId } = await request.json()

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID requis" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Clé API OpenAI non configurée" }, { status: 500 })
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json({ error: "Impossible de charger les messages" }, { status: 500 })
    }

    const conversationHistory = messages
      .map((msg) => `${msg.role === "user" ? "Utilisateur" : "Assistant"}: ${msg.content}`)
      .join("\n\n")

    const summaryPrompt = `Tu es un assistant qui crée des résumés concis de conversations. 
    
Résume la conversation suivante en français en gardant les points clés, décisions importantes et contexte essentiel. Le résumé doit être clair et permettre à l'assistant de continuer la conversation de manière cohérente.

Conversation:
${conversationHistory}

Résumé concis (maximum 300 mots):`.trim()

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un expert en résumé de conversations. Tu crées des résumés concis et précis.",
          },
          { role: "user", content: summaryPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "Échec de la génération du résumé")
    }

    const completion = await response.json()
    const summary = completion.choices[0]?.message?.content || ""

    const { error: updateError } = await supabase
      .from("conversations")
      .update({ summary, updated_at: new Date().toISOString() })
      .eq("id", conversationId)

    if (updateError) {
      throw new Error("Échec de la sauvegarde du résumé")
    }

    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error("Error generating summary:", error)
    return NextResponse.json({ error: error.message || "Erreur lors de la génération du résumé" }, { status: 500 })
  }
}
