import { getDictionary } from "@/lib/i18n/dictionaries"
import { i18n, type Locale } from "@/lib/i18n/config"
import { LandingPageClient } from "./landing-client"

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }))
}

interface Props {
  params: Promise<{ locale: Locale }>
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params
  const dict = await getDictionary(locale)

  return <LandingPageClient dict={dict} locale={locale} />
}
