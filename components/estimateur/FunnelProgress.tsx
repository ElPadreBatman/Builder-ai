'use client'

import type { ComponentType } from 'react'
import { FileText, Lock, CheckCircle2 } from 'lucide-react'

type Phase = 1 | 2 | 3

const steps: { num: Phase; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { num: 1, label: 'Mon projet', Icon: FileText },
  { num: 2, label: 'Mes coordonnées', Icon: Lock },
  { num: 3, label: 'Mes résultats', Icon: CheckCircle2 },
]

export default function FunnelProgress({ currentPhase }: { currentPhase: Phase }) {
  return (
    <nav aria-label="Étapes du formulaire" className="flex items-center justify-center gap-0">
      {steps.map(({ num, label, Icon }, idx) => {
        const isActive = currentPhase === num
        const isDone = currentPhase > num

        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-10 h-10 rounded-[3px] flex items-center justify-center border transition-all duration-300',
                  isActive
                    ? 'bg-sky-400 border-sky-400 text-[#07101f]'
                    : isDone
                      ? 'bg-sky-400/20 border-sky-400/60 text-sky-400'
                      : 'bg-white/5 border-white/15 text-slate-500',
                ].join(' ')}
                aria-current={isActive ? 'step' : undefined}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={[
                  'text-[10px] font-medium tracking-widest uppercase transition-colors duration-300 hidden sm:block',
                  isActive ? 'text-sky-400' : isDone ? 'text-sky-400/70' : 'text-slate-600',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={[
                  'w-12 sm:w-20 h-px mx-2 transition-colors duration-500',
                  currentPhase > num ? 'bg-sky-400/50' : 'bg-white/10',
                ].join(' ')}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
