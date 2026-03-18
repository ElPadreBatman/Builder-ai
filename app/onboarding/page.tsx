'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, FileText, BarChart3, Settings, ArrowRight, Gift, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const steps = [
  {
    icon: FileText,
    title: 'Importer des plans',
    description: 'Uploadez vos plans PDF ou images pour que l\'agent analyse les dimensions et les détails du projet',
    tips: [
      'Formats supportés: PDF, PNG, JPG',
      'Résolution minimale: 1024x768',
      'Taille maximale: 10 MB'
    ]
  },
  {
    icon: Settings,
    title: 'Discuter avec l\'agent',
    description: 'Posez des questions sur le projet, les matériaux, le budget et les délais souhaités',
    tips: [
      'L\'agent extrait automatiquement les informations',
      'Mentionnez les modifications requises',
      'Clarifiez les spécifications incertaines'
    ]
  },
  {
    icon: BarChart3,
    title: 'Réviser les artefacts',
    description: 'Vérifiez et modifiez les informations extraites dans le panel de droite',
    tips: [
      'Mettez à jour les quantités si nécessaire',
      'Ajustez les choix de matériaux',
      'Confirmez les dimensions et surfaces'
    ]
  },
  {
    icon: FileText,
    title: 'Générer la soumission',
    description: 'Créez une soumission professionnelle formatée selon les normes du Québec',
    tips: [
      'Vérifiez tous les montants',
      'Exportez en Excel ou PDF',
      'Envoyez directement au client'
    ]
  }
]

export default function OnboardingPage() {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [userName, setUserName] = useState<string>("")
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.full_name?.split(" ")[0] || user.user_metadata?.first_name || "")
        
        // Get trial end date from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("trial_end_date")
          .eq("id", user.id)
          .single()
        
        if (profile?.trial_end_date) {
          setTrialEndDate(new Date(profile.trial_end_date))
        }
      }
    }
    loadUserData()
  }, [supabase])

  const toggleStep = (index: number) => {
    setCompletedSteps(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const daysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 7

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 mb-8 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 rounded-full">
              <Gift className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                Bienvenue{userName ? ` ${userName}` : ""} !
              </h1>
              <p className="text-orange-100 text-lg mb-4">
                Merci d'avoir choisi Construct AI pour generer vos soumissions de construction.
              </p>
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-4 py-2 w-fit">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">
                  Votre essai gratuit de 7 jours est actif - {daysRemaining} jour{daysRemaining > 1 ? "s" : ""} restant{daysRemaining > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-3">Comment utiliser Construct AI</h2>
          <p className="text-lg text-gray-600 mb-8">
            Apprenez comment creer des soumissions professionnelles en quelques minutes
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => router.push('/chat')} size="lg" className="bg-orange-500 hover:bg-orange-600">
              Commencer maintenant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={() => router.push('/pricing')} variant="outline" size="lg">
              Voir les tarifs
            </Button>
          </div>
        </div>

        {/* Steps */}
        <div className="grid gap-6 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isCompleted = completedSteps.includes(index)
            
            return (
              <Card
                key={index}
                className="cursor-pointer transition-all hover:shadow-lg"
                onClick={() => toggleStep(index)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg flex-shrink-0">
                      <Icon className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">
                            Étape {index + 1}: {step.title}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {step.description}
                          </CardDescription>
                        </div>
                        {isCompleted && (
                          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 ml-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {isCompleted && (
                  <CardContent>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-3">Conseils pratiques:</h4>
                      <ul className="space-y-2">
                        {step.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-orange-600 font-bold mt-0.5">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Features Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Fonctionnalités principales</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Extraction automatique</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  L'IA analyse les plans et extrait automatiquement les dimensions, quantités et matériaux
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Panel artefacts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Modifiez facilement les informations extraites avant de générer votre soumission
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export professionnel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Générez des soumissions formatées en Excel ou PDF conformes aux normes du Québec
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dashboard intuitif</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Gérez tous vos projets en un seul endroit avec un tableau de bord complet
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gestion d'équipe</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Invitez vos collègues et collaborez sur les mêmes projets (plan Pro)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Support personnalisé</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Bénéficiez d'un support email dédié et de mises à jour régulières (plan Pro)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-lg border p-8">
          <h2 className="text-2xl font-bold mb-6">Questions fréquemment posées</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2">Puis-je essayer avant d'acheter?</h3>
              <p className="text-sm text-gray-600">
                Oui! Vous disposez de 7 jours d'essai gratuit complet sans obligation d'achat.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Comment fonctionne la facturation?</h3>
              <p className="text-sm text-gray-600">
                Facturation mensuelle ou annuelle (avec 20% de rabais). Vous pouvez modifier votre plan à tout moment.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Mes données sont-elles sécurisées?</h3>
              <p className="text-sm text-gray-600">
                Oui. Nous utilisons le chiffrement bancaire et conformons aux standards OWASP et GDPR.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Y a-t-il une limite au nombre de projets?</h3>
              <p className="text-sm text-gray-600">
                Le plan Base: 20 soumissions/mois. Plan Pro: 30 projets simultanés, soumissions illimitées.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button onClick={() => router.push('/pricing')} size="lg" className="bg-orange-500 hover:bg-orange-600">
            Choisir mon plan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
