'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, 
  ArrowRight, 
  Play, 
  Pause,
  Upload, 
  MessageSquare, 
  FileSpreadsheet, 
  CheckCircle2,
  HardHat,
  Paperclip,
  Send,
  ChevronRight,
  Building2,
  Ruler,
  Package,
  Hammer
} from 'lucide-react'

const demoSteps = [
  {
    id: 'upload',
    title: 'Importer vos plans',
    description: 'Glissez-déposez vos plans PDF ou images pour démarrer l\'analyse',
    icon: Upload,
    animation: 'upload'
  },
  {
    id: 'chat',
    title: 'Discuter avec l\'agent',
    description: 'L\'agent Bob Builder analyse vos documents et pose des questions pertinentes',
    icon: MessageSquare,
    animation: 'chat'
  },
  {
    id: 'artifacts',
    title: 'Réviser les artefacts',
    description: 'Vérifiez et modifiez les informations extraites automatiquement',
    icon: Package,
    animation: 'artifacts'
  },
  {
    id: 'generate',
    title: 'Générer la soumission',
    description: 'Créez une soumission professionnelle en un clic',
    icon: FileSpreadsheet,
    animation: 'generate'
  }
]

// Simulated chat messages for demo
const demoMessages = [
  { role: 'user', content: 'Bonjour, j\'ai un projet de rénovation de cuisine à Montréal' },
  { role: 'assistant', content: 'Bonjour! Je suis Bob Builder, votre assistant pour les soumissions. Je vois que vous avez uploadé un plan. Pouvez-vous me donner plus de détails sur la superficie de la cuisine?' },
  { role: 'user', content: 'C\'est une cuisine d\'environ 150 pi² avec un îlot central' },
  { role: 'assistant', content: 'Parfait! 150 pi² avec îlot. Quel type de comptoir souhaitez-vous? (Quartz, granite, stratifié)' },
  { role: 'user', content: 'Quartz blanc avec évier sous-plan' },
  { role: 'assistant', content: 'Excellent choix! J\'ai noté: Comptoir quartz blanc + évier sous-plan. Pour les armoires, préférez-vous mélamine, thermoplastique ou bois?' },
]

// Simulated artifacts
const demoArtifacts = [
  { category: 'Projet', items: [
    { label: 'Nom', value: 'Rénovation Cuisine Montréal' },
    { label: 'Adresse', value: '1234 Rue Example, Montréal' },
    { label: 'Type', value: 'Rénovation résidentielle' },
  ]},
  { category: 'Dimensions', items: [
    { label: 'Superficie', value: '150 pi²' },
    { label: 'Linéaire comptoir', value: '18 pi.li' },
    { label: 'Îlot', value: '4\' x 6\'' },
  ]},
  { category: 'Matériaux', items: [
    { label: 'Comptoir', value: 'Quartz blanc' },
    { label: 'Évier', value: 'Sous-plan inox' },
    { label: 'Armoires', value: 'À définir' },
  ]},
]

export default function DemoPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [chatMessageIndex, setChatMessageIndex] = useState(0)
  const [typingText, setTypingText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showArtifacts, setShowArtifacts] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)

  // Auto-advance steps
  useEffect(() => {
    if (!isPlaying) return
    
    const timer = setTimeout(() => {
      if (currentStep < demoSteps.length - 1) {
        setCurrentStep(prev => prev + 1)
      } else {
        setIsPlaying(false)
      }
    }, 8000)
    
    return () => clearTimeout(timer)
  }, [currentStep, isPlaying])

  // Chat animation
  useEffect(() => {
    if (currentStep !== 1 || !isPlaying) return
    
    const messageTimer = setInterval(() => {
      setChatMessageIndex(prev => {
        if (prev < demoMessages.length - 1) return prev + 1
        return prev
      })
    }, 2000)
    
    return () => clearInterval(messageTimer)
  }, [currentStep, isPlaying])

  // Typing animation
  useEffect(() => {
    if (currentStep !== 1) return
    const currentMessage = demoMessages[chatMessageIndex]
    if (currentMessage.role === 'assistant') {
      setIsTyping(true)
      let i = 0
      const text = currentMessage.content
      setTypingText('')
      const typingInterval = setInterval(() => {
        if (i < text.length) {
          setTypingText(prev => prev + text[i])
          i++
        } else {
          setIsTyping(false)
          clearInterval(typingInterval)
        }
      }, 30)
      return () => clearInterval(typingInterval)
    }
  }, [chatMessageIndex, currentStep])

  // Artifacts animation
  useEffect(() => {
    if (currentStep === 2) {
      setTimeout(() => setShowArtifacts(true), 500)
    } else {
      setShowArtifacts(false)
    }
  }, [currentStep])

  // Generation progress
  useEffect(() => {
    if (currentStep !== 3) {
      setGenerationProgress(0)
      return
    }
    
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 2
      })
    }, 100)
    
    return () => clearInterval(interval)
  }, [currentStep])

  const goToStep = (index: number) => {
    setCurrentStep(index)
    setChatMessageIndex(0)
    setTypingText('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => router.push('/login')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          
          <div className="flex items-center gap-2">
            <HardHat className="h-6 w-6 text-orange-500" />
            <span className="font-bold text-lg">BuilderAI</span>
            <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              Demo
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-gray-400 hover:text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button 
              onClick={() => router.push('/signup')}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Essayer gratuitement
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          {demoSteps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep
            
            return (
              <button
                key={step.id}
                onClick={() => goToStep(index)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${isActive ? 'bg-orange-500 scale-110' : isCompleted ? 'bg-green-500' : 'bg-gray-700'}
                  group-hover:scale-105
                `}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  ) : (
                    <Icon className="h-6 w-6 text-white" />
                  )}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-orange-400' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </button>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{demoSteps[currentStep].title}</h2>
          <p className="text-gray-400">{demoSteps[currentStep].description}</p>
        </div>
      </div>

      {/* Demo Content Area */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
          <CardContent className="p-0">
            {/* Step 0: Upload */}
            {currentStep === 0 && (
              <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center animate-pulse">
                  <Upload className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">Glissez vos plans ici</p>
                  <p className="text-sm text-gray-500">PDF, PNG, JPG jusqu'à 10MB</p>
                </div>
                <div className="mt-8 flex items-center gap-3 text-gray-400">
                  <Paperclip className="h-5 w-5" />
                  <span className="animate-pulse">plan-cuisine-2024.pdf en cours d'upload...</span>
                </div>
              </div>
            )}

            {/* Step 1: Chat */}
            {currentStep === 1 && (
              <div className="flex h-[500px]">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {demoMessages.slice(0, chatMessageIndex + 1).map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center mr-2 flex-shrink-0">
                            <HardHat className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.role === 'user' 
                            ? 'bg-gray-700 text-white' 
                            : 'bg-gray-600 text-white'
                        }`}>
                          {i === chatMessageIndex && msg.role === 'assistant' && isTyping 
                            ? typingText + '|'
                            : msg.content
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-gray-700">
                    <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-4 py-2">
                      <input 
                        type="text" 
                        placeholder="Tapez votre message..." 
                        className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none"
                        disabled
                      />
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Artifacts */}
            {currentStep === 2 && (
              <div className="flex h-[500px]">
                {/* Mock Chat */}
                <div className="flex-1 border-r border-gray-700 p-4 opacity-50">
                  <div className="space-y-3">
                    {demoMessages.slice(0, 4).map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === 'user' ? 'bg-gray-700' : 'bg-gray-600'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Artifacts Panel */}
                <div className={`w-80 bg-gray-750 p-4 transition-all duration-500 ${showArtifacts ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold">Artefacts extraits</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {demoArtifacts.map((category, ci) => (
                      <div key={ci} className={`transition-all duration-300 delay-${ci * 200}`} style={{ animationDelay: `${ci * 200}ms` }}>
                        <div className="flex items-center gap-2 mb-2">
                          {ci === 0 && <Building2 className="h-4 w-4 text-orange-400" />}
                          {ci === 1 && <Ruler className="h-4 w-4 text-blue-400" />}
                          {ci === 2 && <Hammer className="h-4 w-4 text-green-400" />}
                          <span className="text-sm font-medium text-gray-300">{category.category}</span>
                        </div>
                        <div className="bg-gray-700 rounded-lg p-3 space-y-2">
                          {category.items.map((item, ii) => (
                            <div key={ii} className="flex justify-between text-sm">
                              <span className="text-gray-400">{item.label}</span>
                              <span className="text-white font-medium">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Generate */}
            {currentStep === 3 && (
              <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                {generationProgress < 100 ? (
                  <>
                    <FileSpreadsheet className="h-16 w-16 text-orange-500 mb-6 animate-bounce" />
                    <h3 className="text-xl font-semibold mb-4">Génération de la soumission...</h3>
                    <div className="w-64 mb-4">
                      <Progress value={generationProgress} className="h-2" />
                    </div>
                    <p className="text-gray-400 text-sm">
                      {generationProgress < 30 && "Compilation des données..."}
                      {generationProgress >= 30 && generationProgress < 60 && "Calcul des coûts..."}
                      {generationProgress >= 60 && generationProgress < 90 && "Formatage du document..."}
                      {generationProgress >= 90 && "Finalisation..."}
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-6" />
                    <h3 className="text-xl font-semibold mb-2">Soumission générée!</h3>
                    <p className="text-gray-400 mb-6">Rénovation Cuisine Montréal - 12 450,00 $</p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                        Télécharger Excel
                      </Button>
                      <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                        Télécharger PDF
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => goToStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>
          
          {currentStep < demoSteps.length - 1 ? (
            <Button
              onClick={() => goToStep(currentStep + 1)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/signup')}
              className="bg-green-500 hover:bg-green-600"
            >
              Commencer mon essai gratuit
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* CTA Banner */}
      <div className="border-t border-gray-700 bg-gray-800/50 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-xl font-bold mb-2">Prêt à créer vos soumissions?</h3>
          <p className="text-gray-400 mb-6">Essayez BuilderAI gratuitement pendant 7 jours, sans carte de crédit requise.</p>
          <div className="flex justify-center gap-4">
            <Button 
              onClick={() => router.push('/signup')}
              size="lg"
              className="bg-orange-500 hover:bg-orange-600"
            >
              Démarrer l'essai gratuit
            </Button>
            <Button 
              onClick={() => router.push('/pricing')}
              variant="outline"
              size="lg"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Voir les tarifs
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
