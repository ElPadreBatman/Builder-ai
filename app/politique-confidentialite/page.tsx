import Link from "next/link"
import { HardHat, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Politique de confidentialité - ConstructAI",
  description: "Politique de confidentialité de ConstructAI conformément à la Loi 25 du Québec.",
}

export default function PolitiqueConfidentialitePage() {
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
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">Politique de confidentialité</h1>
          <p className="text-gray-500 text-sm">Date d'entrée en vigueur : {dateEffet}</p>
          <p className="text-gray-600 mt-3 leading-relaxed">
            La présente politique de confidentialité décrit comment ConstructAI («&nbsp;nous&nbsp;», «&nbsp;notre&nbsp;» ou «&nbsp;la Société&nbsp;») 
            collecte, utilise et protège vos renseignements personnels, conformément à la{" "}
            <strong>Loi 25 (Loi modernisant des dispositions législatives en matière de protection des renseignements personnels)</strong> du Québec,
            ainsi qu'à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE).
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Responsable de la protection des renseignements personnels</h2>
            <p className="text-gray-700 leading-relaxed">
              ConstructAI a désigné un responsable de la protection des renseignements personnels. 
              Pour toute question relative à la présente politique ou à l'exercice de vos droits, vous pouvez nous contacter à :
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mt-3 text-sm text-gray-700">
              <p><strong>Courriel :</strong> confidentialite@constructai.ca</p>
              <p><strong>Adresse :</strong> ConstructAI, Québec, Canada</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Renseignements personnels collectés</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Nous collectons les renseignements personnels suivants :</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Informations d'identification :</strong> nom, prénom, adresse courriel, numéro de téléphone</li>
              <li><strong>Informations professionnelles :</strong> nom de l'entreprise, rôle</li>
              <li><strong>Données d'utilisation :</strong> conversations, soumissions générées, historique d'activité</li>
              <li><strong>Informations de paiement :</strong> gérées directement par Stripe (nous ne conservons pas les données de carte)</li>
              <li><strong>Données techniques :</strong> adresse IP, type de navigateur, pages consultées</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Finalités de la collecte</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Vos renseignements sont collectés pour :</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Créer et gérer votre compte utilisateur</li>
              <li>Fournir les services ConstructAI (génération de soumissions par IA)</li>
              <li>Traiter les paiements et gérer les abonnements</li>
              <li>Vous envoyer des communications relatives au service (mises à jour, sécurité)</li>
              <li>Améliorer nos services et assurer leur sécurité</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Consentement</h2>
            <p className="text-gray-700 leading-relaxed">
              En créant un compte, vous consentez à la collecte et au traitement de vos renseignements personnels 
              tels que décrits dans la présente politique. Vous pouvez retirer votre consentement en tout temps en 
              nous contactant, sous réserve des obligations légales et contractuelles applicables.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Partage des renseignements</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Nous ne vendons jamais vos renseignements personnels. Nous partageons uniquement avec :
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Supabase :</strong> hébergement de la base de données (serveurs en Amérique du Nord)</li>
              <li><strong>Stripe :</strong> traitement des paiements</li>
              <li><strong>OpenAI :</strong> traitement des requêtes IA (les conversations peuvent être traitées par leurs serveurs)</li>
              <li><strong>Vercel :</strong> hébergement de l'application</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Ces tiers sont contractuellement tenus de protéger vos renseignements et de les utiliser uniquement 
              aux fins pour lesquelles ils ont été transmis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Durée de conservation</h2>
            <p className="text-gray-700 leading-relaxed">
              Vos renseignements personnels sont conservés aussi longtemps que votre compte est actif ou que nécessaire 
              pour fournir nos services. Après la fermeture de votre compte, nous conservons vos données pendant 
              <strong> 3 ans</strong> pour respecter nos obligations légales, puis elles sont supprimées de façon sécuritaire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Vos droits (Loi 25)</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Conformément à la Loi 25, vous avez le droit de :</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Accéder</strong> à vos renseignements personnels que nous détenons</li>
              <li><strong>Rectifier</strong> des renseignements inexacts ou incomplets</li>
              <li><strong>Retirer</strong> votre consentement et demander la suppression de vos données</li>
              <li><strong>Portabilité</strong> : recevoir vos données dans un format technologique structuré</li>
              <li><strong>Vous opposer</strong> au traitement de vos renseignements à des fins de prospection</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Pour exercer ces droits, contactez-nous à <strong>confidentialite@constructai.ca</strong>. 
              Nous répondrons dans un délai de 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Sécurité</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous mettons en place des mesures de sécurité techniques et organisationnelles pour protéger vos 
              renseignements personnels contre tout accès non autorisé, perte ou divulgation, notamment :
              chiffrement des données en transit (HTTPS/TLS), authentification sécurisée, accès restreint 
              aux données selon le principe du moindre privilège.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Témoins (cookies)</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous utilisons des témoins essentiels au fonctionnement du service (authentification, session). 
              Aucun témoin publicitaire ou de suivi tiers n'est utilisé sans votre consentement explicite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Modifications</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous nous réservons le droit de modifier la présente politique. En cas de modification substantielle, 
              nous vous en informerons par courriel ou par avis sur notre plateforme au moins 30 jours avant l'entrée en vigueur.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <p className="text-sm text-gray-500">Dernière mise à jour : {dateEffet}</p>
          <div className="flex gap-3">
            <Link href="/conditions-utilisation" className="text-sm text-orange-600 hover:underline">
              Conditions d'utilisation
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
