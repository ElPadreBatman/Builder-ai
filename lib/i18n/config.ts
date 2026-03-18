export const i18n = {
  defaultLocale: "fr" as const,
  locales: ["fr", "en", "es"] as const,
}

export type Locale = (typeof i18n)["locales"][number]

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
}

export const localeFlags: Record<Locale, string> = {
  fr: "🇫🇷",
  en: "🇬🇧",
  es: "🇪🇸",
}
