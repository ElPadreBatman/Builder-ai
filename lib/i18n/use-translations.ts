import { useState, useEffect } from "react"
import type { Locale } from "./config"
import { i18n } from "./config"

// Inline dictionaries for client-side use (no dynamic imports needed)
import fr from "./dictionaries/fr.json"
import en from "./dictionaries/en.json"
import es from "./dictionaries/es.json"

const dictionaries = { fr, en, es }

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return i18n.defaultLocale
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/)
  const val = match?.[1]
  if (val && i18n.locales.includes(val as Locale)) return val as Locale
  return i18n.defaultLocale
}

export type Dictionary = typeof fr

export function getDictionarySync(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[i18n.defaultLocale]
}

export function useTranslations(): Dictionary {
  const [dict, setDict] = useState<Dictionary>(() => {
    const locale = getLocaleFromCookie()
    return dictionaries[locale] ?? dictionaries[i18n.defaultLocale]
  })

  useEffect(() => {
    const locale = getLocaleFromCookie()
    setDict(dictionaries[locale] ?? dictionaries[i18n.defaultLocale])
  }, [])

  return dict
}

// Server-side getDictionary (async, for Server Components)
export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale] ?? dictionaries[i18n.defaultLocale]
}
