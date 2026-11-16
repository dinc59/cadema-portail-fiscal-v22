/* Historique des mises à jour du portail, affiché dans « Nouveautés ».
   Écrit pour les agents du pôle : ce qui change pour eux et où le trouver.
   La plus récente en premier. `id` sert à savoir ce qu'un agent a déjà vu. */
export const CHANGELOG = [
  {
    id: '22.17', date: '2026-11-16', title: 'GEMAPI : nouvelle population INSEE',
    summary: 'Le plafond de la taxe GEMAPI tient compte du recensement de Mayotte.',
    items: [
      {tag: 'Corrigé', text: 'Taxe GEMAPI : plafond calculé sur 114 990 habitants (recensement INSEE au 1er janvier 2026 : Mamoudzou 94 603, Dembéni 20 387), soit 4 599 600 € au lieu de 4 022 160 €. Marge restante : 1 305 411 €. La population DGF notifiée, saisie dans Parametres (POPULATION_DGF), remplace ce chiffre.', href: '#/taux'},
    ],
  },
  {
    id: '22.16', date: '2026-11-16', title: 'Mise à jour automatique',
    summary: 'Le portail se met à jour tout seul après chaque mise en ligne, sans vider le cache du navigateur.',
    items: [
      {tag: 'Amélioré', text: 'À l’ouverture et à chaque retour sur l’onglet, le portail vérifie s’il existe une version plus récente. Si oui, il rafraîchit ses fichiers et se recharge de lui-même : plus besoin de vider le cache ni de recharger plusieurs fois.'},
    ],
  },
  {
    id: '22.15', date: '2026-11-16', title: 'Évolutions fiscales 2027 et GEMAPI',
    summary: 'Les hausses et créations de taux proposées pour 2027, et le produit de la taxe GEMAPI.',
    items: [
      {tag: 'Nouveau', text: 'Taux : propositions soumises au conseil du 30 novembre 2026 — TEOM de 14,40 % à 17,40 %, création de taux additionnels de TFPB (6,71 %), TFPNB (3,11 %) et THRS (11,21 %), CFE inchangée. Recettes nouvelles estimées : 6 994 870 €. Les taux proposés restent signalés tant que le taux voté n’est pas saisi.', href: '#/taux'},
      {tag: 'Nouveau', text: 'Taxe GEMAPI : produit voté depuis 2022 (3 294 189 € en 2025 et 2026), plafond légal et marge restante, hypothèse 2027, et un point d’attention sur la formulation du projet de Pacte.', href: '#/taux'},
      {tag: 'Nouveau', text: 'Recettes par budget : la GEMAPI apparaît dans le budget principal ; les taxes additionnelles y apparaîtront dès qu’un produit sera saisi.', href: '#/finances?tab=recettes'},
    ],
  },
  {
    id: '22.14', date: '2026-11-15', title: 'Fiabilisation des données',
    summary: 'Les chiffres financiers ne peuvent plus être faussés par un statut, un import ou une table manquante.',
    items: [
      {tag: 'Corrigé', text: 'Redevance spéciale : « Soldée » ne crée plus d’encaissement. Un dossier ne passe en Soldée que si le montant réglé saisi couvre le facturé ; les autres sont signalés et restent inchangés.', href: '#/redevance'},
      {tag: 'Corrigé', text: 'Import CFE : chaque local est une ligne distincte, même quand une entreprise en occupe plusieurs avec le même SIRET. Réimporter un fichier met les locaux à jour sans les dupliquer.', href: '#/recettes/CFE?tab=terrain'},
      {tag: 'Nouveau', text: 'Qualité des données : suivis de redevance en double, montants réglés supérieurs au facturé, et tables Grist non chargées (avec un bandeau d’alerte en haut de chaque page).', href: '#/pilotage?tab=qualite'},
      {tag: 'Amélioré', text: 'Exports CSV : une cellule qui ressemble à une formule est neutralisée avant d’être ouverte dans Excel.'},
    ],
  },
  {
    id: '22.13', date: '2026-11-15', title: 'Synthèse PDF de la redevance spéciale',
    summary: 'Un bouton produit la synthèse de l’exercice, avec ses graphiques, à vérifier à l’écran avant de l’enregistrer en PDF.',
    items: [
      {tag: 'Nouveau', text: 'La synthèse s’ouvre sur les impayés : combien d’entreprises n’ont rien payé, combien ont payé en partie, combien restent à qualifier, puis la liste nominative de chacune.', href: '#/fiche/rs'},
      {tag: 'Nouveau', text: 'Redevance spéciale › Synthèse PDF : chiffres clés et taux de recouvrement, facturé et encaissé par exercice, situation des dossiers, plus gros restes à recouvrer, ancienneté des créances, et le détail entreprise par entreprise.', href: '#/fiche/rs'},
      {tag: 'Nouveau', text: 'La synthèse s’affiche d’abord à l’écran telle qu’elle sera imprimée ; on change d’exercice d’un clic, puis « Enregistrer en PDF ».', href: '#/fiche/rs'},
    ],
  },
  {
    id: '22.12', date: '2026-11-15', title: 'Documents : toutes les pièces d’un état, liste par exercice',
    summary: 'Les EDET mensuels s’ouvrent tous depuis la grille, et la liste se lit année par année.',
    items: [
      {tag: 'Amélioré', text: 'Grille des états : une case qui contient plusieurs pièces ouvre la liste complète, dans l’ordre des mois. L’étoile désigne le récapitulatif annuel, qui passe en tête pour toute l’équipe.', href: '#/documents'},
      {tag: 'Amélioré', text: 'Liste des documents rangée par exercice, du plus récent au plus ancien, avec le type en étiquette de couleur. Les filtres sont au-dessus de la liste.', href: '#/documents'},
    ],
  },
  {
    id: '22.11', date: '2026-11-15', title: 'Taux votés',
    summary: 'Les taux de CFE, de TEOM et du versement mobilité, de la création de la CADEMA à aujourd’hui.',
    items: [
      {tag: 'Nouveau', text: 'Recettes › Taux votés : CFE 18,04 % et TEOM 14,40 % depuis 2016 ; versement mobilité institué le 1er octobre 2019, porté à 0,90 % en 2022 puis à 1,50 % au 1er janvier 2025. Un clic sur un taux ouvre son historique, sa source et sa délibération en PDF.', href: '#/taux'},
      {tag: 'Nouveau', text: 'La délibération d’un taux se dépose depuis sa fiche ; elle est rangée dans Documents et proposée à toute l’équipe.', href: '#/taux'},
      {tag: 'Nouveau', text: 'Fiche des taux à imprimer ou enregistrer en PDF.', href: '#/taux'},
    ],
  },
  {
    id: '22.10', date: '2026-11-15', title: 'Recettes par budget et états fiscaux',
    summary: 'Pour la comptabilité : les recettes rangées par budget, et les états fiscaux de chaque exercice d’un coup d’œil.',
    items: [
      {tag: 'Nouveau', text: 'Finances › Recettes par budget : budget principal, budget déchets (TEOM et redevance spéciale), budget mobilité (versement mobilité). Pour chaque recette : statut, montant de l’exercice précédent, évolution, exécution et source. Export Excel et copie du tableau.', href: '#/finances?tab=recettes'},
      {tag: 'Nouveau', text: 'Documents : grille des états 1259, 1386, EDET et EDAC par exercice. Un état présent s’ouvre en un clic ; un état manquant se dépose directement au bon exercice.', href: '#/documents'},
      {tag: 'Amélioré', text: 'Qualité des données : les états fiscaux absents des trois derniers exercices clos sont signalés.', href: '#/pilotage?tab=qualite'},
    ],
  },
  {
    id: '22.9', date: '2026-11-14', title: 'Finitions : documents, clavier, téléphone',
    summary: 'Les documents se corrigent depuis le portail, et la navigation au clavier est plus sûre.',
    items: [
      {tag: 'Nouveau', text: 'Documents : modifier le titre, le type, l’exercice ou le statut d’un document, remplacer son fichier, ou le supprimer (avec Annuler).', href: '#/documents'},
      {tag: 'Nouveau', text: 'Documents : suppression en un clic des lignes vides de la table, quand leurs fichiers sont déjà classés ailleurs. Un fichier qui n’est classé nulle part n’est jamais supprimé : le portail propose de le classer.', href: '#/documents'},
      {tag: 'Corrigé', text: 'Quand un volet ou une confirmation est ouvert, la touche Tab reste à l’intérieur au lieu de parcourir la page derrière.'},
      {tag: 'Corrigé', text: 'Sur téléphone, les montants des graphiques ne se chevauchent plus : seul l’exercice affiché garde son étiquette, les autres s’affichent au toucher.'},
      {tag: 'Amélioré', text: 'La mention « © 2026, Made with ❤️ by Dina-Ben » figure en bas de chaque page, en mode réunion et sur le point mensuel PDF.'},
    ],
  },
  {
    id: '22.8', date: '2026-11-14', title: 'Mode réunion et point mensuel en PDF',
    summary: 'Les chiffres clés se présentent en plein écran et s’exportent en PDF.',
    items: [
      {tag: 'Nouveau', text: 'Mode réunion : recettes, trajectoire, redevance et recouvrement, priorités, qualité des données et échéances, une diapositive par sujet. Flèches du clavier pour avancer, F pour le plein écran, Échap pour quitter.', href: '#/reunion'},
      {tag: 'Nouveau', text: 'Point mensuel : les mêmes sections sur une page A4, à imprimer ou à enregistrer en PDF depuis le navigateur (« Enregistrer au format PDF »). Rien n’est envoyé à l’extérieur.', href: '#/rapport'},
      {tag: 'Amélioré', text: 'Accueil : accès direct au mode réunion et au point mensuel.', href: '#/'},
    ],
  },
  {
    id: '22.7', date: '2026-11-14', title: 'Espace Nouveautés et échéances du calendrier',
    summary: 'Cette page, pour suivre les évolutions du portail, et les échéances fiscales de l’année ajoutées en un clic.',
    items: [
      {tag: 'Nouveau', text: 'Espace « Nouveautés » : chaque mise à jour du portail y est décrite, avec un lien vers l’écran concerné. Un bandeau sur l’accueil signale ce qui est nouveau depuis votre dernière visite.', href: '#/nouveautes'},
      {tag: 'Nouveau', text: 'Calendrier : bouton « Échéances de l’année » qui propose les dates fiscales récurrentes (vote des taux, délibérations avant le 1er octobre, compte financier unique…). Vous cochez celles à ajouter ; rien n’est écrit sans votre validation.', href: '#/pilotage?tab=calendrier'},
    ],
  },
  {
    id: '22.6', date: '2026-11-14', title: 'Import du suivi terrain CFE',
    summary: 'Le fichier Excel ou CSV des visites terrain s’importe directement dans le portail.',
    items: [
      {tag: 'Nouveau', text: 'Import d’un fichier Excel (.xlsx) ou CSV : colonnes reconnues automatiquement, aperçu avant écriture, réimportation sans doublon (même identifiant ou même SIRET), annulation possible juste après.', href: '#/recettes/CFE?tab=terrain'},
      {tag: 'Nouveau', text: 'Liste des établissements visités avec recherche, filtres par statut et par commune ; le statut terrain se change sur chaque ligne.', href: '#/recettes/CFE?tab=terrain'},
      {tag: 'Amélioré', text: 'Les chiffres de la campagne (visités, exploités, vacants, à revoir) sont calculés à partir des établissements.'},
    ],
  },
  {
    id: '22.5', date: '2026-11-14', title: 'Recouvrement de la redevance spéciale',
    summary: 'Un onglet pour suivre les impayés de tous les exercices et préparer les relances.',
    items: [
      {tag: 'Nouveau', text: 'Onglet « Recouvrement » : impayés de 2024 à aujourd’hui, séparés entre titres à relancer, montants à titrer et dossiers encore à vérifier.', href: '#/redevance?tab=recouvrement'},
      {tag: 'Nouveau', text: 'Courriel de relance préparé pour chaque entreprise (seuls les exercices titrés sont relancés) ; il s’ouvre dans votre messagerie, le portail n’envoie rien lui-même.'},
      {tag: 'Nouveau', text: '« Marquer la relance envoyée » : étape du dossier, prochaine date (+15 jours) et ligne datée dans le journal du dossier. Les relances en retard remontent dans les alertes (la cloche).'},
    ],
  },
  {
    id: '22.4', date: '2026-11-14', title: 'Corrections en série',
    summary: 'Pour fiabiliser les données plus vite : plusieurs dossiers à la fois.',
    items: [
      {tag: 'Nouveau', text: 'Redevance spéciale : cases à cocher et barre « Passer en… » pour qualifier plusieurs dossiers d’un coup, avec « Annuler ».', href: `#/redevance?situation=${encodeURIComponent('À vérifier')}`},
      {tag: 'Nouveau', text: 'Saisie rapide des SIRET manquants : un numéro, Entrée, l’entreprise suivante. Contrôle des 14 chiffres et des doublons.', href: '#/redevance?siret=0'},
      {tag: 'Nouveau', text: 'Recettes : suppression en un clic des lignes en double de la table Taxes, la ligne affichée étant conservée.', href: '#/recettes'},
    ],
  },
  {
    id: '22.3', date: '2026-11-14', title: 'Choix du fond de l’écran',
    summary: 'Clair, tamisé ou sombre, selon votre préférence.',
    items: [
      {tag: 'Nouveau', text: 'Bouton soleil/lune dans l’en-tête : fond automatique, clair, tamisé (sombre adouci) ou sombre. Le choix est mémorisé sur votre poste.'},
    ],
  },
  {
    id: '22.2', date: '2026-11-14', title: 'Fiches des recettes enrichies',
    summary: 'Chaque recette retrouve une fiche complète, et le portail gagne des animations discrètes.',
    items: [
      {tag: 'Amélioré', text: 'Fiche d’une recette : choix de l’exercice, évolution sur un an, croissance annuelle moyenne, part dans les recettes, progression par statut, taux et base nette, prévu et réalisé, historique détaillé.', href: '#/recettes/VM'},
      {tag: 'Amélioré', text: 'Quand un exercice a plusieurs lignes dans Taxes, la plus avancée est retenue (définitif, puis renseigné, puis prévision).'},
      {tag: 'Amélioré', text: 'Animations discrètes : graphiques qui se remplissent, ligne enregistrée qui s’éclaire. Rien ne bouge pendant la saisie.'},
    ],
  },
  {
    id: '22.0', date: '2026-11-14', title: 'Nouveau portail fiscal',
    summary: 'Le portail est entièrement refait, sur les mêmes tables Grist : aucune donnée n’a été déplacée.',
    items: [
      {tag: 'Nouveau', text: 'Nouveau logo, menu horizontal en haut, recherche (Ctrl K) sur les entreprises, recettes, documents et priorités.'},
      {tag: 'Nouveau', text: 'Accueil : chiffres clés, trajectoire des recettes, points à corriger, prochaines échéances.', href: '#/'},
      {tag: 'Nouveau', text: 'Écrans Recettes, Redevance spéciale, Finances (budgets, CFU, DGF, FPIC), Pilotage (priorités, plan d’actions, calendrier, qualité des données) et Documents.'},
      {tag: 'Nouveau', text: 'Contrôle qualité calculé à partir des tables : ce qui manque, combien, et où le corriger.', href: '#/pilotage?tab=qualite'},
      {tag: 'Amélioré', text: 'Utilisable sur téléphone ; les écritures partent directement dans Grist.'},
    ],
  },
];

export const LATEST = CHANGELOG[0].id;
const KEY = 'cadema-v22-seen';
const cmp = (a, b) => a.localeCompare(b, 'fr', {numeric: true});
export function seenId() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function markSeen() { try { localStorage.setItem(KEY, LATEST); } catch { /* stockage bloqué */ } }
/* Mises à jour pas encore vues. Première visite : seule la dernière compte,
   pour ne pas annoncer tout l'historique comme nouveau. */
export function unseen() {
  const seen = seenId();
  if (!seen) return CHANGELOG.slice(0, 1);
  return CHANGELOG.filter(r => cmp(r.id, seen) > 0);
}
