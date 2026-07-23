'use client';

import { useUser } from '@clerk/nextjs';

export default function GreetingCTA({
  firstName: propFirstName,
  fallback,
}: {
  firstName: string | null;
  fallback: string;
}) {
  const { user } = useUser();
  const firstName = propFirstName || user?.firstName || null;

  if (!firstName) return <>{fallback}</>;

  const hour = new Date().getHours();
  const salut =
    hour >= 5 && hour < 12
      ? 'Bonjour'
      : hour >= 12 && hour < 18
        ? 'Bon après-midi'
        : 'Bonsoir';

  return <>{`${salut} ${firstName}`}</>;
}
