export const SCHOOL = {
  name: "Euro-Permis Sarcelles",
  tagline: "Ton permis sur mesure",
  phone: "01 34 29 01 54",
  phoneHref: "tel:+33134290154",
  address: "56-58 Avenue Paul Valéry, 95200 Sarcelles",
  website: "https://europermis-sarcelles.fr",
  mapsHref:
    "https://www.google.com/maps/search/?api=1&query=56-58+Avenue+Paul+Val%C3%A9ry+95200+Sarcelles",
  // Horaires bureau (accueil / secrétariat)
  hours: [
    { day: "Lundi", time: "15:00 – 19:00" },
    { day: "Mardi", time: "10:00 – 13:00 · 15:00 – 19:00" },
    { day: "Mercredi", time: "10:00 – 13:00 · 15:00 – 19:00" },
    { day: "Jeudi", time: "10:00 – 13:00 · 15:00 – 19:00" },
    { day: "Vendredi", time: "10:00 – 13:00 · 15:00 – 19:00" },
    { day: "Samedi", time: "10:00 – 13:00" },
    { day: "Dimanche", time: "Fermé" },
  ],
  // Horaires conduite (leçons sur véhicule)
  drivingHours: [
    { day: "Lundi – Vendredi", time: "09:00 – 20:00" },
    { day: "Samedi", time: "08:00 – 13:00" },
    { day: "Dimanche", time: "Fermé" },
  ],
};

export const PRICING = [
  { id: "auto13", title: "Permis B Boîte Automatique — 13h", price: 749, badge: "À partir de" },
  { id: "manuelle20", title: "Permis B Boîte Manuelle — 20h", price: 999, badge: "Le plus choisi" },
  { id: "auto20", title: "Permis B Boîte Automatique — 20h", price: 1049 },
  { id: "aac", title: "Formule AAC (Conduite accompagnée) — 20h", price: 1299 },
  { id: "manuelle30", title: "Permis B Boîte Manuelle — 30h", price: 1499 },
  { id: "auto30", title: "Permis B Boîte Automatique — 30h", price: 1549 },
  { id: "codeacc", title: "Code de la route Accéléré — 21h", price: 299 },
  { id: "passerelle", title: "Passerelle Auto → Manuelle — 7h", price: 499 },
  { id: "postpermis", title: "Formule Post-Permis — 7h", price: 250 },
  { id: "lecon", title: "Leçon de conduite (Manuelle ou Auto)", price: 60 },
  { id: "evalSim", title: "Évaluation sur simulateur", price: 40 },
  { id: "evalLigne", title: "Évaluation en ligne", price: 40 },
  { id: "evalEns", title: "Évaluation avec enseignant", price: 60 },
  { id: "codeLigne", title: "Code en ligne — 6 mois", price: 40 },
  { id: "livreCode", title: "Livre de code", price: 15 },
  { id: "fraisAdmin", title: "Frais administratifs", price: 150 },
  { id: "fraisCPF", title: "Frais de gestion CPF", price: 300 },
  { id: "examen", title: "Frais examen pratique", price: 60 },
];

export const STUDENT = {
  username: "eleve_jean",
  fullName: "Jean Dupont",
  neph: "0123456789",
  hoursDone: 14,
  hoursTotal: 20,
  balance: 240,
  nextLesson: {
    date: "Vendredi 30 mai",
    time: "14:00 — 16:00",
    instructor: "Karim B.",
    place: "Agence Sarcelles",
  },
  upcoming: [
    { date: "Ven. 30/05", time: "14:00", instructor: "Karim B.", type: "Conduite" },
    { date: "Lun. 02/06", time: "10:00", instructor: "Karim B.", type: "Conduite" },
    { date: "Mer. 04/06", time: "16:00", instructor: "Sonia M.", type: "Autoroute" },
    { date: "Sam. 07/06", time: "09:00", instructor: "Karim B.", type: "Examen blanc" },
  ],
  skills: [
    { name: "Démarrage / arrêt", done: true },
    { name: "Carrefours", done: true },
    { name: "Ronds-points", done: true },
    { name: "Insertion autoroute", done: false },
    { name: "Créneau", done: false },
    { name: "Point de patinage", done: false },
  ],
  documents: [
    { name: "Pièce d'identité.pdf", status: "valid" as const, size: "1.2 Mo" },
    { name: "Attestation de Recensement.pdf", status: "valid" as const, size: "480 Ko" },
    { name: "Photos d'identité e-photo.jpeg", status: "valid" as const, size: "820 Ko" },
    { name: "Justificatif de domicile.pdf", status: "pending" as const, size: "950 Ko" },
  ],
  history: [
    {
      date: "Mer. 21/05",
      type: "Conduite urbaine",
      instructor: "Karim B.",
      comment:
        "Bonne gestion du gabarit du véhicule, attention aux contrôles d'angles morts en changement de file.",
    },
    {
      date: "Lun. 19/05",
      type: "Manœuvres",
      instructor: "Karim B.",
      comment:
        "Créneau bien exécuté côté droit. À retravailler : le demi-tour en 3 manœuvres dans une rue étroite.",
    },
    {
      date: "Ven. 16/05",
      type: "Conduite mixte",
      instructor: "Sonia M.",
      comment:
        "Très bonne anticipation aux intersections. Pensez à relâcher l'embrayage plus progressivement au démarrage en côte.",
    },
  ],
};

export const INSTRUCTOR = {
  username: "moniteur_karim",
  fullName: "Karim Benali",
  today: [
    { id: "l1", time: "08:00 – 10:00", student: "Léa Martin", type: "Conduite urbaine", status: "done" },
    { id: "l2", time: "10:00 – 12:00", student: "Hugo P.", type: "Manœuvres", status: "done" },
    { id: "l3", time: "14:00 – 16:00", student: "Yanis K.", type: "Conduite mixte", status: "current" },
    { id: "l4", time: "16:00 – 18:00", student: "Sara El M.", type: "Examen blanc", status: "upcoming" },
  ],
  skills: [
    "Démarrage / arrêt",
    "Carrefours",
    "Ronds-points",
    "Insertion autoroute",
    "Créneau / stationnement",
    "Point de patinage",
    "Conduite de nuit",
    "Conditions dégradées",
  ],
};

export const INSTRUCTORS = ["Karim B.", "Sonia M.", "David L."];

type Lesson = { time: string; student: string; type: string };
export const PLANNING: Record<string, Lesson[]> = {
  "Karim B.": [
    { time: "08:00", student: "Jean Dupont", type: "Conduite" },
    { time: "10:00", student: "Aïcha Traoré", type: "Manœuvres" },
    { time: "14:00", student: "Jean Dupont", type: "Conduite" },
    { time: "16:00", student: "Marc Lefèvre", type: "Examen blanc" },
  ],
  "Sonia M.": [
    { time: "09:00", student: "Léa Martin", type: "Conduite" },
    { time: "11:00", student: "Yanis K.", type: "Autoroute" },
    { time: "15:00", student: "Inès B.", type: "Conduite" },
  ],
  "David L.": [
    { time: "08:00", student: "Hugo P.", type: "Conduite" },
    { time: "13:00", student: "Sara El M.", type: "Code" },
    { time: "17:00", student: "Nora F.", type: "Conduite" },
  ],
};
