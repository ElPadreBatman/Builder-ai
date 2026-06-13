'use client'

import { useState } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import type { EstimationResult, LeadData } from '@/app/estimateur/EstimateurClient'

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function formatCAD(n: number): string {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function PhaseCoordonnees({
  estimation,
  onSubmit,
}: {
  estimation: EstimationResult
  onSubmit: (lead: LeadData) => void
}) {
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [villeContact, setVilleContact] = useState('')
  const [touched, setTouched] = useState(false)

  const phoneDigits = telephone.replace(/\D/g, '')
  const isValid = prenom.trim().length >= 2 && phoneDigits.length === 10

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTelephone(formatPhone(e.target.value))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!isValid) return
    onSubmit({ prenom: prenom.trim(), telephone, villeContact: villeContact.trim() || undefined })
  }

  return (
    <div className="space-y-5">
      {/* Blurred preview */}
      <div className="relative rounded-[4px] border border-sky-400/20 overflow-hidden">
        <div className="p-6 bg-[#0d1b3e]/60 select-none pointer-events-none" aria-hidden>
          <p className="text-slate-400 text-xs tracking-widest uppercase mb-3">Ton estimation IA</p>
          <div className="blur-md">
            <p className="text-sky-400 text-3xl sm:text-4xl font-bold tabular-nums">
              {formatCAD(estimation.fourchette_bas)}&nbsp;—&nbsp;{formatCAD(estimation.fourchette_haut)}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              {estimation.resume_projet}
            </p>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07101f]/75 backdrop-blur-[2px]">
          <div className="bg-sky-400/10 border border-sky-400/30 rounded-[3px] p-3 mb-3">
            <Lock className="w-6 h-6 text-sky-400" />
          </div>
          <p className="text-white font-bold text-base">Estimation prête</p>
          <p className="text-slate-400 text-xs mt-1">Identifie-toi pour la déverrouiller</p>
        </div>
      </div>

      {/* Gate form */}
      <div className="bg-[#0d1b3e]/50 border border-white/8 rounded-[4px] p-5">
        <h2 className="text-white font-bold text-lg mb-1">
          Où on t&apos;envoie ton estimation ?
        </h2>
        <p className="text-slate-400 text-sm mb-5">
          Un texto de confirmation avec ta fourchette t&apos;attend.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="prenom" className="block text-xs text-slate-400 tracking-widest uppercase mb-1.5">
              Prénom
            </label>
            <input
              id="prenom"
              type="text"
              autoComplete="given-name"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Ton prénom"
              className="w-full bg-[#071328] border border-sky-400/20 text-white rounded-[3px] px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-colors"
              aria-required
            />
            {touched && prenom.trim().length < 2 && (
              <p className="text-red-400 text-xs mt-1">Entre ton prénom.</p>
            )}
          </div>

          <div>
            <label htmlFor="telephone" className="block text-xs text-slate-400 tracking-widest uppercase mb-1.5">
              Cellulaire
            </label>
            <input
              id="telephone"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              value={telephone}
              onChange={handlePhoneChange}
              placeholder="514 123-4567"
              className="w-full bg-[#071328] border border-sky-400/20 text-white rounded-[3px] px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-colors"
              aria-required
            />
            {touched && phoneDigits.length !== 10 && (
              <p className="text-red-400 text-xs mt-1">Numéro de téléphone à 10 chiffres requis.</p>
            )}
          </div>

          <div>
            <label htmlFor="ville-contact" className="block text-xs text-slate-400 tracking-widest uppercase mb-1.5">
              Ville <span className="normal-case font-normal">(optionnel)</span>
            </label>
            <input
              id="ville-contact"
              type="text"
              autoComplete="address-level2"
              value={villeContact}
              onChange={(e) => setVilleContact(e.target.value)}
              placeholder="Ex : Terrebonne"
              className="w-full bg-[#071328] border border-sky-400/20 text-white rounded-[3px] px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 text-[#07101f] font-bold text-sm tracking-widest uppercase rounded-[3px] px-6 py-4 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1b3e]"
          >
            Révéler mon estimation
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-slate-600 text-[11px] text-center">
            Pas de spam. Ton numéro sert uniquement à t&apos;envoyer ta fourchette + un suivi si tu le souhaites.
          </p>
        </form>
      </div>
    </div>
  )
}
