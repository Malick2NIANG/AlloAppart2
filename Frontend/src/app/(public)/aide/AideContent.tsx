'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import MiloSearchBar, { type MiloSearchBarHandle } from '@/components/milo/MiloSearchBar';
import type { MiloFaqResult } from '@/components/milo/types';
import { FAQ_TOPIC_IDS } from '@/components/milo/faqTopicIds';

const FAQ_TOPIC_ID_SET: ReadonlySet<string> = new Set(FAQ_TOPIC_IDS);

/**
 * Page /aide (lot « page /aide ») — un seul endroit pour poser une question
 * à Milo, SANS jamais ressembler à un chatbot : pas de fil de messages, pas
 * d'historique, pas de relance, pas de bulle flottante. Réutilise MiloSearchBar
 * + MiloFaqCard tels quels (aucune duplication) : une seule carte-réponse à
 * la fois, qu'elle vienne d'une question tapée ou d'un bouton « question
 * courante » (MiloSearchBarHandle.showFaq, sans appel réseau).
 */
export default function AideContent() {
  const t = useTranslations('aide');
  const tListings = useTranslations('listings');
  const tFaqQuestions = useTranslations('miloFaqQuestions');
  const tFaq = useTranslations('miloFaq');
  const barRef = useRef<MiloSearchBarHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeFaq, setActiveFaq] = useState<MiloFaqResult | null>(null);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Lot « boutons retour » — restaure la carte FAQ ouverte au retour depuis
  // une page cul-de-sac (BackButton -> /aide?sujet=<id>). Sujet inconnu ou
  // absent = ignoré sans erreur, jamais de donnée personnelle dans l'URL.
  useEffect(() => {
    const sujet = searchParams.get('sujet');
    if (sujet && FAQ_TOPIC_ID_SET.has(sujet)) {
      barRef.current?.showFaq({ id: sujet, answerKey: sujet });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture unique au montage, jamais ré-exécutée à chaque frappe dans la barre
  }, []);

  // Garde `?sujet=` synchronisé avec la carte affichée (jamais d'historique
  // supplémentaire — replace, pas push) pour que le lien « En savoir plus »
  // ouvert depuis ici sache y revenir, et que BackButton retrouve la bonne
  // question après un repli (pas d'historique same-origin).
  useEffect(() => {
    const current = searchParams.get('sujet');
    const next = activeFaq?.id ?? null;
    if (current === next) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('sujet', next); else params.delete('sujet');
    const qs = params.toString();
    router.replace(qs ? `/aide?${qs}` : '/aide', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit réagir qu'au changement de carte, jamais à searchParams/router (identité stable du routeur mise à part)
  }, [activeFaq]);

  return (
    <main className="min-h-screen bg-bg py-14 px-4">
      <div className="aa-container max-w-3xl">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-text md:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-sub">{t('subtitle')}</p>
        </div>

        <MiloSearchBar
          ref={barRef}
          size="compact"
          placeholder={tListings('askMiloPlaceholder')}
          ariaLabel={tListings('askMiloAriaLabel')}
          clearLabel={tListings('askMiloClear')}
          onFaqChange={setActiveFaq}
        />

        {activeFaq && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => barRef.current?.reset()}
              className="tap-target text-xs font-semibold text-gold-dark underline underline-offset-2 hover:text-gold-dark/80"
            >
              {t('askAnotherLabel')}
            </button>
          </div>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-dark">
            {t('commonQuestionsTitle')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {FAQ_TOPIC_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => barRef.current?.showFaq({ id, answerKey: id })}
                className="tap-target rounded-full border border-line bg-card px-4 py-2 text-sm text-text transition-colors hover:border-gold/50 hover:text-gold-dark"
              >
                {tFaqQuestions(id as Parameters<typeof tFaqQuestions>[0])}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-dark">
            {t('allQuestionsTitle')}
          </h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-card">
            {FAQ_TOPIC_IDS.map((id) => {
              const isOpen = openIds.has(id);
              const panelId = `aide-faq-panel-${id}`;
              return (
                <div key={id}>
                  <button
                    type="button"
                    onClick={() => toggleOpen(id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="tap-target flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-text"
                  >
                    <span>{tFaqQuestions(id as Parameters<typeof tFaqQuestions>[0])}</span>
                    <i
                      className={`fa-solid fa-chevron-down shrink-0 text-xs text-sub transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {isOpen && (
                    <p id={panelId} className="px-4 pb-4 text-sm text-sub">
                      {tFaq(id as Parameters<typeof tFaq>[0])}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-sub">{t('contactFallback')}</p>

      </div>
    </main>
  );
}
