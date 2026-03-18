// Spécialités des contracteurs pour BuilderAI
// Ces spécialités influencent les questions posées par l'agent et le format des soumissions

export type Specialty = 
  | "general"
  | "plombier"
  | "electricien"
  | "menuisier"
  | "peintre"
  | "couvreur"
  | "maconnerie"
  | "hvac"
  | "paysagiste"
  | "demolition"
  | "excavation"
  | "beton"
  | "isolation"
  | "fenestration"
  | "autre"

export interface SpecialtyInfo {
  id: Specialty
  label: string
  description: string
  icon: string
  promptContext: string // Contexte ajouté au système prompt de l'agent
}

export const SPECIALTIES: SpecialtyInfo[] = [
  {
    id: "general",
    label: "Entrepreneur général",
    description: "Construction résidentielle et commerciale complète",
    icon: "HardHat",
    promptContext: `Tu assistes un entrepreneur général. Pose des questions sur:
- Le type de projet (résidentiel, commercial, industriel)
- L'envergure des travaux (rénovation, construction neuve, agrandissement)
- Les corps de métiers requis (électricité, plomberie, structure, finition)
- Les permis municipaux nécessaires
- La coordination des sous-traitants
- Les délais et phases du projet`
  },
  {
    id: "plombier",
    label: "Plombier",
    description: "Plomberie résidentielle et commerciale",
    icon: "Droplets",
    promptContext: `Tu assistes un plombier. Pose des questions spécifiques sur:
- Le type d'installation (résidentielle, commerciale, industrielle)
- Les appareils à installer/remplacer (chauffe-eau, toilettes, robinetterie, douches)
- Le type de tuyauterie (cuivre, PEX, ABS, fonte)
- Les problèmes existants (fuites, drains bouchés, pression d'eau)
- L'accès aux conduites (murs ouverts, sous-sol, vide sanitaire)
- La conformité au Code de plomberie du Québec`
  },
  {
    id: "electricien",
    label: "Électricien",
    description: "Travaux électriques et domotique",
    icon: "Zap",
    promptContext: `Tu assistes un électricien. Pose des questions spécifiques sur:
- Le type de service (résidentiel 100A/200A, commercial, industriel)
- Les travaux requis (panneau électrique, prises, éclairage, domotique)
- La mise aux normes (Code électrique du Québec)
- Les équipements spéciaux (borne de recharge EV, spa, piscine)
- L'état du système existant (âge du panneau, aluminium vs cuivre)
- Les permis et inspections requis`
  },
  {
    id: "menuisier",
    label: "Menuisier / Ébéniste",
    description: "Travaux de bois et armoires",
    icon: "Hammer",
    promptContext: `Tu assistes un menuisier/ébéniste. Pose des questions sur:
- Le type de projet (armoires, moulures, escaliers, planchers, structures)
- Les essences de bois souhaitées (érable, chêne, merisier, MDF, mélamine)
- Les dimensions et mesures précises
- Les finitions (vernis, peinture, teinture)
- Le style recherché (moderne, traditionnel, rustique)
- Les contraintes d'installation (accès, niveau, humidité)`
  },
  {
    id: "peintre",
    label: "Peintre",
    description: "Peinture intérieure et extérieure",
    icon: "Paintbrush",
    promptContext: `Tu assistes un peintre. Pose des questions sur:
- Le type de surface (intérieur/extérieur, murs, plafonds, boiseries)
- La superficie totale à peindre (pi² ou m²)
- L'état actuel des surfaces (préparation requise, réparations)
- Le type de peinture souhaité (latex, alkyde, écologique)
- La qualité de finition (économique, standard, premium)
- Les couleurs et nombre de couches
- Les contraintes (meubles à déplacer, hauteur des plafonds)`
  },
  {
    id: "couvreur",
    label: "Couvreur",
    description: "Toiture et étanchéité",
    icon: "Home",
    promptContext: `Tu assistes un couvreur. Pose des questions sur:
- Le type de toiture (bardeaux, membrane, tôle, ardoise)
- La superficie du toit (pi² ou m²)
- La pente et configuration (nombre de versants, lucarnes, cheminées)
- L'état actuel (réparation, remplacement complet, couches existantes)
- La ventilation et isolation existantes
- Les accessoires (gouttières, solins, évents)
- L'accès au toit et contraintes de sécurité`
  },
  {
    id: "maconnerie",
    label: "Maçon",
    description: "Brique, pierre et béton",
    icon: "Brick",
    promptContext: `Tu assistes un maçon. Pose des questions sur:
- Le type de travaux (brique, pierre, bloc, crépi, réparation)
- La superficie ou longueur linéaire
- L'état actuel (joints, fissures, efflorescence)
- Le type de matériaux souhaités (brique recyclée, pierre naturelle)
- Les éléments spéciaux (cheminée, foyer, muret)
- L'accès au chantier et échafaudage requis`
  },
  {
    id: "hvac",
    label: "HVAC / Chauffage-Climatisation",
    description: "Systèmes de chauffage et climatisation",
    icon: "Thermometer",
    promptContext: `Tu assistes un technicien HVAC. Pose des questions sur:
- Le type de système (chauffage, climatisation, thermopompe, ventilation)
- La superficie à chauffer/climatiser
- Le système existant (type, âge, efficacité)
- Le combustible souhaité (électrique, gaz, bi-énergie, géothermie)
- La qualité de l'air (échangeur d'air, humidificateur, filtration)
- L'isolation du bâtiment (pertes thermiques estimées)`
  },
  {
    id: "paysagiste",
    label: "Paysagiste",
    description: "Aménagement paysager et pavage",
    icon: "TreePine",
    promptContext: `Tu assistes un paysagiste. Pose des questions sur:
- Le type de projet (terrassement, pavage, plantation, muret)
- La superficie du terrain
- Les matériaux souhaités (pavé uni, asphalte, gazon, vivaces)
- Le drainage et nivellement requis
- L'irrigation et éclairage extérieur
- L'entretien futur souhaité
- Les structures (pergola, patio, clôture)`
  },
  {
    id: "demolition",
    label: "Démolition",
    description: "Démolition et décontamination",
    icon: "Trash2",
    promptContext: `Tu assistes un entrepreneur en démolition. Pose des questions sur:
- Le type de démolition (intérieure, extérieure, complète, sélective)
- La superficie ou volume à démolir
- Les matériaux présents (amiante, plomb, moisissures - décontamination)
- L'accès au site et contraintes
- La gestion des débris (recyclage, conteneur, écocentre)
- Les structures à préserver
- Les permis de démolition requis`
  },
  {
    id: "excavation",
    label: "Excavation",
    description: "Excavation et terrassement",
    icon: "Construction",
    promptContext: `Tu assistes un entrepreneur en excavation. Pose des questions sur:
- Le type de travaux (fondation, drain français, piscine, nivellement)
- Le volume à excaver (verges cubes)
- Le type de sol (roc, argile, sable, remblai)
- L'accès pour la machinerie
- La gestion des sols (transport, remblai, compactage)
- La profondeur et dimensions requises
- Les services souterrains à localiser (Info-Excavation)`
  },
  {
    id: "beton",
    label: "Béton",
    description: "Fondations et ouvrages en béton",
    icon: "Square",
    promptContext: `Tu assistes un entrepreneur en béton. Pose des questions sur:
- Le type de travaux (fondation, dalle, escalier, muret, réparation)
- Les dimensions et épaisseur requises
- Le type de béton (résistance PSI, fibré, coloré)
- La finition souhaitée (balai, poli, estampé)
- Les armatures (treillis, barres d'armature)
- Les joints de contrôle et d'expansion
- Les conditions de coulée (météo, accès bétonnière)`
  },
  {
    id: "isolation",
    label: "Isolation",
    description: "Isolation et insonorisation",
    icon: "Layers",
    promptContext: `Tu assistes un entrepreneur en isolation. Pose des questions sur:
- Le type d'isolation (thermique, acoustique, pare-vapeur)
- Les zones à isoler (murs, entretoit, sous-sol, vide sanitaire)
- Le type de matériau (laine, cellulose, uréthane, polystyrène)
- La valeur R cible (Code du bâtiment du Québec)
- L'état actuel de l'isolation
- Les ponts thermiques à traiter
- La ventilation et pare-air requis`
  },
  {
    id: "fenestration",
    label: "Fenestration",
    description: "Portes et fenêtres",
    icon: "LayoutGrid",
    promptContext: `Tu assistes un entrepreneur en fenestration. Pose des questions sur:
- Le type de produits (fenêtres, portes, portes-patio, puits de lumière)
- Le nombre d'ouvertures et dimensions
- Le type de vitrage (double, triple, Low-E, argon)
- Le matériau du cadre (PVC, aluminium, hybride, bois)
- Le style d'ouverture (battant, coulissant, auvent, fixe)
- L'état actuel et raison du remplacement
- Les exigences Energy Star`
  },
  {
    id: "autre",
    label: "Autre spécialité",
    description: "Autre domaine de la construction",
    icon: "Wrench",
    promptContext: `Tu assistes un professionnel de la construction. Adapte tes questions selon le type de travaux décrits. Demande des précisions sur:
- La nature exacte des travaux
- Les matériaux requis
- Les dimensions et quantités
- Les contraintes du chantier
- Les normes applicables`
  }
]

export function getSpecialtyById(id: string): SpecialtyInfo | undefined {
  return SPECIALTIES.find(s => s.id === id)
}

export function getSpecialtyPromptContext(id: string): string {
  const specialty = getSpecialtyById(id)
  return specialty?.promptContext || SPECIALTIES[0].promptContext
}
