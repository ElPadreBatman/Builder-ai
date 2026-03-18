import Link from "next/link"
import { HardHat, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Conditions d'utilisation - ConstructAI",
  description: "Conditions d'utilisation de la plateforme ConstructAI.",
}

export default function ConditionsUtilisationPage() {
  const dateEffet = "12 mars 2026"

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">ConstructAI</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">Conditions d'utilisation</h1>
          <p className="text-gray-500 text-sm">Date d'entrée en vigueur : {dateEffet}</p>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Les présentes conditions d'utilisation («&nbsp;Conditions&nbsp;») régissent votre accès et utilisation de la 
            plateforme ConstructAI exploitée par ConstructAI («&nbsp;nous&nbsp;», «&nbsp;la Société&nbsp;»). 
            En créant un compte, vous acceptez d'être lié par ces Conditions.
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Description du service</h2>
            <p className="text-gray-700 leading-relaxed">
              ConstructAI est une plateforme d'intelligence artificielle destinée aux professionnels de la construction 
              pour la génération automatisée de soumissions, l'organisation de projets et l'assistance administrative. 
              Le service est disponible via abonnement mensuel ou annuel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Admissibilité et création de compte</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Vous devez avoir au moins 18 ans pour utiliser le service</li>
              <li>Vous devez fournir des informations exactes et à jour lors de l'inscription</li>
              <li>Vous êtes responsable de la confidentialité de vos identifiants de connexion</li>
              <li>Un seul compte est autorisé par utilisateur, sauf dans le cadre d'un plan multi-utilisateurs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Plans d'abonnement et facturation</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              ConstructAI offre plusieurs plans d'abonnement :
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Plan Gratuit :</strong> accès limité, essai de 7 jours</li>
              <li><strong>Plan Base :</strong> 39,99 $ CAD/mois ou 399,90 $ CAD/an</li>
              <li><strong>Plan Pro :</strong> 69,99 $ CAD/mois ou 559,90 $ CAD/an</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Les abonnements sont renouvelés automatiquement. Vous pouvez annuler à tout moment depuis votre 
              tableau de bord. Aucun remboursement n'est émis pour les périodes partiellement utilisées, 
              sauf disposition contraire prévue par la loi applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Utilisation acceptable</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Il est interdit d'utiliser ConstructAI pour :</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Toute activité illégale ou frauduleuse</li>
              <li>La génération de contenus trompeurs, diffamatoires ou préjudiciables</li>
              <li>La reproduction, la revente ou l'exploitation commerciale non autorisée du service</li>
              <li>Tenter de contourner les mesures de sécurité ou d'accéder à des données d'autres utilisateurs</li>
              <li>L'utilisation de robots, scripts ou outils automatisés non autorisés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Propriété intellectuelle</h2>
            <p className="text-gray-700 leading-relaxed">
              Le contenu généré par ConstructAI à partir de vos données vous appartient. Vous accordez à ConstructAI 
              une licence limitée pour traiter vos données dans le seul but de fournir le service. 
              La plateforme, son code, son design et ses algorithmes sont la propriété exclusive de ConstructAI 
              et sont protégés par les lois sur la propriété intellectuelle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Limitation de responsabilité</h2>
            <p className="text-gray-700 leading-relaxed">
              ConstructAI fournit le service «&nbsp;tel quel&nbsp;». Nous ne garantissons pas que les soumissions 
              générées par l'IA sont exemptes d'erreurs. L'utilisateur est seul responsable de valider et d'approuver 
              tout document avant transmission à des tiers. Notre responsabilité maximale est limitée au montant 
              payé au cours des 12 derniers mois.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Résiliation</h2>
            <p className="text-gray-700 leading-relaxed">
              Vous pouvez résilier votre compte à tout moment. Nous nous réservons le droit de suspendre ou 
              résilier votre accès en cas de violation des présentes Conditions, sans préavis ni remboursement.
              En cas de résiliation, vos données seront conservées pendant 90 jours puis supprimées, 
              sauf obligation légale contraire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Droit applicable</h2>
            <p className="text-gray-700 leading-relaxed">
              Les présentes Conditions sont régies par les lois en vigueur dans la province de Québec, Canada. 
              Tout litige sera soumis à la compétence exclusive des tribunaux du Québec.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Modifications</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous nous réservons le droit de modifier ces Conditions à tout moment. 
              Les modifications importantes vous seront communiquées par courriel au moins 30 jours à l'avance. 
              La poursuite de l'utilisation du service après cette période constitue votre acceptation des nouvelles Conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              Pour toute question relative aux présentes Conditions, contactez-nous à :
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mt-3 text-sm text-gray-700">
              <p><strong>Courriel :</strong> legal@constructai.ca</p>
              <p><strong>Adresse :</strong> ConstructAI, Québec, Canada</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <p className="text-sm text-gray-500">Dernière mise à jour : {dateEffet}</p>
          <div className="flex gap-3">
            <Link href="/politique-confidentialite" className="text-sm text-orange-600 hover:underline">
              Politique de confidentialité
            </Link>
            <Link href="/" className="text-sm text-gray-600 hover:underline">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
