/**
 * Bibliothèque de skeletons réutilisables — même rayons/bordures/paddings que
 * les vrais composants qu'ils remplacent (aucun saut de mise en page à
 * l'arrivée du contenu). Composants purement présentationnels (pas de
 * `'use client'`, pas de hook) : utilisables aussi bien dans un `loading.tsx`
 * (Server Component) que dans une page cliente.
 *
 * Accessibilité : les pièces individuelles n'ont pas d'aria — c'est
 * `SkeletonContainer` (le conteneur de haut niveau posé par l'appelant
 * autour d'un ou plusieurs skeletons) qui porte `role="status"
 * aria-busy="true"` et le libellé sr-only traduit (le composant ne peut pas
 * traduire lui-même : il doit rester utilisable depuis un Server Component
 * comme depuis une page cliente, donc le texte vient en prop).
 *
 * Pulsation : `animate-pulse` (Tailwind) est désactivée globalement sous
 * `prefers-reduced-motion: reduce` par une règle dans globals.css — rien à
 * faire ici. Couleurs : uniquement `bg-line`/`border-line`/`bg-card`
 * (variables de thème), jamais de couleur en dur — clair et sombre gratuits.
 */

export function SkeletonContainer({ label, children, className = '' }: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line ${className}`} />;
}

export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return <div className="animate-pulse rounded-xl bg-line" style={{ width, height: '16px' }} />;
}

export function SkeletonCard({ height = '80px' }: { height?: string }) {
  return <div className="w-full animate-pulse rounded-xl bg-line" style={{ height }} />;
}

export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-line" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded-xl bg-line" />
        <div className="h-3 w-1/2 animate-pulse rounded-xl bg-line" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-line" />
      <div className="mb-2 h-7 w-1/2 animate-pulse rounded-xl bg-line" />
      <div className="h-4 w-3/4 animate-pulse rounded-xl bg-line" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <div className="h-4 flex-[2] animate-pulse rounded-xl bg-line" />
      <div className="h-4 flex-[2] animate-pulse rounded-xl bg-line" />
      <div className="h-4 flex-1 animate-pulse rounded-xl bg-line" />
      <div className="h-4 flex-1 animate-pulse rounded-xl bg-line" />
    </div>
  );
}

/* ── Titre de page — h1 + sous-titre, motif répété en haut de presque
   toutes les pages (dashboard et public) ── */
export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Pulse className="h-7 w-56 max-w-full" />
        <Pulse className="h-4 w-80 max-w-full" />
      </div>
      {withAction && <Pulse className="h-10 w-36 shrink-0 rounded-full" />}
    </div>
  );
}

/* ── Carte annonce — même gabarit que `.listing-card` (image 16/10 + badge
   + titre + localisation + prix), utilisée par l'accueil, /listings,
   /favoris, /search, /agences/[slug]. ── */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <Pulse className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Pulse className="h-4 w-3/4" />
        <Pulse className="h-3 w-1/2" />
        <Pulse className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Grille de cartes annonces — 1 colonne mobile (comportement par défaut
 * d'une grille sans grid-cols explicite sous `sm:`), mêmes points de rupture
 * que la vraie grille (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`).
 */
export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <ListingCardSkeleton key={i} />)}
    </div>
  );
}

/* ── Fiche détail annonce — galerie + titre + prix + bloc contact,
   /listings/[id] (lg:grid-cols-[1fr_360px], inchangé ≥1024px) ── */
export function ListingDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Pulse className="h-96 w-full rounded-2xl" />
        <Pulse className="h-6 w-2/3" />
        <Pulse className="h-4 w-1/3" />
        <div className="space-y-2 pt-2">
          <SkeletonLine width="100%" />
          <SkeletonLine width="92%" />
          <SkeletonLine width="96%" />
          <SkeletonLine width="80%" />
        </div>
      </div>
      <div className="h-fit space-y-4 rounded-2xl border border-line p-5">
        <Pulse className="h-7 w-1/2" />
        <Pulse className="h-10 w-full rounded-xl" />
        <Pulse className="h-10 w-full rounded-xl" />
        <Pulse className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Grille de cartes statistiques — 2 colonnes sur mobile (comme les vraies
 * grilles de stats, ex. locataire/page.tsx `grid-cols-2 sm:grid-cols-4`),
 * mêmes rayons/bordures/padding que `.rounded-2xl border border-line
 * bg-card p-5` utilisé partout pour ces cartes.
 */
export function StatGridSkeleton({ count = 4, cols = 4 }: { count?: number; cols?: 2 | 3 | 4 | 5 }) {
  const colsClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'lg:grid-cols-5',
  }[cols];
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${colsClass}`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
  );
}

/* ── Liste de lignes (réservations, utilisateurs, notifications…) —
   empile SkeletonListRow, même espacement (`gap-2`) que les vraies listes. ── */
export function ListRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => <SkeletonListRow key={i} />)}
    </div>
  );
}

/* ── Tableau (admin, ≥768px) — en-tête + lignes, même conteneur
   `rounded-xl border border-line` que les vrais tableaux. ── */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-3 border-b border-line bg-bg px-4 py-3">
        <div className="h-3 flex-[2] animate-pulse rounded-xl bg-line/70" />
        <div className="h-3 flex-[2] animate-pulse rounded-xl bg-line/70" />
        <div className="h-3 flex-1 animate-pulse rounded-xl bg-line/70" />
        <div className="h-3 flex-1 animate-pulse rounded-xl bg-line/70" />
      </div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonTableRow key={i} />)}
    </div>
  );
}

/* ── Formulaire — même gabarit que `.input-field` (rounded-xl,
   py-2.5/px-4 ≈ h-11) : label court + champ, répété, puis bouton pleine
   largeur. ── */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Pulse className="h-3 w-24" />
          <Pulse className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Pulse className="h-12 w-full rounded-full" />
    </div>
  );
}

/* ── Messagerie — liste de conversations (avatar 44px + 2 lignes de texte,
   même gabarit que la ligne réelle de MessagesShell) ── */
export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl p-3">
          <Pulse className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Pulse className="h-3.5 w-2/5" />
            <Pulse className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Messagerie — fil de conversation (bulles alternées gauche/droite,
   même rayon `rounded-2xl` et largeur max que les vraies bulles) ── */
export function ChatSkeleton() {
  const bubbles = [
    { mine: false, w: 'w-2/3' }, { mine: true, w: 'w-1/2' },
    { mine: false, w: 'w-3/5' }, { mine: true, w: 'w-2/5' },
    { mine: false, w: 'w-1/2' },
  ];
  return (
    <div className="flex flex-col gap-3 p-4">
      {bubbles.map((b, i) => (
        <div key={i} className={`flex ${b.mine ? 'justify-end' : 'justify-start'}`}>
          <Pulse className={`h-10 max-w-[70%] ${b.w} rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}

/* ── Profil — avatar + nom + champs (même structure que les pages Mon
   profil / profil agent/bailleur). ── */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Pulse className="h-16 w-16 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Pulse className="h-5 w-40" />
          <Pulse className="h-3.5 w-28" />
        </div>
      </div>
      <FormSkeleton fields={3} />
    </div>
  );
}
