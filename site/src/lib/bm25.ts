/**
 * BM25 générique : classement plein texte d'une requête contre un corpus de
 * documents (issue #16, docs/SPECS.md section 5 — recherche par résumé).
 *
 * Écrit à la main plutôt qu'une dépendance : la formule est compacte, et le
 * projet garde sa logique de recherche testée et comprise en interne (même
 * choix que pour le seuil Fuse.js du titre, issue #15). Sans rapport avec
 * les données Kaamelott — `recherche.ts` fait le lien.
 *
 * `k1`/`b` : valeurs usuelles d'Okapi BM25 (Robertson & Spärck Jones), pas
 * encore raffinées contre de vraies requêtes — à faire comme le seuil
 * Fuse.js l'a été pour le titre (docs/qc-recherche-titre.md), voir
 * docs/qc-recherche-resume.md.
 */

const K1 = 1.5;
const B = 0.75;

// Mots vides français très courants — pas une liste linguistique complète,
// juste assez pour ne pas fausser l'IDF avec du bruit grammatical (BM25
// les neutralise déjà en grande partie via l'IDF, mais les retirer avant
// tokenisation évite de gonfler le vocabulaire pour rien).
const MOTS_VIDES = new Set([
  'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'et', 'à', 'au', 'aux',
  'en', 'que', 'qui', 'se', 'sa', 'son', 'ses', 'ce', 'cet', 'cette', 'ces',
  'dans', 'sur', 'par', 'pour', 'avec', 'est', 'sont', 'il', 'elle', 'ils',
  'elles', 'on', 'ne', 'pas', 'plus', 'comme', 'mais', 'alors', 'tout',
  'tous', 'toute', 'toutes', 'être', 'avoir', 'fait', 'faire',
]);

/** Minuscule, sans accents, ponctuation retirée — comparable d'un texte à l'autre. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokeniser(texte: string): string[] {
  const normalise = normaliser(texte);
  if (!normalise) return [];
  return normalise.split(' ').filter((mot) => mot.length >= 2 && !MOTS_VIDES.has(mot));
}

function distanceLevenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
    }
  }
  return d[a.length][b.length];
}

interface DocumentIndexe<T> {
  item: T;
  frequences: Map<string, number>;
  longueur: number;
}

export interface IndexBM25<T> {
  documents: DocumentIndexe<T>[];
  frequenceDocumentaire: Map<string, number>;
  longueurMoyenne: number;
  vocabulaire: string[];
}

/** Construit l'index une fois pour toutes — `chercherBM25` ne fait que le lire. */
export function creerIndexBM25<T>(
  items: T[],
  extraireTexte: (item: T) => string,
): IndexBM25<T> {
  const documents: DocumentIndexe<T>[] = items.map((item) => {
    const tokens = tokeniser(extraireTexte(item));
    const frequences = new Map<string, number>();
    for (const t of tokens) frequences.set(t, (frequences.get(t) ?? 0) + 1);
    return { item, frequences, longueur: tokens.length };
  });

  const frequenceDocumentaire = new Map<string, number>();
  for (const doc of documents) {
    for (const terme of doc.frequences.keys()) {
      frequenceDocumentaire.set(terme, (frequenceDocumentaire.get(terme) ?? 0) + 1);
    }
  }

  const longueurMoyenne =
    documents.length === 0
      ? 0
      : documents.reduce((somme, d) => somme + d.longueur, 0) / documents.length;

  return {
    documents,
    frequenceDocumentaire,
    longueurMoyenne,
    vocabulaire: [...frequenceDocumentaire.keys()],
  };
}

function idf(index: IndexBM25<unknown>, terme: string): number {
  const n = index.documents.length;
  const df = index.frequenceDocumentaire.get(terme) ?? 0;
  if (df === 0) return 0;
  return Math.log((n - df + 0.5) / (df + 0.5) + 1);
}

/**
 * Un mot de requête absent du vocabulaire du corpus est remplacé par le
 * terme le plus proche à distance de Levenshtein ≤ 1 (mots ≥ 4 lettres) —
 * tolère une faute de frappe côté requête sans faire de la recherche floue
 * générale (le corpus lui-même, du Wikipédia propre, n'en a pas besoin).
 */
function corriger<T>(index: IndexBM25<T>, mot: string): string {
  if (mot.length < 4 || index.frequenceDocumentaire.has(mot)) return mot;
  for (const candidat of index.vocabulaire) {
    if (candidat.length < 4 || Math.abs(candidat.length - mot.length) > 1) continue;
    if (distanceLevenshtein(mot, candidat) <= 1) return candidat;
  }
  return mot;
}

export interface ResultatBM25<T> {
  item: T;
  score: number;
}

/** Triés par score décroissant ; aucune correspondance → tableau vide. */
export function chercherBM25<T>(index: IndexBM25<T>, requete: string): ResultatBM25<T>[] {
  const motsRequete = tokeniser(requete).map((m) => corriger(index, m));
  if (motsRequete.length === 0 || index.documents.length === 0) return [];

  const resultats: ResultatBM25<T>[] = [];
  for (const doc of index.documents) {
    let score = 0;
    for (const mot of motsRequete) {
      const f = doc.frequences.get(mot) ?? 0;
      if (f === 0) continue;
      const numerateur = f * (K1 + 1);
      const denominateur = f + K1 * (1 - B + (B * doc.longueur) / index.longueurMoyenne);
      score += idf(index, mot) * (numerateur / denominateur);
    }
    if (score > 0) resultats.push({ item: doc.item, score });
  }

  return resultats.sort((a, b) => b.score - a.score);
}
