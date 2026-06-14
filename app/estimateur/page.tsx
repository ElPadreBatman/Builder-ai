import type { Metadata } from 'next'
import EstimateurClient from './EstimateurClient'

export const metadata: Metadata = {
  title: 'Estimateur IA — Gestion A.F. Construction inc.',
  description:
    "Obtenez une estimation préliminaire de votre projet de rénovation résidentielle en quelques minutes, propulsée par l'intelligence artificielle. Lanaudière · Rive-Nord · Laval · Montréal.",
  robots: { index: false, follow: false },
}

export default function EstimateurPage() {
  return <EstimateurClient />
}
