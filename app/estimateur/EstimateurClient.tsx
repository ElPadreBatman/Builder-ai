'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import FunnelProgress from '@/components/estimateur/FunnelProgress'
import PhaseProjet from '@/components/estimateur/PhaseProjet'
import PhaseCoordonnees from '@/components/estimateur/PhaseCoordonnees'
import PhaseResultats from '@/components/estimateur/PhaseResultats'

// Exported types consumed by the child components
export type ProjetType =
  | 'Ajout / Agrandissement'
  | 'Salle de bain'
  | 'Cuisine'
  | 'Sous-sol'
  | 'Revêtement extérieur'
  | 'Patio / Terrasse'
  | 'Autre'

export type Delai = 'ASAP' | 'Cette saison' | "J'explore"

export interface ProjetData {
  type: ProjetType
  description: string
  ville: string
  delai: Delai
}

export interface LeadData {
  prenom: string
  telephone: string
  villeContact?: string
}

export interface EstimationResult {
  fourchette_bas: number
  fourchette_haut: number
  confiance: 'haute' | 'moyenne' | 'faible'
  resume_projet: string
  facteurs_cles: string[]
  note_visite: string
}

function normalizePhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, '')
  return `+1${digits}`
}

const fadeVariants = {
  enter: { opacity: 0, y: 18 },
  center: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
}

export default function EstimateurClient() {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [projet, setProjet] = useState<ProjetData | null>(null)
  const [estimation, setEstimation] = useState<EstimationResult | null>(null)

  async function handleProjetSubmit(data: ProjetData) {
    setProjet(data)
    setIsLoading(true)
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result: EstimationResult = await res.json()
      setEstimation(result)
    } catch {
      setEstimation({
        fourchette_bas: 0,
        fourchette_haut: 0,
        confiance: 'faible',
        resume_projet: data.description,
        facteurs_cles: ['Dimensions du projet', 'État de la structure existante', 'Niveau de finition'],
        note_visite: "Une visite permettra d'établir un prix précis adapté à votre situation.",
      })
    } finally {
      setIsLoading(false)
      setPhase(2)
    }
  }

  function handleCoordonneesSubmit(lead: LeadData) {
    if (!projet || !estimation) return

    const payload = {
      source: 'estimateur_ia_gestion_af',
      timestamp: new Date().toISOString(),
      lead: {
        prenom: lead.prenom,
        telephone: normalizePhone(lead.telephone),
        ville: lead.villeContact ?? '',
      },
      projet: {
        type: projet.type,
        description: projet.description,
        delai: projet.delai,
      },
      estimation: {
        bas: estimation.fourchette_bas,
        haut: estimation.fourchette_haut,
        confiance: estimation.confiance,
        resume_projet: estimation.resume_projet,
        facteurs_cles: estimation.facteurs_cles,
      },
    }

    // Fire-and-forget: ne bloque pas l'affichage du résultat
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})

    setPhase(3)
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Millimeter grid overlay */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-xl mx-auto px-4 pt-8 pb-16 min-h-screen flex flex-col">
        {/* Header */}
        <header className="text-center mb-8">
          <p className="text-sky-400/70 text-[10px] tracking-[0.25em] uppercase font-medium mb-3">
            Gestion A.F. Construction inc. · RBQ 5806-1391-01
          </p>
          <h1 className="text-white font-bold leading-none mb-2" style={{ fontSize: 'clamp(1.8rem, 6vw, 2.75rem)' }}>
            Combien va coûter ta réno ?
          </h1>
          <p className="text-slate-400 text-sm">
            Décris ton projet en 2 minutes. On te donne une fourchette honnête — sans visite, sans engagement.
          </p>
        </header>

        {/* Step indicator */}
        <FunnelProgress currentPhase={phase} />

        {/* Content area */}
        <div className="flex-1 mt-7">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                variants={fadeVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col items-center justify-center py-20 gap-6"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-[4px] border border-sky-400/30 bg-sky-400/10 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-white font-semibold text-lg">On analyse ton projet…</p>
                  <p className="text-slate-400 text-sm">
                    On croise les détails avec les prix courants dans ta région.
                  </p>
                </div>
                <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ animation: 'progress-bar 2.5s ease-in-out infinite' }}
                  />
                </div>
                <style>{`
                  @keyframes progress-bar {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 80%; }
                    100% { width: 0%; margin-left: 100%; }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    @keyframes progress-bar { 0%, 100% { width: 60%; margin-left: 20%; } }
                  }
                `}</style>
              </motion.div>
            ) : phase === 1 ? (
              <motion.div
                key="phase1"
                variants={fadeVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="bg-[#0d1b3e]/60 border border-white/8 rounded-[4px] p-5 sm:p-6">
                  <PhaseProjet onSubmit={handleProjetSubmit} />
                </div>
              </motion.div>
            ) : phase === 2 ? (
              <motion.div
                key="phase2"
                variants={fadeVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <PhaseCoordonnees estimation={estimation!} onSubmit={handleCoordonneesSubmit} />
              </motion.div>
            ) : (
              <motion.div
                key="phase3"
                variants={fadeVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <PhaseResultats estimation={estimation!} projet={projet!} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
