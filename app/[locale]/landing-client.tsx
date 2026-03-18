"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AnimatedLightBackground } from "@/components/animated-light-background"
import { LanguageSwitcher } from "@/components/language-switcher"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"
import {
  ArrowRight,
  FileText,
  MessageSquare,
  Sparkles,
  Check,
  Star,
  Users,
  Zap,
  Shield,
  BarChart3,
  HardHat,
  Menu,
  X,
} from "lucide-react"

interface Props {
  dict: Dictionary
  locale: Locale
}

export function LandingPageClient({ dict, locale }: Props) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const t = dict.landing
  const nav = dict.nav

  useEffect(() => {
    const supabase = createClient()
    // Handle case where Supabase client is not ready yet
    if (!supabase) {
      setCheckingAuth(false)
      return
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true)
      }
      setCheckingAuth(false)
    }).catch(() => {
      setCheckingAuth(false)
    })
  }, [])

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent" />
      </div>
    )
  }

  const features = [
    { icon: MessageSquare, title: t.features.ai.title, description: t.features.ai.description },
    { icon: FileText, title: t.features.import.title, description: t.features.import.description },
    { icon: Zap, title: t.features.generation.title, description: t.features.generation.description },
    { icon: BarChart3, title: t.features.tracking.title, description: t.features.tracking.description },
    { icon: Users, title: t.features.collaboration.title, description: t.features.collaboration.description },
    { icon: Shield, title: t.features.security.title, description: t.features.security.description },
  ]

  const steps = [
    { step: "01", title: t.howItWorks.step1.title, description: t.howItWorks.step1.description },
    { step: "02", title: t.howItWorks.step2.title, description: t.howItWorks.step2.description },
    { step: "03", title: t.howItWorks.step3.title, description: t.howItWorks.step3.description },
  ]

  return (
    <div className="min-h-screen bg-white relative">
      <AnimatedLightBackground />

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">BuilderAI</span>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <Link href="#fonctionnalites" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                {nav.features}
              </Link>
              <Link href="#comment-ca-marche" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                {nav.howItWorks}
              </Link>
              <Link href="#tarifs" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                {nav.pricing}
              </Link>
              <Link href="#temoignages" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                {nav.testimonials}
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <LanguageSwitcher currentLocale={locale} />
              {isLoggedIn ? (
                <Button onClick={() => router.push(`/${locale}/chat`)} className="bg-orange-500 hover:bg-orange-600">
                  {nav.accessChat}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => router.push(`/${locale}/login`)}>
                    {nav.login}
                  </Button>
                  <Button onClick={() => router.push(`/${locale}/signup`)} className="bg-orange-500 hover:bg-orange-600">
                    {nav.signup}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-4">
            <Link href="#fonctionnalites" className="block text-gray-600 hover:text-gray-900">{nav.features}</Link>
            <Link href="#comment-ca-marche" className="block text-gray-600 hover:text-gray-900">{nav.howItWorks}</Link>
            <Link href="#tarifs" className="block text-gray-600 hover:text-gray-900">{nav.pricing}</Link>
            <Link href="#temoignages" className="block text-gray-600 hover:text-gray-900">{nav.testimonials}</Link>
            <div className="pt-4 flex items-center justify-between">
              <LanguageSwitcher currentLocale={locale} showLabel />
            </div>
            <div className="space-y-2">
              {isLoggedIn ? (
                <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => router.push(`/${locale}/dashboard`)}>
                  {nav.accessDashboard}
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => router.push(`/${locale}/login`)}>
                    {nav.login}
                  </Button>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => router.push(`/${locale}/signup`)}>
                    {nav.signup}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div className="text-center max-w-4xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              <Badge variant="secondary" className="mb-6 bg-orange-100 text-orange-700 border-orange-200 inline-flex items-center gap-2 px-4 py-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{t.hero.badge}</span>
              </Badge>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6 text-balance"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
            >
              {t.hero.title}{" "}
              <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">{t.hero.titleHighlight}</span>{" "}
              {t.hero.titleEnd}
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed text-pretty"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            >
              {t.hero.subtitle}
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-base px-8 py-6 h-auto rounded-xl shadow-lg shadow-orange-500/25"
                  onClick={() => router.push(`/${locale}/signup`)}
                >
                  {t.hero.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 py-6 h-auto rounded-xl border-gray-200 text-gray-900 hover:bg-gray-50"
                  onClick={() => router.push(`/${locale}/demo`)}
                >
                  {t.hero.ctaSecondary}
                </Button>
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 max-w-3xl mx-auto"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
            >
              {[
                { value: "30 min", label: t.stats.perSubmission },
                { value: "85%", label: t.stats.timeSaved },
                { value: "500+", label: t.stats.activeContractors },
                { value: "4.9/5", label: t.stats.satisfaction },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                >
                  <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">{stat.value}</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t.features.title}</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t.features.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/90 backdrop-blur-sm border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all shadow-md">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="comment-ca-marche" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-gray-50/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t.howItWorks.title}</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t.howItWorks.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold mb-4 text-orange-500">{step.step}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 right-0 translate-x-1/2">
                    <ArrowRight className="h-8 w-8 text-orange-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">{t.pricing.title}</h2>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-12 font-medium">{t.pricing.subtitle}</p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            {/* Free */}
            <Card className="border-gray-300 bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardContent className="p-8 text-center flex flex-col flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-3">{t.pricing.free.name}</h3>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">{t.pricing.free.price}</div>
                <p className="text-sm text-gray-700 mb-6 font-medium">{t.pricing.free.period}</p>
                <ul className="text-sm text-gray-800 space-y-3 font-medium mb-8">
                  {t.pricing.free.features.map((f, i) => (
                    <li key={i} className="flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Button className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold" onClick={() => router.push(`/${locale}/signup?plan=free`)}>
                    {t.pricing.free.cta}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-orange-500 border-2 shadow-xl relative bg-white flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-orange-500 text-white font-bold text-xs px-3 py-1">{t.pricing.popular}</Badge>
              </div>
              <CardContent className="p-8 text-center flex flex-col flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-3">{t.pricing.pro.name}</h3>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">{t.pricing.pro.price}</div>
                <p className="text-sm text-gray-700 mb-6 font-medium">{t.pricing.pro.period}</p>
                <ul className="text-sm text-gray-800 space-y-3 font-medium mb-8">
                  {t.pricing.pro.features.map((f, i) => (
                    <li key={i} className="flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold" onClick={() => router.push(`/${locale}/signup?plan=pro`)}>
                    {t.pricing.pro.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Base */}
            <Card className="border-gray-300 bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardContent className="p-8 text-center flex flex-col flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-3">{t.pricing.base.name}</h3>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">{t.pricing.base.price}</div>
                <p className="text-sm text-gray-700 mb-6 font-medium">{t.pricing.base.period}</p>
                <ul className="text-sm text-gray-800 space-y-3 font-medium mb-8">
                  {t.pricing.base.features.map((f, i) => (
                    <li key={i} className="flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Button className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold" onClick={() => router.push(`/${locale}/signup?plan=base`)}>
                    {t.pricing.base.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="temoignages" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-gray-50/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t.testimonials.title}</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">{t.testimonials.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Marc-Andre Tremblay", company: "Construction Tremblay Inc.", quote: locale === "en" ? "BuilderAI revolutionized how I work. I now do in 30 minutes what used to take 3 hours. The AI truly understands my needs." : locale === "es" ? "BuilderAI revoluciono mi forma de trabajar. Ahora hago en 30 minutos lo que antes me tomaba 3 horas." : "BuilderAI a revolutionne ma facon de travailler. Je fais maintenant en 30 minutes ce qui me prenait 3 heures avant.", rating: 5 },
              { name: "Julie Gagnon", company: "Renovations JG", quote: locale === "en" ? "The plan import and automatic dimension extraction saved me so much time. I recommend it to all contractors!" : locale === "es" ? "La importacion de planos y la extraccion automatica de dimensiones me ahorro mucho tiempo. Lo recomiendo!" : "L'import de plans et l'extraction automatique des dimensions m'a fait economiser un temps fou. Je recommande!", rating: 5 },
              { name: "Pierre Lavoie", company: "Entrepreneur General PL", quote: locale === "en" ? "Finally a solution adapted to Quebec contractors. The interface is intuitive and support is excellent." : locale === "es" ? "Finalmente una solucion adaptada a los contratistas. La interfaz es intuitiva y el soporte es excelente." : "Enfin une solution adaptee aux entrepreneurs quebecois. L'interface est intuitive et le support est excellent.", rating: 5 },
            ].map((testimonial, index) => (
              <Card key={index} className="border-gray-200">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 italic">&quot;{testimonial.quote}&quot;</p>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-orange-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">{t.cta.title}</h2>
          <p className="text-lg text-white/90 mb-8 font-medium">{t.cta.subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-orange-600 hover:bg-gray-50 text-base font-bold px-8 py-6 h-auto rounded-lg"
              onClick={() => router.push(`/${locale}/signup`)}
            >
              {t.cta.button}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-gray-900 font-bold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            BuilderAI
          </Link>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} BuilderAI. {t.footer.allRights}
          </p>
          <LanguageSwitcher currentLocale={locale} />
        </div>
      </footer>
    </div>
  )
}
