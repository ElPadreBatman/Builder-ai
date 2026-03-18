"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

export type SupportedLanguage = "fr" | "en" | "es"

export const LANGUAGES: Record<SupportedLanguage, { label: string; flag: string }> = {
  fr: { label: "Français", flag: "🇫🇷" },
  en: { label: "English", flag: "🇬🇧" },
  es: { label: "Español", flag: "🇪🇸" },
}

interface LanguageContextType {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => Promise<void>
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function detectBrowserLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "fr"
  
  const browserLang = navigator.language.toLowerCase()
  
  if (browserLang.startsWith("en")) return "en"
  if (browserLang.startsWith("es")) return "es"
  if (browserLang.startsWith("fr")) return "fr"
  
  // Default to French for Quebec/Canada market
  return "fr"
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("fr")
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadLanguage = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserId(user.id)
        
        // Load from database
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferred_language")
          .eq("id", user.id)
          .single()
        
        if (profile?.preferred_language) {
          setLanguageState(profile.preferred_language as SupportedLanguage)
        } else {
          // First time user - detect from browser and save
          const detected = detectBrowserLanguage()
          setLanguageState(detected)
          await supabase
            .from("profiles")
            .update({ preferred_language: detected })
            .eq("id", user.id)
        }
      } else {
        // Not logged in - use browser detection
        setLanguageState(detectBrowserLanguage())
      }
      
      setIsLoading(false)
    }
    
    loadLanguage()
  }, [])

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang)
    
    if (userId) {
      const supabase = createClient()
      await supabase
        .from("profiles")
        .update({ preferred_language: lang })
        .eq("id", userId)
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

// Helper to get language name in that language
export function getLanguageInstruction(lang: SupportedLanguage): string {
  switch (lang) {
    case "fr":
      return "Tu DOIS répondre UNIQUEMENT en français. Toutes tes réponses, questions et explications doivent être en français."
    case "en":
      return "You MUST respond ONLY in English. All your responses, questions and explanations must be in English."
    case "es":
      return "DEBES responder ÚNICAMENTE en español. Todas tus respuestas, preguntas y explicaciones deben ser en español."
    default:
      return "Tu DOIS répondre UNIQUEMENT en français."
  }
}
