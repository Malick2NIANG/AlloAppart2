import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AgenceClientShell from './AgenceClientShell';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface AgencyListing {
  id: string; title: string; price: string | number; type: string;
  city: string; region: string; address?: string; images: string[];
  rooms?: number; surface?: number; beds?: number; baths?: number;
  boostUntil?: string | null; boostScore: number; isVerified: boolean; createdAt: string;
}

export interface Agency {
  id: string; firstName: string; lastName: string;
  agencyName?: string | null; agencySlug?: string | null;
  avatar?: string | null; bio?: string | null; phone?: string | null;
  createdAt: string;
  subscription?: { plan: string; status: string } | null;
  _count: { listings: number };
  listings: AgencyListing[];
  roles?: string[];
  isSuspended?: boolean;
}

async function fetchAgency(slug: string): Promise<Agency | null> {
  try {
    const res = await fetch(`${API_URL}/agences/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json() as Promise<Agency>;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const agency = await fetchAgency(slug);
  const t = await getTranslations('agences');
  if (!agency) return { title: t('metaNotFound') };
  const name = agency.agencyName ?? `${agency.firstName} ${agency.lastName}`;
  return {
    title: t('metaAgencyTitle', { name }),
    description: agency.bio ?? t('metaAgencyDescription', { count: agency._count.listings, name }),
    openGraph: { images: agency.avatar ? [agency.avatar] : [] },
  };
}

export default async function AgencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agency = await fetchAgency(slug);
  if (!agency) notFound();

  return <AgenceClientShell agency={agency} />;
}
