import type { Locale } from "./config"

// Dictionary type matching the actual JSON structure
export type Dictionary = {
  common: {
    loading: string
    save: string
    cancel: string
    back: string
    next: string
    submit: string
    error: string
    success: string
  }
  nav: {
    features: string
    howItWorks: string
    pricing: string
    testimonials: string
    login: string
    signup: string
    dashboard: string
    settings: string
    profile: string
    logout: string
    accessChat: string
    accessDashboard: string
  }
  landing: {
    hero: {
      badge: string
      title: string
      titleHighlight: string
      titleEnd: string
      subtitle: string
      cta: string
      ctaSecondary: string
    }
    stats: {
      perSubmission: string
      timeSaved: string
      activeContractors: string
      satisfaction: string
    }
    features: {
      title: string
      subtitle: string
      ai: { title: string; description: string }
      import: { title: string; description: string }
      generation: { title: string; description: string }
      tracking: { title: string; description: string }
      collaboration: { title: string; description: string }
      security: { title: string; description: string }
    }
    howItWorks: {
      title: string
      subtitle: string
      step1: { title: string; description: string }
      step2: { title: string; description: string }
      step3: { title: string; description: string }
    }
    pricing: {
      title: string
      subtitle: string
      popular: string
      free: { name: string; price: string; period: string; features: string[]; cta: string }
      base: { name: string; price: string; period: string; features: string[]; cta: string }
      pro: { name: string; price: string; period: string; features: string[]; cta: string }
    }
    testimonials: {
      title: string
      subtitle: string
    }
    cta: {
      title: string
      subtitle: string
      button: string
    }
    footer: {
      description: string
      product: string
      company: string
      legal: string
      privacy: string
      terms: string
      about: string
      contact: string
      blog: string
      allRights: string
    }
  }
  auth: {
    login: {
      title: string
      subtitle: string
      email: string
      password: string
      forgotPassword: string
      submit: string
      noAccount: string
      signupLink: string
    }
    signup: {
      title: string
      subtitle: string
      firstName: string
      lastName: string
      email: string
      password: string
      confirmPassword: string
      submit: string
      hasAccount: string
      loginLink: string
    }
  }
  profile: {
    title: string
    subtitle: string
    personalInfo: string
    companyInfo: string
    language: string
    languageHint: string
  }
}

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  es: () => import("./dictionaries/es.json").then((m) => m.default),
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]()
}
