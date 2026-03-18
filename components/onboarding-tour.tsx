"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { X, ChevronLeft, ChevronRight, HardHat } from "lucide-react"
import { cn } from "@/lib/utils"

// Tour step definition
export interface TourStep {
  target: string // CSS selector for the target element
  title: string
  content: string
  placement?: "top" | "bottom" | "left" | "right"
  spotlightPadding?: number
  action?: () => void // Optional action when step is shown
}

interface TourContextType {
  isActive: boolean
  currentStep: number
  steps: TourStep[]
  startTour: (steps: TourStep[]) => void
  endTour: () => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
}

const TourContext = createContext<TourContextType | null>(null)

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error("useTour must be used within TourProvider")
  }
  return context
}

// Welcome modal component
function WelcomeModal({ 
  onStart, 
  onSkip 
}: { 
  onStart: () => void
  onSkip: () => void 
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center animate-in fade-in zoom-in-95 duration-300">
        {/* Logo */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
          <HardHat className="h-8 w-8 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Bienvenue sur BuilderAI
        </h2>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          Decouvrez comment creer des soumissions professionnelles en quelques minutes. 
          Ce guide vous montrera les fonctionnalites cles de la plateforme.
        </p>
        
        <Button 
          onClick={onStart}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base font-medium mb-3"
        >
          Commencer la visite guidee
        </Button>
        
        <button 
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Passer la visite
        </button>
      </div>
    </div>
  )
}

// Spotlight overlay component
function SpotlightOverlay({ 
  targetRect, 
  padding = 8 
}: { 
  targetRect: DOMRect | null
  padding?: number 
}) {
  if (!targetRect) return null

  const spotlightStyle = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  }

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {/* Dark overlay with hole */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect 
              x={spotlightStyle.left} 
              y={spotlightStyle.top} 
              width={spotlightStyle.width} 
              height={spotlightStyle.height}
              rx="8"
              fill="black" 
            />
          </mask>
        </defs>
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0,0,0,0.6)" 
          mask="url(#spotlight-mask)" 
        />
      </svg>
      
      {/* Spotlight border glow */}
      <div 
        className="absolute rounded-lg ring-4 ring-orange-400/50 ring-offset-2 ring-offset-transparent"
        style={{
          top: spotlightStyle.top,
          left: spotlightStyle.left,
          width: spotlightStyle.width,
          height: spotlightStyle.height,
        }}
      />
    </div>
  )
}

// Tooltip component
function TourTooltip({
  step,
  currentIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep
  currentIndex: number
  totalSteps: number
  targetRect: DOMRect | null
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const placement = step.placement || "bottom"

  useEffect(() => {
    if (!targetRect) return

    const tooltipWidth = 320
    const tooltipHeight = 180
    const gap = 16

    let top = 0
    let left = 0

    switch (placement) {
      case "top":
        top = targetRect.top - tooltipHeight - gap
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
      case "bottom":
        top = targetRect.bottom + gap
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.left - tooltipWidth - gap
        break
      case "right":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.right + gap
        break
    }

    // Keep tooltip within viewport
    const padding = 16
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding))

    setPosition({ top, left })
  }, [targetRect, placement])

  if (!targetRect) return null

  return (
    <div
      className="fixed z-[9999] w-80 bg-white rounded-xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ top: position.top, left: position.left }}
    >
      {/* Close button */}
      <button
        onClick={onSkip}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
            <HardHat className="h-3.5 w-3.5 text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900">{step.title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{step.content}</p>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100 flex items-center justify-between">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i === currentIndex ? "bg-orange-500" : "bg-gray-300"
              )}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          {currentIndex > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              className="h-8 px-3"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
          )}
          <Button
            size="sm"
            onClick={onNext}
            className="h-8 px-3 bg-orange-500 hover:bg-orange-600"
          >
            {currentIndex === totalSteps - 1 ? "Terminer" : "Suivant"}
            {currentIndex < totalSteps - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Main tour provider
export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update target element position
  useEffect(() => {
    if (!isActive || steps.length === 0) {
      setTargetRect(null)
      return
    }

    const updateTargetRect = () => {
      const step = steps[currentStep]
      if (!step) return

      const element = document.querySelector(step.target)
      if (element) {
        const rect = element.getBoundingClientRect()
        setTargetRect(rect)
        
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: "smooth", block: "center" })
        
        // Execute step action if any
        if (step.action) {
          step.action()
        }
      } else {
        setTargetRect(null)
      }
    }

    // Small delay to allow DOM to update
    const timer = setTimeout(updateTargetRect, 100)
    
    // Update on resize
    window.addEventListener("resize", updateTargetRect)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", updateTargetRect)
    }
  }, [isActive, currentStep, steps])

  const startTour = useCallback((tourSteps: TourStep[]) => {
    setSteps(tourSteps)
    setShowWelcome(true)
  }, [])

  const beginTour = useCallback(() => {
    setShowWelcome(false)
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const endTour = useCallback(() => {
    setIsActive(false)
    setShowWelcome(false)
    setCurrentStep(0)
    setSteps([])
    setTargetRect(null)
    
    // Mark tour as completed in localStorage
    localStorage.setItem("builderai-tour-completed", "true")
  }, [])

  const skipTour = useCallback(() => {
    endTour()
  }, [endTour])

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      endTour()
    }
  }, [currentStep, steps.length, endTour])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const value: TourContextType = {
    isActive,
    currentStep,
    steps,
    startTour,
    endTour,
    nextStep,
    prevStep,
    skipTour,
  }

  return (
    <TourContext.Provider value={value}>
      {children}
      
      {mounted && createPortal(
        <>
          {/* Welcome modal */}
          {showWelcome && (
            <WelcomeModal onStart={beginTour} onSkip={skipTour} />
          )}
          
          {/* Tour overlay */}
          {isActive && steps.length > 0 && (
            <>
              {/* Click blocker */}
              <div 
                className="fixed inset-0 z-[9997]" 
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Spotlight */}
              <SpotlightOverlay 
                targetRect={targetRect} 
                padding={steps[currentStep]?.spotlightPadding || 8}
              />
              
              {/* Tooltip */}
              <TourTooltip
                step={steps[currentStep]}
                currentIndex={currentStep}
                totalSteps={steps.length}
                targetRect={targetRect}
                onNext={nextStep}
                onPrev={prevStep}
                onSkip={skipTour}
              />
            </>
          )}
        </>,
        document.body
      )}
    </TourContext.Provider>
  )
}

// Hook to auto-start tour for new users
export function useAutoStartTour(tourSteps: TourStep[], delay = 1000) {
  const { startTour } = useTour()
  
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem("builderai-tour-completed")
    
    if (!hasCompletedTour) {
      const timer = setTimeout(() => {
        startTour(tourSteps)
      }, delay)
      
      return () => clearTimeout(timer)
    }
  }, [startTour, tourSteps, delay])
}

// Predefined tour steps for the chat page
export const chatTourSteps: TourStep[] = [
  {
    target: "[data-tour='new-conversation']",
    title: "Nouvelle conversation",
    content: "Cliquez ici pour demarrer un nouveau projet de soumission. Chaque conversation represente un projet distinct.",
    placement: "right",
  },
]

// OnboardingTour - Standalone wrapper that uses TourProvider internally
interface OnboardingTourProps {
  tour: {
    id: string
    name: string
    steps: TourStep[]
  }
  onClose: () => void
}

export function OnboardingTour({ tour, onClose }: OnboardingTourProps) {
  return (
    <TourProvider>
      <OnboardingTourInner tour={tour} onClose={onClose} />
    </TourProvider>
  )
}

function OnboardingTourInner({ tour, onClose }: OnboardingTourProps) {
  const { startTour, endTour } = useTour()

  useEffect(() => {
    startTour(tour.steps)
    return () => endTour()
  }, [])

  return null
}
