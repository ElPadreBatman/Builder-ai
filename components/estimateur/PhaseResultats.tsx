'use client'

import { CheckCircle2, Calendar, MessageSquare, Info } from 'lucide-react'
import type { EstimationResult, ProjetData } from '@/app/estimateur/EstimateurClient'

// Cal.com team calendar — override via NEXT_PUBLIC_CAL_LINK env var if needed
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK ?? 'team/gestion-af-construction'

function formatCAD(n: number): string {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n)
}

const CONFIANCE_CONFIG = {
  haute: { label: 'Fiabilité élevée', className: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
  moyenne: { label: 'Fiabilité moyenne', className: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  faible: { label: 'Fourchette large', className: 'bg-orange-400/15 text-orange-400 border-orange-400/30' },
}

export default function PhaseResultats({
  estimation,
  projet,
}: {
  estimation: EstimationResult
  projet: ProjetData
}) {
  const conf = CONFIANCE_CONFIG[estimation.confiance] ?? CONFIANCE_CONFIG.faible
  const isDemoMode = estimation.fourchette_bas === 0 && estimation.fourchette_haut === 0

  return (
    <div className="space-y-5">
      {/* SMS confirmation banner */}
      <div className="flex items-start gap-3 bg-emerald-400/8 border border-emerald-400/25 rounded-[4px] px-4 py-3">
        <MessageSquare className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-emerald-300 text-sm">
          <strong>Jade prépare ton estimation détaillée.</strong> Tu recevras un texto sous peu avec ta fourchette et les prochaines étapes.
        </p>
      </div>

      {/* Main result card */}
      <div className="bg-[#0d1b3e]/70 border border-sky-400/25 rounded-[4px] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-1">
              Estimation préliminaire IA — {projet.type}
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              {estimation.resume_projet}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] font-semibold tracking-widest uppercase border rounded-[3px] px-2 py-1 ${conf.className}`}>
            {conf.label}
          </span>
        </div>

        {/* Price range */}
        {isDemoMode ? (
          <div className="bg-sky-400/8 border border-sky-400/20 rounded-[3px] p-4">
            <p className="text-slate-400 text-sm">
              Mode démo actif — configure <code className="text-sky-400">ANTHROPIC_API_KEY</code> pour générer une vraie estimation.
            </p>
          </div>
        ) : (
          <div className="border-t border-white/8 pt-5">
            <p className="text-slate-500 text-xs tracking-widest uppercase mb-1">Fourchette estimée (avant taxes)</p>
            <p className="text-white text-4xl sm:text-5xl font-bold tabular-nums leading-none">
              {formatCAD(estimation.fourchette_bas)}
            </p>
            <p className="text-slate-500 text-lg mt-1 mb-0.5">—</p>
            <p className="text-sky-400 text-4xl sm:text-5xl font-bold tabular-nums leading-none">
              {formatCAD(estimation.fourchette_haut)}
            </p>
          </div>
        )}

        {/* Key factors */}
        {estimation.facteurs_cles.length > 0 && (
          <div className="border-t border-white/8 pt-5">
            <p className="text-slate-400 text-xs tracking-widest uppercase mb-3">Facteurs qui influencent le prix</p>
            <ul className="space-y-2">
              {estimation.facteurs_cles.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Note visite */}
        {estimation.note_visite && (
          <div className="flex items-start gap-3 bg-sky-400/5 border border-sky-400/15 rounded-[3px] px-4 py-3">
            <Info className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
            <p className="text-slate-300 text-sm">{estimation.note_visite}</p>
          </div>
        )}
      </div>

      {/* CTA — Cal.com popup (data-cal-link is picked up by embed.js loaded in layout) */}
      <button
        data-cal-namespace="visite"
        data-cal-link={CAL_LINK}
        data-cal-config='{"layout":"month_view"}'
        className="flex items-center justify-center gap-2 w-full bg-[#facc15] hover:bg-[#fde047] active:bg-[#eab308] text-[#07101f] font-bold text-sm tracking-widest uppercase rounded-[3px] px-6 py-4 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1b3e]"
      >
        <Calendar className="w-4 h-4" />
        Réserver ma visite gratuite
      </button>

      {/* Legal disclaimer */}
      <p className="text-slate-600 text-[11px] leading-relaxed text-center border-t border-white/5 pt-4">
        Estimation préliminaire générée par intelligence artificielle, fournie à titre indicatif uniquement.
        Ne constitue pas une soumission. Le prix final est établi après visite et évaluation sur place.
        Gestion A.F. Construction inc. — RBQ 5806-1391-01.
      </p>
    </div>
  )
}
