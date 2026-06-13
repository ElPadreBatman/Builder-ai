'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import {
  Building2,
  Bath,
  UtensilsCrossed,
  ArrowDownToLine,
  Home,
  TreePine,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'
import type { ProjetData, ProjetType, Delai } from '@/app/estimateur/EstimateurClient'

const PROJECT_TYPES: { value: ProjetType; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: 'Ajout / Agrandissement', label: 'Ajout / Agrandissement', Icon: Building2 },
  { value: 'Salle de bain', label: 'Salle de bain', Icon: Bath },
  { value: 'Cuisine', label: 'Cuisine', Icon: UtensilsCrossed },
  { value: 'Sous-sol', label: 'Sous-sol', Icon: ArrowDownToLine },
  { value: 'Revêtement extérieur', label: 'Revêtement extérieur', Icon: Home },
  { value: 'Patio / Terrasse', label: 'Patio / Terrasse', Icon: TreePine },
  { value: 'Autre', label: 'Autre projet', Icon: HelpCircle },
]

const DELAI_OPTIONS: { value: Delai; label: string; sub: string }[] = [
  { value: 'ASAP', label: 'Dès que possible', sub: 'Projet urgent' },
  { value: 'Cette saison', label: 'Cette saison', sub: 'Dans les 6 mois' },
  { value: "J'explore", label: "J'explore", sub: 'Planification' },
]

export default function PhaseProjet({ onSubmit }: { onSubmit: (data: ProjetData) => void }) {
  const [type, setType] = useState<ProjetType | ''>('')
  const [description, setDescription] = useState('')
  const [ville, setVille] = useState('')
  const [delai, setDelai] = useState<Delai | ''>('')
  const [touched, setTouched] = useState(false)

  const isValid = type !== '' && description.trim().length >= 20 && delai !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!isValid) return
    onSubmit({ type: type as ProjetType, description, ville, delai: delai as Delai })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        {/* Type de projet */}
        <fieldset>
          <legend className="text-white font-semibold text-sm tracking-widest uppercase mb-3">
            Type de projet
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROJECT_TYPES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={[
                  'flex flex-col items-center gap-2 px-3 py-4 rounded-[3px] border text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                  type === value
                    ? 'border-sky-400 bg-sky-400/15 text-sky-300'
                    : 'border-white/10 bg-white/3 text-slate-400 hover:border-sky-400/40 hover:bg-sky-400/5 hover:text-sky-300',
                ].join(' ')}
                aria-pressed={type === value}
              >
                <Icon className="w-5 h-5" />
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
          {touched && !type && (
            <p className="text-red-400 text-xs mt-2">Sélectionne un type de projet.</p>
          )}
        </fieldset>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-white font-semibold text-sm tracking-widest uppercase mb-2">
            Décris ton projet
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Ex : ajout d'étage 15×20 au-dessus du garage à Mascouche, avec 2 chambres et une salle de bain, finition standard"
            className="w-full bg-[#071328] border border-sky-400/20 text-white rounded-[3px] px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 resize-none transition-colors"
            aria-required
          />
          <p className="text-slate-500 text-xs mt-1">
            Plus tu es précis·e (dimensions, ville, état actuel), plus l&apos;estimation sera fiable.
          </p>
          {touched && description.trim().length < 20 && (
            <p className="text-red-400 text-xs mt-1">Décris ton projet en au moins quelques mots.</p>
          )}
        </div>

        {/* Ville */}
        <div>
          <label htmlFor="ville" className="block text-white font-semibold text-sm tracking-widest uppercase mb-2">
            Ville <span className="text-slate-500 font-normal normal-case">(optionnel)</span>
          </label>
          <input
            id="ville"
            type="text"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="Ex : Mascouche, Terrebonne, Laval…"
            className="w-full bg-[#071328] border border-sky-400/20 text-white rounded-[3px] px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-colors"
          />
        </div>

        {/* Échéancier */}
        <fieldset>
          <legend className="block text-white font-semibold text-sm tracking-widest uppercase mb-3">
            Échéancier souhaité
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {DELAI_OPTIONS.map(({ value, label, sub }) => (
              <label
                key={value}
                className={[
                  'flex flex-col items-center text-center px-3 py-3 rounded-[3px] border cursor-pointer transition-all duration-150',
                  delai === value
                    ? 'border-sky-400 bg-sky-400/15 text-sky-300'
                    : 'border-white/10 bg-white/3 text-slate-400 hover:border-sky-400/40 hover:bg-sky-400/5 hover:text-sky-300',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="delai"
                  value={value}
                  checked={delai === value}
                  onChange={() => setDelai(value)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[10px] mt-0.5 opacity-70">{sub}</span>
              </label>
            ))}
          </div>
          {touched && !delai && (
            <p className="text-red-400 text-xs mt-2">Sélectionne un échéancier.</p>
          )}
        </fieldset>

        {/* Submit */}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 text-[#07101f] font-bold text-sm tracking-widest uppercase rounded-[3px] px-6 py-4 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1b3e]"
        >
          Obtenir mon estimation gratuite
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}
