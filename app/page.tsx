import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { i18n, type Locale } from "@/lib/i18n/config"

export default async function RootPage() {
  // Get locale from cookie or use default
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value
  const locale: Locale = (localeCookie && i18n.locales.includes(localeCookie as Locale)) 
    ? (localeCookie as Locale) 
    : i18n.defaultLocale
  
  redirect(`/${locale}`)
}

// Keep old code below for reference during migration - will be removed
function _OldLandingPage() {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true)
      }
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

  return (
    <div className="min-h-screen bg-white relative">
      {/* Animated Background */}
      <AnimatedLightBackground />
      
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">BuilderAI</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#fonctionnalites" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Fonctionnalites
              </Link>
              <Link href="#comment-ca-marche" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Comment ca marche
              </Link>
              <Link href="#tarifs" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Tarifs
              </Link>
              <Link href="#temoignages" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                Temoignages
              </Link>
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {isLoggedIn ? (
                <Button onClick={() => router.push("/chat")} className="bg-orange-500 hover:bg-orange-600">
                  Acceder au chat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => router.push("/login")}>
                    Se connecter
                  </Button>
                  <Button onClick={() => router.push("/signup")} className="bg-orange-500 hover:bg-orange-600">
                    Essai gratuit
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-4">
            <Link href="#fonctionnalites" className="block text-gray-600 hover:text-gray-900">
              Fonctionnalites
            </Link>
            <Link href="#comment-ca-marche" className="block text-gray-600 hover:text-gray-900">
              Comment ca marche
            </Link>
            <Link href="#tarifs" className="block text-gray-600 hover:text-gray-900">
              Tarifs
            </Link>
            <Link href="#temoignages" className="block text-gray-600 hover:text-gray-900">
              Temoignages
            </Link>
            <div className="pt-4 space-y-2">
              {isLoggedIn ? (
                <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => router.push("/dashboard")}>
                  Acceder au dashboard
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
                    Se connecter
                  </Button>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => router.push("/signup")}>
                    Essai gratuit
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
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-6 bg-orange-100 text-orange-700 border-orange-200 inline-flex items-center gap-2 px-4 py-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Propulse par l&apos;IA</span>
              </Badge>
            </motion.div>
            
            <motion.h1 
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6 text-balance"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Creez vos soumissions en{" "}
              <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">30 minutes</span>{" "}
              au lieu de plusieurs heures
            </motion.h1>
            
            <motion.p 
              className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed text-pretty"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              BuilderAI est votre assistant intelligent pour creer des soumissions professionnelles. 
              Importez vos plans, discutez avec l&apos;IA, et generez des documents complets automatiquement.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-base px-8 py-6 h-auto rounded-xl shadow-lg shadow-orange-500/25"
                  onClick={() => router.push("/signup")}
                >
                  Commencer l&apos;essai gratuit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 py-6 h-auto rounded-xl border-gray-200 text-gray-900 hover:bg-gray-50"
                  onClick={() => router.push("/demo")}
                >
                  Voir la demonstration
                </Button>
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              {[
                { value: "30 min", label: "par soumission" },
                { value: "85%", label: "temps economise" },
                { value: "500+", label: "entrepreneurs actifs" },
                { value: "4.9/5", label: "satisfaction client" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont vous avez besoin pour vos soumissions
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Une plateforme complete pour simplifier et accelerer votre processus de soumission
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: MessageSquare,
                title: "Assistant IA conversationnel",
                description: "Discutez naturellement avec l'IA pour extraire les informations de vos plans et definir les specifications du projet.",
              },
              {
                icon: FileText,
                title: "Import de plans PDF",
                description: "Telechargez vos plans architecturaux et l'IA les analyse automatiquement pour extraire les dimensions et details.",
              },
              {
                icon: Zap,
                title: "Generation automatique",
                description: "Generez des soumissions completes au format Excel ou PDF en un clic, pret a envoyer a vos clients.",
              },
              {
                icon: BarChart3,
                title: "Suivi des projets",
                description: "Gerez tous vos projets de soumission depuis un tableau de bord centralise avec suivi du statut.",
              },
              {
                icon: Users,
                title: "Collaboration d'equipe",
                description: "Invitez vos collegues a collaborer sur les projets avec gestion des roles et permissions.",
              },
              {
                icon: Shield,
                title: "Donnees securisees",
                description: "Vos plans et donnees sont proteges avec un chiffrement de niveau entreprise.",
              },
            ].map((feature, index) => (
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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Comment ca marche?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Trois etapes simples pour creer vos soumissions professionnelles
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Importez vos plans",
                description: "Telechargez vos plans PDF ou images. Notre IA les analyse et extrait automatiquement les informations cles.",
              },
              {
                step: "02",
                title: "Discutez avec l'assistant",
                description: "Affinez les details avec notre assistant IA. Il vous pose les bonnes questions et comprend vos specifications.",
              },
              {
                step: "03",
                title: "Generez la soumission",
                description: "En un clic, obtenez une soumission complete au format Excel ou PDF, pret a envoyer a votre client.",
              },
            ].map((step, index) => (
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

      {/* Pricing Preview */}
      <section id="tarifs" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Des plans adaptes a vos besoins
          </h2>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-12 font-medium">
            Commencez avec un essai gratuit de 7 jours. Aucune carte de credit requise.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            {/* Essai gratuit */}
            <Card className="border-gray-300 bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardContent className="p-8 text-center flex flex-col flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-3">Essai Gratuit</h3>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">0$</div>
                <p className="text-sm text-gray-700 mb-6 font-medium">7 jours pour tester</p>
                <ul className="text-sm text-gray-800 space-y-3 font-medium mb-8">
                  <li className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>5 soumissions</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>1 utilisateur</span>
                  </li>
                </ul>
                <div className="mt-auto">
                  <Button
                    className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold"
                    onClick={() => router.push("/signup?plan=free")}
                  >
                    Commencer gratuitement
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-orange-500 border-2 shadow-xl relative bg-white flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-orange-500 text-white font-bold text-xs px-3 py-1">Le plus populaire</Badge>
              </div>
              <CardContent className="p-8 text-center flex flex-col flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-3">Pro</h3>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">69.99$/mois</div>
                <p className="text-sm text-gray-700 mb-6 font-medium">ou 55.99$/mois annuel</p>
                <ul className="text-sm text-gray-800 space-y-3 font-medium mb-8">
                  <li className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>Soumissions illimitees</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>3 utilisateurs</span>
                  </li>
                </ul>
                <div className="mt-auto">
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    onClick={() => router.push("/signup?plan=pro&interval=monthly")}
                  >
                    Choisir Pro
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Base */}
            <Card className="border-gray-300 bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardContent className="p-8 text-center flex flex-col flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-3">Base</h3>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">39.99$/mois</div>
                <p className="text-sm text-gray-700 mb-6 font-medium">Ideal pour debuter</p>
                <ul className="text-sm text-gray-800 space-y-3 font-medium mb-8">
                  <li className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>20 soumissions/mois</span>
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>1 utilisateur</span>
                  </li>
                </ul>
                <div className="mt-auto">
                  <Button
                    className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold"
                    onClick={() => router.push("/signup?plan=base&interval=monthly")}
                  >
                    Choisir Base
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
            onClick={() => router.push("/pricing")}
          >
            Voir tous les tarifs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Testimonials */}
      <section id="temoignages" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-gray-50/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Ce que disent nos clients
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Des entrepreneurs satisfaits qui ont transforme leur processus de soumission
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Marc-Andre Tremblay",
                company: "Construction Tremblay Inc.",
                quote: "BuilderAI a revolutionne ma facon de travailler. Je fais maintenant en 30 minutes ce qui me prenait 3 heures avant. L'IA comprend vraiment mes besoins.",
                rating: 5,
              },
              {
                name: "Julie Gagnon",
                company: "Renovations JG",
                quote: "L'import de plans et l'extraction automatique des dimensions m'a fait economiser un temps fou. Je recommande a tous les entrepreneurs!",
                rating: 5,
              },
              {
                name: "Pierre Lavoie",
                company: "Entrepreneur General PL",
                quote: "Enfin une solution adaptee aux entrepreneurs quebecois. L'interface est intuitive et le support est excellent. Ca vaut vraiment l'investissement.",
                rating: 5,
              },
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
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Pret a transformer vos soumissions?
          </h2>
          <p className="text-lg text-white/90 mb-8 font-medium">
            Rejoignez des centaines d&apos;entrepreneurs qui economisent du temps chaque jour.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-orange-600 hover:bg-gray-50 text-base font-bold px-8 py-6 h-auto rounded-lg"
              onClick={() => router.push("/signup")}
            >
              Commencer l&apos;essai gratuit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="text-white/95 text-sm font-medium">
              Aucune carte de credit requise
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-900 font-bold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            BuilderAI
          </Link>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} BuilderAI. Tous droits reserves.
          </p>
        </div>
      </footer>
    </div>
  )
}
