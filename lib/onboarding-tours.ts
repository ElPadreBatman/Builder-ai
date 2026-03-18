export interface TourStep {
  id: string
  title: string
  description: string
  target: string // CSS selector for the element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right'
  highlightPadding?: number
  spotlightRadius?: number
}

export interface Tour {
  id: string
  name: string
  steps: TourStep[]
  onComplete?: () => void
}

// Dashboard Tour
export const dashboardTour: Tour = {
  id: 'dashboard-tour',
  name: 'Découvrez le Tableau de Bord',
  steps: [
    {
      id: 'dashboard-1',
      title: 'Bienvenue sur BuilderAI',
      description: 'Explorez tous vos projets au même endroit. Filtrez par statut pour retrouver facilement votre travail.',
      target: '[data-tour="projects-grid"]',
      position: 'right',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'dashboard-2',
      title: 'Filtres par Statut',
      description: 'Organisez vos projets avec les filtres: En cours, Brouillon, Envoyé, et plus encore.',
      target: '[data-tour="status-filters"]',
      position: 'bottom',
      highlightPadding: 8,
      spotlightRadius: 6,
    },
    {
      id: 'dashboard-3',
      title: 'Recherche Rapide',
      description: 'Trouvez rapidement un projet en tapant son nom ou sa description.',
      target: '[data-tour="search-bar"]',
      position: 'bottom',
      highlightPadding: 8,
      spotlightRadius: 6,
    },
    {
      id: 'dashboard-4',
      title: 'Créer un Nouveau Projet',
      description: 'Cliquez ici pour commencer un nouveau projet et importer vos plans.',
      target: '[data-tour="new-project-btn"]',
      position: 'left',
      highlightPadding: 8,
      spotlightRadius: 6,
    },
  ],
}

// Chat Tour
export const chatTour: Tour = {
  id: 'chat-tour',
  name: 'Guide du Chat avec l\'Agent',
  steps: [
    {
      id: 'chat-1',
      title: 'Importez vos Plans',
      description: 'Démarrez en cliquant sur l\'icône d\'ajout pour importer vos fichiers PDF, images ou documents de projet.',
      target: '[data-tour="attachment-upload"]',
      position: 'top',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'chat-2',
      title: 'Discutez avec l\'Agent Bob',
      description: 'Posez des questions sur votre projet. L\'agent IA comprend vos plans et vous aide à structurer les informations.',
      target: '[data-tour="chat-input"]',
      position: 'top',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'chat-3',
      title: 'Panel Artefacts',
      description: 'À droite, voir automatiquement les informations extraites du projet (dimensions, matériaux, quantités).',
      target: '[data-tour="artifacts-toggle"]',
      position: 'left',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'chat-4',
      title: 'Modifiez les Données',
      description: 'Adaptez les valeurs extraites directement dans le panel avant de générer la soumission.',
      target: '[data-tour="artifacts-panel"]',
      position: 'left',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
  ],
}

// Profile Tour
export const profileTour: Tour = {
  id: 'profile-tour',
  name: 'Gérez Votre Profil et Abonnement',
  steps: [
    {
      id: 'profile-1',
      title: 'Votre Abonnement',
      description: 'Consultez votre plan actuel et les limites d\'utilisation. Vous pouvez changer de plan à tout moment.',
      target: '[data-tour="subscription-card"]',
      position: 'bottom',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'profile-2',
      title: 'Gérer le Paiement',
      description: 'Accédez au portail Stripe pour mettre à jour vos informations de facturation et modifier votre abonnement.',
      target: '[data-tour="manage-payment-btn"]',
      position: 'left',
      highlightPadding: 8,
      spotlightRadius: 6,
    },
    {
      id: 'profile-3',
      title: 'Informations Personnelles',
      description: 'Mettez à jour votre profil, votre entreprise et vos préférences.',
      target: '[data-tour="profile-info"]',
      position: 'bottom',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
  ],
}

// Pricing Tour
export const pricingTour: Tour = {
  id: 'pricing-tour',
  name: 'Choisir Votre Plan',
  steps: [
    {
      id: 'pricing-1',
      title: 'Plan de Base',
      description: '39.99 $/mois pour 1 utilisateur et 20 soumissions par mois. Parfait pour commencer.',
      target: '[data-tour="pricing-base"]',
      position: 'bottom',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'pricing-2',
      title: 'Plan Pro',
      description: '69.99 $/mois pour jusqu\'à 3 utilisateurs, 30 projets et soumissions illimitées.',
      target: '[data-tour="pricing-pro"]',
      position: 'bottom',
      highlightPadding: 12,
      spotlightRadius: 8,
    },
    {
      id: 'pricing-3',
      title: 'Essai Gratuit 7 Jours',
      description: 'Tous les plans incluent un essai gratuit de 7 jours. Aucune carte de crédit requise pour commencer.',
      target: '[data-tour="trial-badge"]',
      position: 'bottom',
      highlightPadding: 8,
      spotlightRadius: 6,
    },
  ],
}

export const allTours = {
  [dashboardTour.id]: dashboardTour,
  [chatTour.id]: chatTour,
  [profileTour.id]: profileTour,
  [pricingTour.id]: pricingTour,
}
